# Migration Guide - V1 to V2

This guide will help you migrate from the old single-campaign version to the new multi-user, multi-campaign version with authentication.

## What's Changed

### Major Features Added
1. **User Authentication** - Email/password login system
2. **Multiple Campaigns** - Each user can create and manage multiple campaigns
3. **Party Fund Toggle** - Choose whether party fund gets a share of gold (x vs x+1 split)
4. **Per-Item Sell Options** - Sell from inventory with "Split to All" or "Keep for Player" options
5. **Mobile Responsive** - Enhanced mobile experience
6. **Data Isolation** - Row Level Security ensures users only see their own data

### Removed Features
- **Crew Management** - The crew tab and wage system have been removed

## Database Migration

### Step 1: Backup Your Current Data

Before starting, **export your current data** from Supabase:

```sql
-- Export all your current data
SELECT * FROM players;
SELECT * FROM items;
SELECT * FROM party_fund;
SELECT * FROM transactions;
```

### Step 2: Run the New Database Schema

1. Go to your Supabase SQL Editor
2. Run the contents of `database_setup_v2.sql`
3. This will create:
   - `campaigns` table
   - Updated `players`, `party_fund`, `items`, `transactions` tables with `campaign_id`
   - Row Level Security policies
   - Helper function `initialize_campaign()`

### Step 3: Migrate Your Data (Optional)

If you want to preserve your existing data:

```sql
-- Create a user (you'll need to sign up through the app first to get a user_id)
-- Then run this to get your user ID:
SELECT id FROM auth.users WHERE email = 'your@email.com';

-- Create a campaign for your existing data
SELECT initialize_campaign('My Campaign', 'YOUR_USER_ID_HERE');

-- Get the campaign ID
SELECT id FROM campaigns WHERE name = 'My Campaign';

-- Migrate existing data (replace CAMPAIGN_ID with your campaign ID)
UPDATE players SET campaign_id = 'CAMPAIGN_ID';
UPDATE party_fund SET campaign_id = 'CAMPAIGN_ID';
UPDATE items SET campaign_id = 'CAMPAIGN_ID';
UPDATE transactions SET campaign_id = 'CAMPAIGN_ID';
```

### Step 4: Enable Authentication in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable **Email** provider
3. Configure email templates (optional)
4. Set up redirect URLs if needed

### Step 5: Update Environment Variables

Your `.env` file should have:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## New Features Guide

### Party Fund Toggle

**Location:** Settings Tab

**What it does:**
- **ON (default)**: Gold splits (players + 1) ways - party fund gets a share
- **OFF**: Gold splits (players) ways - only players get shares

**Example:**
- 3 players, 100gp loot
- Toggle ON: Each player + party fund gets 25gp (4 shares)
- Toggle OFF: Each player gets 33gp (3 shares)

### Per-Item Sell Options

**Location:** Player Inventories

**When selling an item from a player's inventory:**

1. **Split Gold to All** - Gold is distributed to all players (and party fund if toggle is ON)
   - Example: Item worth 100gp, 3 players
   - Each player gets 33gp (or 25gp if party fund is ON)

2. **Give Gold to Player Only** - The selling player keeps all the gold
   - Example: Item worth 100gp
   - Player who sold it gets 100gp

### Campaign Management

**Creating Campaigns:**
1. Log in
2. Click "Create New Campaign"
3. Enter campaign name
4. Click "Create"

**Switching Campaigns:**
1. Click "Campaigns" button in header
2. Select a different campaign
3. Your data is isolated per campaign

## Troubleshooting

### "Row Level Security policy violation"
- Make sure you're logged in
- Verify RLS policies are set up correctly
- Check that campaign_id exists in all queries

### Authentication Issues
- Clear browser cache and cookies
- Check that Email provider is enabled in Supabase
- Verify environment variables are set

### Missing Data After Migration
- Verify campaign_id was set for all records
- Check RLS policies allow access
- Confirm you're logged in with the correct user

## Need Help?

If you encounter issues during migration:
1. Check the browser console for error messages
2. Review Supabase logs in the Dashboard
3. Verify all SQL scripts ran successfully
4. Make sure authentication is properly configured

## Rollback (If Needed)

If you need to revert to the old version:

```bash
git checkout HEAD~1
```

Then restore your database from the backup you created in Step 1.
