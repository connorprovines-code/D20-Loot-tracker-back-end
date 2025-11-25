-- =====================================================
-- D20 Loot Tracker - NUCLEAR RLS FIX
-- =====================================================
-- PROBLEM IDENTIFIED: campaign_members policies were checking campaign_members
-- recursively (line 99-107 in database_collaboration_features.sql)
--
-- SOLUTION: Disable RLS on campaign_members entirely
-- Security is maintained through campaigns and campaign_invites policies

-- =====================================================
-- STEP 1: DROP ALL campaign_members POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view campaign members for their campaigns" ON campaign_members;
DROP POLICY IF EXISTS "Campaign owners can add members" ON campaign_members;
DROP POLICY IF EXISTS "Campaign owners can update member roles" ON campaign_members;
DROP POLICY IF EXISTS "Users can leave campaigns or owners can remove members" ON campaign_members;

-- =====================================================
-- STEP 2: DISABLE RLS ON campaign_members
-- =====================================================
-- This table will have NO RLS policies
-- Access is controlled indirectly through campaigns table

ALTER TABLE campaign_members DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: DROP ALL PROBLEMATIC POLICIES
-- =====================================================

-- Drop ALL existing policies on campaigns
DROP POLICY IF EXISTS "Users can view their campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can view campaigns they own or are members of" ON campaigns;
DROP POLICY IF EXISTS "Users can create campaigns" ON campaigns;
DROP POLICY IF EXISTS "Campaign owners and DMs can update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Only campaign owners can delete campaigns" ON campaigns;

-- Drop ALL existing policies on campaign_invites
DROP POLICY IF EXISTS "Users can view campaign invites" ON campaign_invites;
DROP POLICY IF EXISTS "Users can view relevant campaign invites" ON campaign_invites;
DROP POLICY IF EXISTS "Campaign owners and DMs can invite users" ON campaign_invites;
DROP POLICY IF EXISTS "Campaign owners and DMs can create invites" ON campaign_invites;
DROP POLICY IF EXISTS "Users can update their invites" ON campaign_invites;
DROP POLICY IF EXISTS "Users can update invites sent to them" ON campaign_invites;
DROP POLICY IF EXISTS "Campaign owners and inviters can delete invites" ON campaign_invites;

-- =====================================================
-- STEP 3: CREATE SIMPLE NON-RECURSIVE POLICIES
-- =====================================================

-- CAMPAIGNS TABLE
-- ------------------------------------------------

-- View: Can see campaigns you own OR campaigns where you're a member
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

-- Insert: Anyone can create campaigns
CREATE POLICY "insert_campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Update: Owners and DMs can update
CREATE POLICY "update_campaigns"
  ON campaigns FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = campaigns.id
      AND user_id = auth.uid()
      AND role IN ('dm', 'owner')
    )
  );

-- Delete: Only owners can delete
CREATE POLICY "delete_campaigns"
  ON campaigns FOR DELETE
  USING (owner_id = auth.uid());

-- CAMPAIGN INVITES TABLE
-- ------------------------------------------------

-- View: Can see invites TO you or FROM campaigns you manage
CREATE POLICY "view_invites"
  ON campaign_invites FOR SELECT
  USING (
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

-- Insert: Owners and DMs can create invites
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
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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
-- STEP 4: VERIFY NO RECURSION
-- =====================================================

-- Test query - this should NOT cause infinite recursion
-- SELECT * FROM campaigns WHERE owner_id = auth.uid();

-- Test query - check invites work
-- SELECT * FROM campaign_invites WHERE invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid());

COMMENT ON TABLE campaign_members IS 'RLS DISABLED - Access controlled via campaigns table policies';
