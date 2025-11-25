# D20 Loot Tracker - Database Setup Instructions

## Overview
This guide will help you set up the database for the D20 Loot Tracker application in the correct order.

## Prerequisites
- A Supabase project created
- Access to the Supabase SQL Editor

## Setup Steps

### 1. Run SQL Migrations in Order

Execute the following SQL files in your Supabase SQL Editor **in this exact order**:

#### Step 1: Base Database Schema
```
database_setup_v2.sql
```
This creates:
- Core tables (campaigns, players, items, party_fund, transactions)
- Basic RLS policies
- initialize_campaign function

#### Step 2: Game System Support
```
database_migration_campaign_systems.sql
```
This adds:
- game_system column to campaigns table
- Support for D&D 5e, Pathfinder 1e/2e, and other systems
- Updated initialize_campaign function with game_system parameter

#### Step 3: Collaboration Features
```
database_collaboration_features.sql
```
This creates:
- campaign_members table (multi-user support)
- campaign_invites table (invitation system)
- Updated RLS policies for collaborative access
- Helper functions for invite workflow
- Trigger to auto-add campaign owners as members

#### Step 4: Additional Constraints
```
database_constraints.sql
```
This adds:
- Data validation constraints
- Additional security checks

#### Step 5: Missing Functions (REQUIRED)
```
database_missing_functions.sql
```
This creates:
- get_user_campaigns function (critical for campaign selector to work)

## Verification

After running all migrations, verify the setup by running:

```sql
-- Check if all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'campaigns',
  'players',
  'items',
  'party_fund',
  'transactions',
  'campaign_members',
  'campaign_invites'
);

-- Check if critical functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'initialize_campaign',
  'get_user_campaigns',
  'accept_campaign_invite',
  'decline_campaign_invite',
  'is_campaign_member',
  'get_campaign_role'
);
```

## Troubleshooting

### Issue: "function get_user_campaigns does not exist"
**Solution:** Make sure you ran `database_missing_functions.sql`

### Issue: "relation campaign_members does not exist"
**Solution:** Make sure you ran `database_collaboration_features.sql`

### Issue: Invite/Manage/Edit/Delete buttons give errors
**Possible causes:**
1. Missing `get_user_campaigns` function - run `database_missing_functions.sql`
2. RLS policies not properly configured - re-run `database_collaboration_features.sql`
3. User not added as campaign member - check the campaign_members table

### Issue: Can't create campaigns
**Solution:** Make sure the trigger `trigger_add_campaign_owner_as_member` exists:
```sql
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'campaigns';
```

## Authentication Setup

1. In Supabase Dashboard, go to **Authentication > Providers**
2. Enable **Email** provider
3. Configure email templates (optional but recommended)

## Realtime Setup

Make sure the following tables are enabled for realtime:
- campaigns
- players
- items
- party_fund
- transactions
- campaign_members
- campaign_invites

To enable realtime in Supabase:
1. Go to **Database > Replication**
2. Enable replication for each table listed above

## Next Steps

Once the database is set up:
1. Update your `.env` or environment configuration with Supabase credentials
2. Test the application by creating a campaign
3. Test collaboration features by inviting another user
