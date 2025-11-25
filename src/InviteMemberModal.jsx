import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { X, Mail, Copy, Check } from 'lucide-react';
import { sendCampaignInvite } from './services/emailService';

const InviteMemberModal = ({ campaign, onClose, onInviteSent }) => {
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteeRole, setInviteeRole] = useState('player');
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSendInvite = async () => {
    if (!inviteeEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteeEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const currentUser = session?.session?.user;

      if (!currentUser) {
        alert('You must be logged in to send invites');
        return;
      }

      // Create invite
      const { data, error } = await supabase
        .from('campaign_invites')
        .insert({
          campaign_id: campaign.id,
          inviter_id: currentUser.id,
          invitee_email: inviteeEmail.trim().toLowerCase(),
          role: inviteeRole,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation - invite already exists
          alert('An invite has already been sent to this email for this campaign');
        } else {
          throw error;
        }
        return;
      }

      // Generate invite link
      const link = `${window.location.origin}?invite=${data.invite_token}`;
      setInviteLink(link);

      // Send email invitation
      const emailResult = await sendCampaignInvite({
        to: inviteeEmail.trim().toLowerCase(),
        inviterName: currentUser.email,
        campaignName: campaign.name,
        role: inviteeRole,
        inviteLink: link
      });

      if (onInviteSent) {
        onInviteSent();
      }

      if (emailResult.success) {
        alert(`Invite email sent to ${inviteeEmail}!\n\nThey should receive it shortly. You can also share this link:\n${link}`);
      } else {
        alert(`Invite created but email failed to send.\n\nPlease share this link manually:\n${link}`);
      }

      setInviteeEmail('');
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Error sending invite: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail size={24} className="text-green-400" />
            Invite to {campaign.name}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Email Address</label>
            <input
              type="email"
              value={inviteeEmail}
              onChange={(e) => setInviteeEmail(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendInvite();
                }
              }}
              className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 focus:border-green-500 focus:outline-none"
              placeholder="friend@example.com"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Role</label>
            <select
              value={inviteeRole}
              onChange={(e) => setInviteeRole(e.target.value)}
              className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 focus:border-green-500 focus:outline-none"
            >
              <option value="player">Player (Collaborator)</option>
              <option value="dm">DM (Full permissions)</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              {inviteeRole === 'player'
                ? 'Players can edit all campaign content'
                : 'DMs have full permissions including managing members'}
            </p>
          </div>

          {inviteLink && (
            <div>
              <label className="block text-sm text-slate-300 mb-2">Invite Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded transition-colors flex items-center gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                This link expires in 7 days
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors text-white"
          >
            Close
          </button>
          <button
            onClick={handleSendInvite}
            disabled={sending || !inviteeEmail.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded transition-colors text-white flex items-center justify-center gap-2"
          >
            {sending ? (
              'Sending...'
            ) : (
              <>
                <Mail size={16} />
                Send Invite
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteMemberModal;
