import { Resend } from 'resend';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error: API key not set' });
  }

  // Initialize Resend with API key from environment
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { to, inviterName, campaignName, role, inviteLink } = req.body;

    // Validate required fields
    if (!to || !inviterName || !campaignName || !role || !inviteLink) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const roleText = role === 'dm' ? 'Dungeon Master' : 'Player';

    const { data, error } = await resend.emails.send({
      from: 'D20 Loot Tracker <noreply@d20-loot-tracker.com>',
      to: to,
      subject: `You're invited to join "${campaignName}"!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #312e81 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #22d3ee; margin: 0; font-size: 28px;">📦 D20 Loot Tracker</h1>
              <p style="color: #cbd5e1; margin: 10px 0 0 0; font-size: 14px;">Campaign Collaboration Platform</p>
            </div>

            <!-- Main Content -->
            <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none;">

              <h2 style="color: #1e293b; margin-top: 0;">You've been invited!</h2>

              <p style="color: #475569; font-size: 16px;">
                <strong>${inviterName}</strong> has invited you to join their campaign:
              </p>

              <div style="background: #f8fafc; border-left: 4px solid #22d3ee; padding: 15px 20px; margin: 20px 0;">
                <p style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 600;">${campaignName}</p>
                <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Role: ${roleText}</p>
              </div>

              ${role === 'player'
                ? '<p style="color: #475569;">As a <strong>collaborator</strong>, you\'ll be able to edit all campaign content including items, players, and transactions.</p>'
                : '<p style="color: #475569;">As a <strong>Dungeon Master</strong>, you\'ll have full permissions including managing members and all campaign content.</p>'
              }

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}"
                   style="display: inline-block; background: #06b6d4; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>

              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                Or copy and paste this link into your browser:
              </p>
              <div style="background: #f1f5f9; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #475569; font-family: monospace;">
                ${inviteLink}
              </div>

              <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                D20 Loot Tracker - Track your party's loot, gold, and inventory
              </p>
            </div>

          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Failed to send email:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
