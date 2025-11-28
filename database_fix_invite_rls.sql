-- =====================================================
-- D20 Loot Tracker - Fix Campaign Invites RLS Policy
-- =====================================================
-- PROBLEM: RLS policy uses auth.email() which doesn't exist
-- SOLUTION: Use subquery to get email from auth.users
-- =====================================================

-- Drop the problematic invite view policy
DROP POLICY IF EXISTS "view_invites" ON campaign_invites;

-- Recreate with proper email lookup
CREATE POLICY "view_invites"
  ON campaign_invites FOR SELECT
  USING (
    -- Can see invites sent to your email (lookup from auth.users)
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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

COMMENT ON POLICY "view_invites" ON campaign_invites IS
  'Users can view invites sent to them or invites they created - Fixed to use proper email lookup';
