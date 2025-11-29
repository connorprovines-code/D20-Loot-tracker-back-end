import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { X, Trash2, Shield, Eye, Crown } from 'lucide-react';

const ManageMembersModal = ({ campaign, currentUserId, onClose, onMembersChanged }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [campaign.id]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      // Fetch all members for this campaign
      const { data, error } = await supabase
        .from('campaign_members')
        .select(`
          id,
          role,
          joined_at,
          user_id,
          invited_by
        `)
        .eq('campaign_id', campaign.id)
        .order('role'); // Owner first, then contributor, then viewer

      if (error) throw error;

      // Fetch user emails for all members
      const membersWithEmails = await Promise.all(
        (data || []).map(async (member) => {
          try {
            // Call RPC function to get email safely
            const { data: emailData, error: emailError } = await supabase
              .rpc('get_user_email_by_id', { p_user_id: member.user_id });

            return {
              ...member,
              email: emailData || 'Unknown user'
            };
          } catch (err) {
            console.error('Error fetching email for user:', member.user_id, err);
            return {
              ...member,
              email: `User ${member.user_id.substring(0, 8)}...`
            };
          }
        })
      );

      setMembers(membersWithEmails);
    } catch (error) {
      console.error('Error loading members:', error);
      alert('Error loading members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId, memberUserId) => {
    if (memberUserId === currentUserId) {
      alert('You cannot remove yourself. Use the "Leave Campaign" button instead.');
      return;
    }

    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('campaign_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await loadMembers();
      if (onMembersChanged) {
        onMembersChanged();
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Error removing member');
    }
  };

  const handleChangeRole = async (memberId, currentRole, memberUserId) => {
    if (memberUserId === currentUserId && currentRole === 'owner') {
      alert('You cannot change your own role as the owner.');
      return;
    }

    // Cycle through roles: viewer -> contributor -> viewer
    const newRole = currentRole === 'viewer' ? 'contributor' : 'viewer';

    try {
      const { error } = await supabase
        .from('campaign_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      await loadMembers();
      if (onMembersChanged) {
        onMembersChanged();
      }
    } catch (error) {
      console.error('Error changing role:', error);
      alert('Error changing role');
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner':
        return <Crown size={16} className="text-cyan-400" />;
      case 'contributor':
        return <Shield size={16} className="text-purple-400" />;
      case 'viewer':
        return <Eye size={16} className="text-slate-400" />;
      default:
        return null;
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      owner: { text: 'Owner', color: 'bg-cyan-600' },
      contributor: { text: 'Contributor', color: 'bg-purple-600' },
      viewer: { text: 'Viewer', color: 'bg-slate-600' }
    };
    return badges[role] || badges.viewer;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-4 sm:p-6 max-w-sm sm:max-w-md lg:max-w-2xl w-full border border-slate-700 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield size={24} className="text-purple-400" />
            Manage Members - {campaign.name}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No members found</div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const roleBadge = getRoleBadge(member.role);
              const isCurrentUser = member.user_id === currentUserId;
              const isOwner = member.role === 'owner';

              return (
                <div
                  key={member.id}
                  className="bg-slate-700 rounded-lg p-4 border border-slate-600 flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    {getRoleIcon(member.role)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">
                          {member.email || `User ${member.user_id.substring(0, 8)}...`}
                          {member.user_id === currentUserId && <span className="text-cyan-400 ml-1">(You)</span>}
                        </p>
                        <span className={`${roleBadge.color} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                          {roleBadge.text}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isOwner && (
                      <>
                        <button
                          onClick={() => handleChangeRole(member.id, member.role, member.user_id)}
                          className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition-colors text-white"
                          title="Change Role"
                        >
                          {member.role === 'viewer' ? 'Make Contributor' : 'Make Viewer'}
                        </button>
                        {!isCurrentUser && (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.user_id)}
                            className="bg-red-600 hover:bg-red-700 p-2 rounded transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                    {isOwner && !isCurrentUser && (
                      <span className="text-xs text-slate-400 italic">Campaign Owner</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-400 space-y-1">
          <p><strong>Owner:</strong> Full control, can delete campaign and manage all members</p>
          <p><strong>Contributor:</strong> Can edit all campaign content, manage items/players, and send invites</p>
          <p><strong>Viewer:</strong> Read-only access to campaign data</p>
        </div>
      </div>
    </div>
  );
};

export default ManageMembersModal;
