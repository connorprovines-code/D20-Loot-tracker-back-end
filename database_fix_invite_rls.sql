-- =====================================================
-- D20 Loot Tracker - Fix Campaign Invites RLS Policy
-- =====================================================
-- PROBLEM: Direct auth.users queries in RLS get "permission denied"
-- SOLUTION: Use SECURITY DEFINER function
-- =====================================================

-- Create helper function to get current user email safely
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$;

-- Drop the problematic invite view policy
DROP POLICY IF EXISTS "view_invites" ON campaign_invites;

-- Recreate with SECURITY DEFINER function
CREATE POLICY "view_invites"
  ON campaign_invites FOR SELECT
  USING (
    -- Can see invites sent to your email (uses SECURITY DEFINER function)
    invitee_email = get_current_user_email()
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

COMMENT ON FUNCTION get_current_user_email IS
  'SECURITY DEFINER function to safely access auth.users email';
COMMENT ON POLICY "view_invites" ON campaign_invites IS
  'Users can view invites sent to them - Fixed to use SECURITY DEFINER function';
