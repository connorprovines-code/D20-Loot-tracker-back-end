-- =====================================================
-- D20 Loot Tracker - Fix Invite Recursion Error
-- =====================================================
-- PROBLEM: The previous fix caused infinite recursion in RLS policies
-- When sending invites, the insert_invites policy checks campaigns,
-- which was checking campaign_invites, creating a loop
--
-- SOLUTION: Keep RLS policies simple and use an RPC function
-- to fetch campaign details for pending invites
-- =====================================================

-- First, run database_get_invite_campaign.sql to create the RPC function

-- Ensure campaigns policy is simple (no recursion)
DROP POLICY IF EXISTS "view_campaigns" ON campaigns;

CREATE POLICY "view_campaigns"
  ON campaigns FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = campaigns.id
      AND user_id = auth.uid()
    )
  );

-- Ensure invites policy is simple (no recursion)
DROP POLICY IF EXISTS "view_invites" ON campaign_invites;

CREATE POLICY "view_invites"
  ON campaign_invites FOR SELECT
  USING (
    invitee_email = auth.email()
    OR inviter_id = auth.uid()
    OR campaign_id IN (
      SELECT id FROM campaigns WHERE owner_id = auth.uid()
    )
    OR campaign_id IN (
      SELECT campaign_id FROM campaign_members
      WHERE user_id = auth.uid()
      AND role IN ('dm', 'owner')
    )
  );

COMMENT ON POLICY "view_campaigns" ON campaigns IS
  'Users can view campaigns they own or are members of';

COMMENT ON POLICY "view_invites" ON campaign_invites IS
  'Users can view invites sent to them or invites they created';

-- The get_invite_campaign_info RPC function (from database_get_invite_campaign.sql)
-- provides a safe way to view campaign details for pending invites
