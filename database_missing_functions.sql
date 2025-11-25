-- =====================================================
-- D20 Loot Tracker - Missing Database Functions
-- =====================================================
-- This file contains database functions that are referenced
-- in the application code but missing from the database schema

-- =====================================================
-- Function: get_user_campaigns
-- =====================================================
-- Returns all campaigns that a user has access to
-- This function bypasses RLS to avoid recursion issues

CREATE OR REPLACE FUNCTION get_user_campaigns(p_user_id UUID)
RETURNS TABLE (
  campaign_id UUID,
  campaign_name VARCHAR(255),
  owner_id UUID,
  game_system VARCHAR(50),
  party_fund_gets_share BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_role VARCHAR(20),
  joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as campaign_id,
    c.name as campaign_name,
    c.owner_id,
    c.game_system,
    c.party_fund_gets_share,
    c.created_at,
    c.updated_at,
    cm.role as user_role,
    cm.joined_at
  FROM campaigns c
  INNER JOIN campaign_members cm ON cm.campaign_id = c.id
  WHERE cm.user_id = p_user_id
  ORDER BY cm.role DESC, c.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_user_campaigns IS 'Returns all campaigns accessible to a user with their membership details';
