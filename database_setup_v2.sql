-- =====================================================
-- Besmara's Loot Tracker - Database Setup V2
-- Multi-User with Authentication & Campaign Support
-- =====================================================
-- Run this SQL in your Supabase SQL editor

-- =====================================================
-- 1. CAMPAIGNS TABLE
-- =====================================================
-- Each user can create/manage multiple campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party_fund_gets_share BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Policies for campaigns
CREATE POLICY "Users can view their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = owner_id);

-- =====================================================
-- 2. PLAYERS TABLE (Updated)
-- =====================================================
CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  gold INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, name),
  CONSTRAINT players_gold_positive CHECK (gold >= 0)
);

-- Enable RLS on players
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Policies for players
CREATE POLICY "Users can manage players in their campaigns"
  ON players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = players.campaign_id
      AND campaigns.owner_id = auth.uid()
    )
  );

-- =====================================================
-- 3. PARTY FUND TABLE (Updated)
-- =====================================================
CREATE TABLE IF NOT EXISTS party_fund (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE UNIQUE,
  gold INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT party_fund_gold_positive CHECK (gold >= 0)
);

-- Enable RLS on party_fund
ALTER TABLE party_fund ENABLE ROW LEVEL SECURITY;

-- Policies for party_fund
CREATE POLICY "Users can manage party fund in their campaigns"
  ON party_fund FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = party_fund.campaign_id
      AND campaigns.owner_id = auth.uid()
    )
  );

-- =====================================================
-- 4. ITEMS TABLE (Updated)
-- =====================================================
CREATE TABLE IF NOT EXISTS items (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  original_value DECIMAL(10, 2),
  is_treasure BOOLEAN NOT NULL DEFAULT false,
  charges INTEGER,
  consumable BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'incoming',
  assigned_to VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on items
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policies for items
CREATE POLICY "Users can manage items in their campaigns"
  ON items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = items.campaign_id
      AND campaigns.owner_id = auth.uid()
    )
  );

-- =====================================================
-- 5. TRANSACTIONS TABLE (Updated)
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  affected_parties TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies for transactions
CREATE POLICY "Users can manage transactions in their campaigns"
  ON transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = transactions.campaign_id
      AND campaigns.owner_id = auth.uid()
    )
  );

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_players_campaign ON players(campaign_id);
CREATE INDEX IF NOT EXISTS idx_party_fund_campaign ON party_fund(campaign_id);
CREATE INDEX IF NOT EXISTS idx_items_campaign ON items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_assigned_to ON items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_transactions_campaign ON transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- =====================================================
-- 7. UPDATED_AT TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_party_fund_updated_at
  BEFORE UPDATE ON party_fund
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. REALTIME PUBLICATION
-- =====================================================
-- Enable real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE party_fund;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- =====================================================
-- 9. HELPER FUNCTION: Initialize Campaign
-- =====================================================
-- This function creates a campaign with initial party_fund
CREATE OR REPLACE FUNCTION initialize_campaign(
  campaign_name VARCHAR(255),
  user_id UUID
)
RETURNS UUID AS $$
DECLARE
  new_campaign_id UUID;
BEGIN
  -- Create campaign
  INSERT INTO campaigns (name, owner_id)
  VALUES (campaign_name, user_id)
  RETURNING id INTO new_campaign_id;

  -- Create party fund for this campaign
  INSERT INTO party_fund (campaign_id, gold)
  VALUES (new_campaign_id, 0);

  RETURN new_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- Next steps:
-- 1. Enable Email Auth in Supabase Dashboard (Authentication > Providers)
-- 2. Configure email templates (optional)
-- 3. Update your application code to use campaign_id
