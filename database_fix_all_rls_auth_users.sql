-- =====================================================
-- D20 Loot Tracker - Fix ALL RLS Policies Using auth.users
-- =====================================================
-- PROBLEM: RLS policies querying auth.users table get "permission denied"
-- SOLUTION: Use SECURITY DEFINER functions instead
-- =====================================================

-- =====================================================
-- STEP 1: Create helper function to get current user email
-- =====================================================

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

COMMENT ON FUNCTION get_current_user_email IS
  'Returns the email of the currently authenticated user - SECURITY DEFINER allows access to auth.users';

-- =====================================================
-- STEP 2: Recreate campaign_invites policies with function
-- =====================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "view_invites" ON campaign_invites;
DROP POLICY IF EXISTS "insert_invites" ON campaign_invites;
DROP POLICY IF EXISTS "update_invites" ON campaign_invites;
DROP POLICY IF EXISTS "delete_invites" ON campaign_invites;

-- View: Can see invites TO you or FROM campaigns you manage
CREATE POLICY "view_invites"
  ON campaign_invites FOR SELECT
  USING (
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

-- Insert: Owners and DMs can create invites
-- NOTE: Does NOT need email check - only checks campaign membership
CREATE POLICY "insert_invites"
  ON campaign_invites FOR INSERT
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE owner_id = auth.uid()
    )
    OR campaign_id IN (
      SELECT campaign_id FROM campaign_members
      WHERE user_id = auth.uid()
      AND role IN ('dm', 'owner')
    )
  );

-- Update: Can update invites sent to you
CREATE POLICY "update_invites"
  ON campaign_invites FOR UPDATE
  USING (
    invitee_email = get_current_user_email()
  );

-- Delete: Inviters and campaign owners can delete
CREATE POLICY "delete_invites"
  ON campaign_invites FOR DELETE
  USING (
    inviter_id = auth.uid()
    OR campaign_id IN (
      SELECT id FROM campaigns WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- STEP 3: Verify trigger exists
-- =====================================================

-- Ensure the trigger to auto-add campaign owners as members exists
CREATE OR REPLACE FUNCTION add_campaign_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO campaign_members (campaign_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.owner_id, 'owner', NULL)
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_add_campaign_owner_as_member ON campaigns;
CREATE TRIGGER trigger_add_campaign_owner_as_member
  AFTER INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION add_campaign_owner_as_member();

-- =====================================================
-- VERIFICATION
-- =====================================================

COMMENT ON FUNCTION get_current_user_email IS
  'SECURITY DEFINER function to access auth.users email without permission issues';
COMMENT ON POLICY "view_invites" ON campaign_invites IS
  'Fixed: Uses SECURITY DEFINER function instead of direct auth.users query';
COMMENT ON POLICY "update_invites" ON campaign_invites IS
  'Fixed: Uses SECURITY DEFINER function instead of direct auth.users query';
