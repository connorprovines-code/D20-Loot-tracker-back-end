-- =====================================================
-- D20 Loot Tracker - Final Fixes
-- =====================================================
-- Fix invite error and add player edit permissions

-- =====================================================
-- FIX 1: Auth Users Access for Invites
-- =====================================================
-- The problem: Policies are checking auth.users which requires special access
-- Solution: Use auth.uid() and auth.email() functions instead

-- Drop the problematic invite view policy
DROP POLICY IF EXISTS "view_invites" ON campaign_invites;

-- Recreate with SECURITY DEFINER function approach
CREATE POLICY "view_invites"
  ON campaign_invites FOR SELECT
  USING (
    -- Can see invites sent to your email (use current user's email directly)
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

-- =====================================================
-- FIX 2: Allow ALL Members to Edit Campaign Content
-- =====================================================
-- Currently only owners and DMs can edit
-- Change to allow ALL campaign members (owner, dm, AND player)

-- Drop existing update policy
DROP POLICY IF EXISTS "update_campaigns" ON campaigns;

-- Recreate allowing all members to update
CREATE POLICY "update_campaigns"
  ON campaigns FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = campaigns.id
      AND user_id = auth.uid()
      -- Remove role restriction - all members can edit
    )
  );

-- =====================================================
-- FIX 3: Update Child Tables for Player Edit Access
-- =====================================================

-- Players table - allow all members to manage
DROP POLICY IF EXISTS "Campaign owners and DMs can manage players" ON players;

CREATE POLICY "Campaign members can manage players"
  ON players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = players.campaign_id
      AND user_id = auth.uid()
    )
  );

-- Items table - allow all members to manage
DROP POLICY IF EXISTS "Campaign owners and DMs can manage items" ON items;

CREATE POLICY "Campaign members can manage items"
  ON items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = items.campaign_id
      AND user_id = auth.uid()
    )
  );

-- Party Fund table - allow all members to manage
DROP POLICY IF EXISTS "Campaign owners and DMs can manage party fund" ON party_fund;

CREATE POLICY "Campaign members can manage party fund"
  ON party_fund FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = party_fund.campaign_id
      AND user_id = auth.uid()
    )
  );

-- Transactions table - allow all members to create
DROP POLICY IF EXISTS "Campaign owners and DMs can create transactions" ON transactions;

CREATE POLICY "Campaign members can create transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = transactions.campaign_id
      AND user_id = auth.uid()
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

COMMENT ON POLICY "view_invites" ON campaign_invites IS 'Fixed: Uses auth.email() instead of auth.users table';
COMMENT ON POLICY "update_campaigns" ON campaigns IS 'Updated: All campaign members can now edit';
COMMENT ON TABLE players IS 'Updated: All campaign members can manage';
COMMENT ON TABLE items IS 'Updated: All campaign members can manage';
COMMENT ON TABLE party_fund IS 'Updated: All campaign members can manage';
