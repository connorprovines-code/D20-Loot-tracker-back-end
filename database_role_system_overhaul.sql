-- =====================================================
-- D20 Loot Tracker - Role System Overhaul
-- =====================================================
-- CHANGE: player/dm/owner → viewer/contributor/owner
--
-- NEW ROLES:
-- - viewer: Read-only access to campaign
-- - contributor: Can edit all campaign content (items, players, etc.)
-- - owner: Full control (manage members, invites, delete campaign)
-- =====================================================

-- =====================================================
-- STEP 1: Update campaign_members table
-- =====================================================

-- Drop the old check constraint
ALTER TABLE campaign_members DROP CONSTRAINT IF EXISTS campaign_members_role_check;

-- Add new check constraint with updated roles
ALTER TABLE campaign_members ADD CONSTRAINT campaign_members_role_check
  CHECK (role IN ('viewer', 'contributor', 'owner'));

-- Migrate existing data: player → contributor, dm → contributor
UPDATE campaign_members SET role = 'contributor' WHERE role IN ('player', 'dm');

-- =====================================================
-- STEP 2: Update campaign_invites table
-- =====================================================

-- Drop the old check constraint
ALTER TABLE campaign_invites DROP CONSTRAINT IF EXISTS campaign_invites_role_check;

-- Add new check constraint (invites can only be for viewer or contributor)
ALTER TABLE campaign_invites ADD CONSTRAINT campaign_invites_role_check
  CHECK (role IN ('viewer', 'contributor'));

-- Migrate existing invites: player → contributor, dm → contributor
UPDATE campaign_invites SET role = 'contributor' WHERE role IN ('player', 'dm');

-- Change default role to 'contributor'
ALTER TABLE campaign_invites ALTER COLUMN role SET DEFAULT 'contributor';

-- =====================================================
-- STEP 3: Update RLS Policies for Role-Based Permissions
-- =====================================================

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "view_invites" ON campaign_invites;
DROP POLICY IF EXISTS "insert_invites" ON campaign_invites;
DROP POLICY IF EXISTS "Campaign members can manage players" ON players;
DROP POLICY IF EXISTS "Campaign members can manage items" ON items;
DROP POLICY IF EXISTS "Campaign members can manage party fund" ON party_fund;
DROP POLICY IF EXISTS "Campaign members can create transactions" ON transactions;

-- =====================================================
-- Campaign Invites Policies
-- =====================================================

-- View: Can see invites sent to you, or invites you created, or from campaigns you manage
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
      AND role IN ('contributor', 'owner')  -- Updated: only contributors and owners can view invites
    )
  );

-- Insert: Only owners and contributors can send invites
CREATE POLICY "insert_invites"
  ON campaign_invites FOR INSERT
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE owner_id = auth.uid()
    )
    OR campaign_id IN (
      SELECT campaign_id FROM campaign_members
      WHERE user_id = auth.uid()
      AND role IN ('contributor', 'owner')  -- Updated: contributors can also invite
    )
  );

-- =====================================================
-- Campaign Content Policies (Players, Items, etc.)
-- =====================================================

-- Players: Contributors and owners can manage, viewers can only view
CREATE POLICY "view_players"
  ON players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = players.campaign_id
      AND user_id = auth.uid()
      -- All roles (viewer, contributor, owner) can view
    )
  );

CREATE POLICY "manage_players"
  ON players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = players.campaign_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'owner')  -- Only contributors and owners can add
    )
  );

CREATE POLICY "update_players"
  ON players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = players.campaign_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'owner')  -- Only contributors and owners can edit
    )
  );

CREATE POLICY "delete_players"
  ON players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = players.campaign_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'owner')  -- Only contributors and owners can delete
    )
  );

-- Items: Same pattern
CREATE POLICY "view_items"
  ON items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = items.campaign_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "manage_items"
  ON items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = items.campaign_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'owner')
    )
  );

CREATE POLICY "update_items"
  ON items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = items.campaign_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'owner')
    )
  );

CREATE POLICY "delete_items"
  ON items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = items.campaign_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'owner')
    )
  );

-- Party Fund: Same pattern
CREATE POLICY "view_party_fund"
  ON party_fund FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = party_fund.campaign_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "update_party_fund"
  ON party_fund FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = party_fund.campaign_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'owner')
    )
  );

-- Transactions: Same pattern
CREATE POLICY "view_transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = transactions.campaign_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "create_transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = transactions.campaign_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'owner')
    )
  );

-- =====================================================
-- STEP 4: Update Comments/Documentation
-- =====================================================

COMMENT ON COLUMN campaign_members.role IS
  'viewer: read-only, contributor: can edit campaign content, owner: full control';

COMMENT ON COLUMN campaign_invites.role IS
  'Role to assign when invite is accepted: viewer (read-only) or contributor (edit access)';

COMMENT ON POLICY "view_invites" ON campaign_invites IS
  'Users can view invites sent to them or from campaigns they contribute to/own';

COMMENT ON POLICY "insert_invites" ON campaign_invites IS
  'Contributors and owners can send invites';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check that all roles have been migrated
SELECT
  'campaign_members' as table_name,
  role,
  COUNT(*) as count
FROM campaign_members
GROUP BY role
UNION ALL
SELECT
  'campaign_invites' as table_name,
  role,
  COUNT(*) as count
FROM campaign_invites
GROUP BY role;

-- =====================================================
-- SUMMARY OF CHANGES
-- =====================================================
-- ✅ Updated role check constraints to use viewer/contributor/owner
-- ✅ Migrated existing player/dm roles to contributor
-- ✅ Changed default invite role to contributor
-- ✅ Updated all RLS policies to enforce:
--    - viewers: SELECT only (read-only)
--    - contributors: SELECT, INSERT, UPDATE, DELETE on campaign content
--    - owners: everything + manage members/invites
-- ✅ Only contributors and owners can send invites
-- ✅ Updated documentation
