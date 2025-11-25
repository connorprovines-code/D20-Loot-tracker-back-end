-- =====================================================
-- D20 Loot Tracker - Collaboration Features Migration
-- =====================================================
-- This migration adds multi-user collaboration support to campaigns
-- allowing users to invite others and share campaign access.

-- =====================================================
-- 1. CAMPAIGN MEMBERS TABLE
-- =====================================================
-- Tracks which users have access to which campaigns and their roles

CREATE TABLE IF NOT EXISTS campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'player'
    CHECK (role IN ('owner', 'dm', 'player')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_role ON campaign_members(campaign_id, role);

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'campaign_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE campaign_members;
  END IF;
END $$;

COMMENT ON TABLE campaign_members IS 'Tracks user membership and roles within campaigns';
COMMENT ON COLUMN campaign_members.role IS 'owner: full control, dm: can edit campaign, player: view and interact';

-- =====================================================
-- 2. CAMPAIGN INVITES TABLE
-- =====================================================
-- Tracks pending invitations to campaigns

CREATE TABLE IF NOT EXISTS campaign_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'player'
    CHECK (role IN ('dm', 'player')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invite_token UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),

  UNIQUE(campaign_id, invitee_email, status)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_invites_campaign ON campaign_invites(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_invites_email ON campaign_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_campaign_invites_token ON campaign_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_campaign_invites_status ON campaign_invites(status);

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'campaign_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE campaign_invites;
  END IF;
END $$;

COMMENT ON TABLE campaign_invites IS 'Pending campaign invitations sent to users';
COMMENT ON COLUMN campaign_invites.invite_token IS 'Unique token for accepting invite via link';

-- =====================================================
-- 3. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_invites ENABLE ROW LEVEL SECURITY;

-- Campaign Members Policies
-- ------------------------------------------------

-- Users can view members of campaigns they belong to
CREATE POLICY "Users can view campaign members for their campaigns"
  ON campaign_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaign_members.campaign_id
      AND cm.user_id = auth.uid()
    )
  );

-- Campaign owners can add members
CREATE POLICY "Campaign owners can add members"
  ON campaign_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaign_members.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
    )
  );

-- Campaign owners can update member roles (except their own owner role)
CREATE POLICY "Campaign owners can update member roles"
  ON campaign_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaign_members.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
    )
    AND NOT (campaign_members.user_id = auth.uid() AND campaign_members.role = 'owner')
  );

-- Users can remove themselves (leave campaign) or owners can remove others
CREATE POLICY "Users can leave campaigns or owners can remove members"
  ON campaign_members FOR DELETE
  USING (
    campaign_members.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaign_members.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
    )
  );

-- Campaign Invites Policies
-- ------------------------------------------------

-- Users can view invites for campaigns they're members of, or invites sent to them
CREATE POLICY "Users can view relevant campaign invites"
  ON campaign_invites FOR SELECT
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaign_invites.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'dm')
    )
  );

-- Campaign owners and DMs can create invites
CREATE POLICY "Campaign owners and DMs can invite users"
  ON campaign_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaign_invites.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'dm')
    )
  );

-- Invitees can update their own invites (accept/decline)
-- Inviters can cancel (delete) invites they sent
CREATE POLICY "Users can update invites sent to them"
  ON campaign_invites FOR UPDATE
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Campaign owners/DMs or inviters can delete invites
CREATE POLICY "Campaign owners and inviters can delete invites"
  ON campaign_invites FOR DELETE
  USING (
    inviter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaign_invites.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
    )
  );

-- =====================================================
-- 4. UPDATE EXISTING RLS POLICIES FOR CAMPAIGNS
-- =====================================================
-- Now campaigns are accessible if user is owner OR member

-- Drop old campaigns policies
DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON campaigns;

-- New campaigns policies that check membership
CREATE POLICY "Users can view campaigns they own or are members of"
  ON campaigns FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaigns.id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Campaign owners and DMs can update campaigns"
  ON campaigns FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaigns.id
      AND cm.user_id = auth.uid()
      AND cm.role = 'dm'
    )
  );

CREATE POLICY "Only campaign owners can delete campaigns"
  ON campaigns FOR DELETE
  USING (owner_id = auth.uid());

-- =====================================================
-- 5. UPDATE CHILD TABLE POLICIES (players, items, etc)
-- =====================================================
-- Allow campaign members to interact with campaign data

-- Players table
DROP POLICY IF EXISTS "Users can manage players in their campaigns" ON players;

CREATE POLICY "Campaign members can view players"
  ON players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = players.campaign_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners and DMs can manage players"
  ON players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = players.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'dm')
    )
  );

-- Party Fund table
DROP POLICY IF EXISTS "Users can manage party fund in their campaigns" ON party_fund;

CREATE POLICY "Campaign members can view party fund"
  ON party_fund FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = party_fund.campaign_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners and DMs can manage party fund"
  ON party_fund FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = party_fund.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'dm')
    )
  );

-- Items table
DROP POLICY IF EXISTS "Users can manage items in their campaigns" ON items;

CREATE POLICY "Campaign members can view items"
  ON items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = items.campaign_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners and DMs can manage items"
  ON items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = items.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'dm')
    )
  );

-- Transactions table
DROP POLICY IF EXISTS "Users can manage transactions in their campaigns" ON transactions;

CREATE POLICY "Campaign members can view transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = transactions.campaign_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners and DMs can create transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = transactions.campaign_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'dm')
    )
  );

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is campaign member
CREATE OR REPLACE FUNCTION is_campaign_member(p_campaign_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM campaign_members
    WHERE campaign_id = p_campaign_id
    AND user_id = p_user_id
  );
END;
$$;

-- Function to get user's role in campaign
CREATE OR REPLACE FUNCTION get_campaign_role(p_campaign_id UUID, p_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role VARCHAR(20);
BEGIN
  SELECT role INTO v_role
  FROM campaign_members
  WHERE campaign_id = p_campaign_id
  AND user_id = p_user_id;

  RETURN v_role;
END;
$$;

-- Function to accept campaign invite
CREATE OR REPLACE FUNCTION accept_campaign_invite(p_invite_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_user_email VARCHAR(255);
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Get invite details
  SELECT * INTO v_invite
  FROM campaign_invites
  WHERE invite_token = p_invite_token
  AND status = 'pending'
  AND expires_at > NOW()
  AND invitee_email = v_user_email;

  -- Check if invite exists and is valid
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invite'
    );
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM campaign_members
    WHERE campaign_id = v_invite.campaign_id
    AND user_id = v_user_id
  ) THEN
    -- Update invite status but don't add duplicate member
    UPDATE campaign_invites
    SET status = 'accepted'
    WHERE id = v_invite.id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already a member of this campaign'
    );
  END IF;

  -- Add user as campaign member
  INSERT INTO campaign_members (campaign_id, user_id, role, invited_by)
  VALUES (v_invite.campaign_id, v_user_id, v_invite.role, v_invite.inviter_id);

  -- Update invite status
  UPDATE campaign_invites
  SET status = 'accepted'
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', v_invite.campaign_id,
    'role', v_invite.role
  );
END;
$$;

-- Function to decline campaign invite
CREATE OR REPLACE FUNCTION decline_campaign_invite(p_invite_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email VARCHAR(255);
BEGIN
  -- Get current user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  -- Update invite status
  UPDATE campaign_invites
  SET status = 'declined'
  WHERE invite_token = p_invite_token
  AND invitee_email = v_user_email
  AND status = 'pending';

  IF FOUND THEN
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invite not found or already processed'
    );
  END IF;
END;
$$;

-- =====================================================
-- 7. DATA MIGRATION
-- =====================================================
-- Add existing campaign owners as members with 'owner' role

INSERT INTO campaign_members (campaign_id, user_id, role, invited_by)
SELECT
  id as campaign_id,
  owner_id as user_id,
  'owner' as role,
  NULL as invited_by
FROM campaigns
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- =====================================================
-- 8. TRIGGER TO AUTO-ADD OWNER AS MEMBER
-- =====================================================
-- When a new campaign is created, automatically add the owner as a member

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
-- MIGRATION COMPLETE
-- =====================================================
-- Summary of changes:
-- ✅ Created campaign_members table
-- ✅ Created campaign_invites table
-- ✅ Updated RLS policies for collaboration
-- ✅ Created helper functions for invite workflow
-- ✅ Migrated existing campaigns to add owners as members
-- ✅ Added trigger to auto-add owners on campaign creation
