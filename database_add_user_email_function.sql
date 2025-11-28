-- =====================================================
-- Add function to get user email by ID
-- =====================================================
-- Needed for ManageMembersModal to display member names

CREATE OR REPLACE FUNCTION get_user_email_by_id(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges to access auth.users
STABLE
AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = p_user_id);
END;
$$;

COMMENT ON FUNCTION get_user_email_by_id IS
  'Returns the email for a given user ID - SECURITY DEFINER allows access to auth.users';
