-- =====================================================
-- Campaign System Features Migration
-- Adds support for D&D 5e, Pathfinder 1e/2e, and Other systems
-- =====================================================
-- Run this SQL in your Supabase SQL editor AFTER database_setup_v2.sql

-- =====================================================
-- 1. ADD GAME SYSTEM TO CAMPAIGNS
-- =====================================================
-- Add game_system column with constraint
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS game_system VARCHAR(50) DEFAULT 'pathfinder-1e'
  CHECK (game_system IN ('dnd-5e', 'pathfinder-1e', 'pathfinder-2e', 'other'));

-- Set default for existing campaigns
UPDATE campaigns SET game_system = 'pathfinder-1e' WHERE game_system IS NULL;

COMMENT ON COLUMN campaigns.game_system IS 'Game system for this campaign: dnd-5e, pathfinder-1e, pathfinder-2e, or other';

-- =====================================================
-- 2. ADD SYSTEM-SPECIFIC FIELDS TO ITEMS
-- =====================================================
-- Bulk tracking for Pathfinder 2e
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS bulk DECIMAL(10,2) DEFAULT NULL;

COMMENT ON COLUMN items.bulk IS 'Item bulk for Pathfinder 2e (NULL for other systems)';

-- D&D 5e attunement fields
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS requires_attunement BOOLEAN DEFAULT false;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS is_attuned BOOLEAN DEFAULT false;

COMMENT ON COLUMN items.requires_attunement IS 'Whether item requires attunement (D&D 5e)';
COMMENT ON COLUMN items.is_attuned IS 'Whether item is currently attuned to assigned character (D&D 5e)';

-- D&D 5e rarity field
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS rarity VARCHAR(50) DEFAULT NULL
  CHECK (rarity IS NULL OR rarity IN ('common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'));

COMMENT ON COLUMN items.rarity IS 'Item rarity for D&D 5e: common, uncommon, rare, very rare, legendary, artifact';

-- =====================================================
-- 3. ADD BULK TRACKING TO PLAYERS (Pathfinder 2e)
-- =====================================================
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS bulk_capacity DECIMAL(10,2) DEFAULT NULL;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS current_bulk DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN players.bulk_capacity IS 'Maximum bulk capacity for Pathfinder 2e characters';
COMMENT ON COLUMN players.current_bulk IS 'Current bulk carried (calculated from assigned items)';

-- =====================================================
-- 4. UPDATE initialize_campaign FUNCTION
-- =====================================================
-- Update function to accept game_system parameter
CREATE OR REPLACE FUNCTION initialize_campaign(
  campaign_name VARCHAR(255),
  user_id UUID,
  game_system VARCHAR(50) DEFAULT 'pathfinder-1e'
)
RETURNS UUID AS $$
DECLARE
  new_campaign_id UUID;
BEGIN
  -- Validate game_system
  IF game_system NOT IN ('dnd-5e', 'pathfinder-1e', 'pathfinder-2e', 'other') THEN
    RAISE EXCEPTION 'Invalid game_system: %. Must be one of: dnd-5e, pathfinder-1e, pathfinder-2e, other', game_system;
  END IF;

  -- Create campaign with game system
  INSERT INTO campaigns (name, owner_id, game_system)
  VALUES (campaign_name, user_id, game_system)
  RETURNING id INTO new_campaign_id;

  -- Create party fund for this campaign
  INSERT INTO party_fund (campaign_id, gold)
  VALUES (new_campaign_id, 0);

  RETURN new_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. HELPER FUNCTION: Calculate Player Bulk (PF2e)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_player_bulk(
  p_campaign_id UUID,
  p_player_name VARCHAR(255)
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_bulk DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(bulk), 0)
  INTO total_bulk
  FROM items
  WHERE campaign_id = p_campaign_id
    AND assigned_to = p_player_name
    AND bulk IS NOT NULL;

  RETURN total_bulk;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_player_bulk IS 'Calculate total bulk for a player in Pathfinder 2e';

-- =====================================================
-- 6. HELPER FUNCTION: Count Attuned Items (D&D 5e)
-- =====================================================
CREATE OR REPLACE FUNCTION count_attuned_items(
  p_campaign_id UUID,
  p_player_name VARCHAR(255)
)
RETURNS INTEGER AS $$
DECLARE
  attuned_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO attuned_count
  FROM items
  WHERE campaign_id = p_campaign_id
    AND assigned_to = p_player_name
    AND is_attuned = true;

  RETURN attuned_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION count_attuned_items IS 'Count attuned items for a player in D&D 5e (max 3)';

-- =====================================================
-- 7. ADD INDEXES FOR NEW FIELDS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_game_system ON campaigns(game_system);
CREATE INDEX IF NOT EXISTS idx_items_requires_attunement ON items(requires_attunement) WHERE requires_attunement = true;
CREATE INDEX IF NOT EXISTS idx_items_is_attuned ON items(is_attuned) WHERE is_attuned = true;
CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity) WHERE rarity IS NOT NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- New Features Added:
-- ✓ Campaign game system selection (D&D 5e, PF1e, PF2e, Other)
-- ✓ Bulk tracking for Pathfinder 2e items and characters
-- ✓ Attunement tracking for D&D 5e items (3 max per character)
-- ✓ Rarity tracking for D&D 5e items
-- ✓ Helper functions for bulk and attunement calculations
