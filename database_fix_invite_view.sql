-- =====================================================
-- D20 Loot Tracker - Fix Invite Campaign View (406 Error)
-- =====================================================
-- PROBLEM: When accepting invites, users can't view campaign details
-- because they're not members yet. The nested query in AcceptInvite.jsx
-- fails with 406 error.
--
-- SOLUTION: Update view_campaigns policy to allow viewing campaigns
-- if there's a pending invite for the current user.
-- =====================================================

-- Drop existing view policy
DROP POLICY IF EXISTS "view_campaigns" ON campaigns;

-- Create updated policy that allows viewing campaigns with pending invites
CREATE POLICY "view_campaigns"
  ON campaigns FOR SELECT
  USING (
    -- Can see campaigns you own
    owner_id = auth.uid()
    -- Can see campaigns where you're a member
    OR EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = campaigns.id
      AND user_id = auth.uid()
    )
    -- Can see campaigns where you have a pending invite
    OR EXISTS (
      SELECT 1 FROM campaign_invites
      WHERE campaign_id = campaigns.id
      AND invitee_email = auth.email()
      AND status = 'pending'
    )
  );

COMMENT ON POLICY "view_campaigns" ON campaigns IS
  'Users can view campaigns they own, are members of, or have pending invites to';
