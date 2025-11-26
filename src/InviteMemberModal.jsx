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
  const [inviteSent, setInviteSent] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

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

      // Set success state
      setInviteSent(true);
      setEmailSuccess(emailResult.success);
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Error sending invite: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    // Reset all state when closing
    setInviteeEmail('');
    setInviteeRole('player');
    setInviteLink('');
    setInviteSent(false);
    setEmailSuccess(false);
    setCopied(false);
    onClose();
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
            {inviteSent ? (
              <>
                <Check size={24} className="text-green-400" />
                Invite Sent!
              </>
            ) : (
              <>
                <Mail size={24} className="text-green-400" />
                Invite to {campaign.name}
              </>
            )}
          </h3>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {inviteSent ? (
          // Success state - show confirmation and link
          <div className="space-y-4">
            {/* Success message */}
            <div className={`p-4 rounded-lg border ${
              emailSuccess
                ? 'bg-green-900/30 border-green-700'
                : 'bg-yellow-900/30 border-yellow-700'
            }`}>
              <p className={`font-medium mb-2 ${
                emailSuccess ? 'text-green-200' : 'text-yellow-200'
              }`}>
                {emailSuccess ? (
                  <>✓ Email sent successfully!</</>
                ) : (
                  <>⚠ Invite created, but email failed to send</>
                )}
              </p>
              <p className={`text-sm ${
                emailSuccess ? 'text-green-300' : 'text-yellow-300'
              }`}>
                {emailSuccess ? (
                  <>The invitation has been sent to <strong>{inviteeEmail}</strong>. They should receive it shortly. <span className="block mt-1 text-xs opacity-80">Note: The email may arrive in their spam folder.</span></>
                ) : (
                  <>Please share the invite link below manually with <strong>{inviteeEmail}</strong>.</>
                )}
              </p>
            </div>

            {/* Invite link */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">Invite Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  onClick={(e) => e.target.select()}
                  className="flex-1 bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 text-sm cursor-pointer"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                This link expires in 7 days. You can also share it directly with your invitee.
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="w-full bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded transition-colors text-white font-medium mt-2"
            >
              Done
            </button>
          </div>
        ) : (
          // Initial state - show form
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={inviteeEmail}
                  onChange={(e) => setInviteeEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !sending && inviteeEmail.trim()) {
                      handleSendInvite();
                    }
                  }}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 focus:border-green-500 focus:outline-none"
                  placeholder="friend@example.com"
                  autoFocus
                  disabled={sending}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Role</label>
                <select
                  value={inviteeRole}
                  onChange={(e) => setInviteeRole(e.target.value)}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 focus:border-green-500 focus:outline-none"
                  disabled={sending}
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
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors text-white"
                disabled={sending}
              >
                Cancel
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
          </>
        )}
      </div>
    </div>
  );
};

export default InviteMemberModal;
