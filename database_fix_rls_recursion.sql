-- =====================================================
-- D20 Loot Tracker - Fix RLS Infinite Recursion Issues
-- =====================================================
-- This fixes the 500 errors and infinite recursion in RLS policies
-- The problem: policies were checking campaign_members recursively

-- =====================================================
-- 1. DROP PROBLEMATIC POLICIES
-- =====================================================

-- Drop all existing campaign_invites policies
DROP POLICY IF EXISTS "Users can view relevant campaign invites" ON campaign_invites;
DROP POLICY IF EXISTS "Campaign owners and DMs can invite users" ON campaign_invites;
DROP POLICY IF EXISTS "Users can update invites sent to them" ON campaign_invites;
DROP POLICY IF EXISTS "Campaign owners and inviters can delete invites" ON campaign_invites;

-- Drop problematic campaigns policies
DROP POLICY IF EXISTS "Users can view campaigns they own or are members of" ON campaigns;
DROP POLICY IF EXISTS "Campaign owners and DMs can update campaigns" ON campaigns;

-- =====================================================
-- 2. CREATE NON-RECURSIVE POLICIES
-- =====================================================

-- Campaigns: View policy (non-recursive using direct owner check)
CREATE POLICY "Users can view their campaigns"
  ON campaigns FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT campaign_id
      FROM campaign_members
      WHERE user_id = auth.uid()
    )
  );

-- Campaigns: Update policy (using helper function to avoid recursion)
CREATE POLICY "Campaign owners and DMs can update campaigns"
  ON campaigns FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR get_campaign_role(id, auth.uid()) = 'dm'
  );

-- Campaign Invites: View policy (simplified)
CREATE POLICY "Users can view campaign invites"
  ON campaign_invites FOR SELECT
  USING (
    -- Can see invites sent to their email
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    -- Can see invites for campaigns they own
    campaign_id IN (
      SELECT id FROM campaigns WHERE owner_id = auth.uid()
    )
    OR
    -- Can see invites for campaigns where they're a DM
    get_campaign_role(campaign_id, auth.uid()) = 'dm'
  );

-- Campaign Invites: Insert policy (simplified, owners and DMs only)
CREATE POLICY "Campaign owners and DMs can create invites"
  ON campaign_invites FOR INSERT
  WITH CHECK (
    -- Must be owner
    campaign_id IN (
      SELECT id FROM campaigns WHERE owner_id = auth.uid()
    )
    OR
    -- Or be a DM
    get_campaign_role(campaign_id, auth.uid()) = 'dm'
  );

-- Campaign Invites: Update policy (invitees can accept/decline)
CREATE POLICY "Users can update their invites"
  ON campaign_invites FOR UPDATE
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Campaign Invites: Delete policy
CREATE POLICY "Campaign owners and inviters can delete invites"
  ON campaign_invites FOR DELETE
  USING (
    inviter_id = auth.uid()
    OR campaign_id IN (
      SELECT id FROM campaigns WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- 3. OPTIMIZE get_campaign_role FUNCTION
-- =====================================================
-- Make it more efficient and avoid potential recursion

CREATE OR REPLACE FUNCTION get_campaign_role(p_campaign_id UUID, p_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM campaign_members
  WHERE campaign_id = p_campaign_id
  AND user_id = p_user_id
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_campaign_role IS 'Returns user role in campaign - optimized SQL function';

-- =====================================================
-- 4. ADD MISSING INDEXES FOR PERFORMANCE
-- =====================================================

-- Ensure we have indexes for the owner_id lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_owner_id ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaign_invites_invitee_email ON campaign_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_campaign_invites_inviter_id ON campaign_invites(inviter_id);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify the fixes worked:

-- Check all policies are in place
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE tablename IN ('campaigns', 'campaign_invites', 'campaign_members')
-- ORDER BY tablename, policyname;

-- Check if functions exist
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name LIKE '%campaign%';
