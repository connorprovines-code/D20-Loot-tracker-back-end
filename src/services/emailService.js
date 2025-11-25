/**
 * Send a campaign invite email via serverless function
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.inviterName - Name/email of person sending invite
 * @param {string} params.campaignName - Name of the campaign
 * @param {string} params.role - Role being invited as (player/dm)
 * @param {string} params.inviteLink - The invite link URL
 */
export async function sendCampaignInvite({ to, inviterName, campaignName, role, inviteLink }) {
  try {
    const response = await fetch('/api/send-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        inviterName,
        campaignName,
        role,
        inviteLink,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Email API error:', result);
      return { success: false, error: result.error || 'Failed to send email' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}
