-- =====================================================
-- D20 Loot Tracker - Get Campaign Info for Invite
-- =====================================================
-- PROBLEM: Users can't view campaign details when accepting invites
-- because RLS blocks viewing campaigns you're not a member of
--
-- SOLUTION: Create an RPC function that fetches campaign info
-- for invites, bypassing RLS in a controlled way
-- =====================================================

-- Function to get campaign details for a valid pending invite
CREATE OR REPLACE FUNCTION get_invite_campaign_info(p_invite_token UUID)
RETURNS TABLE (
  campaign_id UUID,
  campaign_name TEXT,
  game_system TEXT,
  invite_role TEXT,
  invite_status TEXT,
  invite_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
AS $$
DECLARE
  v_user_id UUID;
  v_user_email VARCHAR(255);
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Return campaign info only if:
  -- 1. Invite exists and is addressed to current user
  -- 2. Invite is still pending
  -- 3. Invite hasn't expired
  RETURN QUERY
  SELECT
    c.id as campaign_id,
    c.name::TEXT as campaign_name,
    c.game_system::TEXT,
    ci.role::TEXT as invite_role,
    ci.status::TEXT as invite_status,
    ci.expires_at as invite_expires_at
  FROM campaign_invites ci
  JOIN campaigns c ON c.id = ci.campaign_id
  WHERE ci.invite_token = p_invite_token
    AND ci.invitee_email = v_user_email
    AND ci.status = 'pending'
    AND ci.expires_at > NOW();
END;
$$;

COMMENT ON FUNCTION get_invite_campaign_info IS
  'Fetches campaign details for a valid pending invite, bypassing RLS';
