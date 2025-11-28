import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Mail, CheckCircle, XCircle, Loader } from 'lucide-react';

const AcceptInvite = ({ inviteToken, user, onAccepted, onDeclined }) => {
  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (inviteToken && user) {
      loadInviteInfo();
    }
  }, [inviteToken, user]);

  const loadInviteInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Loading invite info for token:', inviteToken);
      console.log('Current user:', user?.email);

      // Use RPC function to get campaign info AND bypass RLS
      // This is necessary because users can't view campaigns they're not members of yet
      const { data, error } = await supabase
        .rpc('get_invite_campaign_info', {
          p_invite_token: inviteToken
        })
        .single();

      console.log('RPC response:', { data, error });

      if (error) {
        console.error('RPC error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        setError(`Invite not found or not addressed to you (${user.email})`);
        return;
      }

      if (!data) {
        setError('Invite not found, has expired, or has already been used');
        return;
      }

      // Transform RPC result to expected format
      setInviteInfo({
        id: inviteToken,
        role: data.invite_role,
        status: data.invite_status,
        expires_at: data.invite_expires_at,
        campaigns: {
          id: data.campaign_id,
          name: data.campaign_name,
          game_system: data.game_system
        }
      });
    } catch (err) {
      console.error('Error loading invite:', err);
      setError('Error loading invite information: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setProcessing(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('accept_campaign_invite', {
        p_invite_token: inviteToken
      });

      if (error) throw error;

      if (data.success) {
        if (onAccepted) {
          onAccepted(data.campaign_id);
        }
      } else {
        setError(data.error || 'Failed to accept invite');
      }
    } catch (err) {
      console.error('Error accepting invite:', err);
      setError('Error accepting invite: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this invite?')) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('decline_campaign_invite', {
        p_invite_token: inviteToken
      });

      if (error) throw error;

      if (data.success) {
        if (onDeclined) {
          onDeclined();
        }
      } else {
        setError(data.error || 'Failed to decline invite');
      }
    } catch (err) {
      console.error('Error declining invite:', err);
      setError('Error declining invite: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const getSystemDisplayInfo = (system) => {
    const systemInfo = {
      'dnd-5e': { name: 'D&D 5e', color: 'bg-red-600' },
      'pathfinder-1e': { name: 'Pathfinder 1e', color: 'bg-amber-600' },
      'pathfinder-2e': { name: 'Pathfinder 2e', color: 'bg-orange-600' },
      'other': { name: 'Other System', color: 'bg-slate-600' }
    };
    return systemInfo[system] || systemInfo['other'];
  };

  const getRoleBadge = (role) => {
    const badges = {
      dm: { text: 'DM', color: 'bg-purple-600' },
      player: { text: 'Player', color: 'bg-slate-600' }
    };
    return badges[role] || badges.player;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center max-w-md w-full">
          <Loader className="animate-spin text-cyan-400 mx-auto mb-4" size={48} />
          <p className="text-white text-lg">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-lg p-8 border border-red-700 text-center max-w-md w-full">
          <XCircle className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Invite Error</h2>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-cyan-600 hover:bg-cyan-700 px-6 py-3 rounded-lg text-white font-medium transition-colors"
          >
            Go to Campaigns
          </button>
        </div>
      </div>
    );
  }

  if (!inviteInfo || !inviteInfo.campaigns) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-lg p-8 border border-red-700 text-center max-w-md w-full">
          <XCircle className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Invalid Invite</h2>
          <p className="text-slate-300 mb-6">The campaign associated with this invite could not be found.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-cyan-600 hover:bg-cyan-700 px-6 py-3 rounded-lg text-white font-medium transition-colors"
          >
            Go to Campaigns
          </button>
        </div>
      </div>
    );
  }

  const systemInfo = getSystemDisplayInfo(inviteInfo.campaigns.game_system);
  const roleBadge = getRoleBadge(inviteInfo.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
      <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 max-w-md w-full">
        <div className="text-center mb-6">
          <Mail className="text-cyan-400 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Campaign Invitation</h2>
          <p className="text-slate-400">You've been invited to join a campaign!</p>
        </div>

        <div className="bg-slate-700 rounded-lg p-6 mb-6 border border-slate-600">
          <h3 className="text-xl font-bold text-white mb-3">{inviteInfo.campaigns.name}</h3>
          <div className="flex gap-2 mb-3">
            <span className={`${systemInfo.color} text-white text-xs px-2 py-1 rounded-full font-medium`}>
              {systemInfo.name}
            </span>
            <span className={`${roleBadge.color} text-white text-xs px-2 py-1 rounded-full font-medium`}>
              {roleBadge.text}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            You'll join as a <strong className="text-white">{inviteInfo.role}</strong>
          </p>
          {inviteInfo.role === 'dm' && (
            <p className="text-xs text-slate-400 mt-2">
              As a DM, you can edit campaign settings, manage items and players
            </p>
          )}
          {inviteInfo.role === 'player' && (
            <p className="text-xs text-slate-400 mt-2">
              As a Player, you can view campaign data
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={processing}
            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors text-white"
          >
            {processing ? 'Processing...' : 'Decline'}
          </button>
          <button
            onClick={handleAccept}
            disabled={processing}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2"
          >
            {processing ? (
              'Accepting...'
            ) : (
              <>
                <CheckCircle size={20} />
                Accept
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          Logged in as {user.email}
        </p>
      </div>
    </div>
  );
};

export default AcceptInvite;
