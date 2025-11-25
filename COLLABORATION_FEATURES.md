# Campaign Collaboration Features

## Overview

This D20 Loot Tracker now supports multi-user collaboration! Users can invite others to their campaigns, and players can participate in multiple campaigns simultaneously without clutter.

## Key Features

- ✅ **Multi-user campaigns**: Share campaigns with friends
- ✅ **Role-based permissions**: Owner, DM, and Player roles
- ✅ **Invite system**: Send invites via email with secure tokens
- ✅ **Campaign organization**: See "My Campaigns" vs "Shared With Me"
- ✅ **Secure access**: Row-level security ensures proper permissions

## Database Schema

### Tables

#### `campaign_members`
Tracks which users have access to which campaigns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | Foreign key to campaigns |
| `user_id` | UUID | Foreign key to auth.users |
| `role` | VARCHAR(20) | owner, dm, or player |
| `invited_by` | UUID | Who invited this user |
| `joined_at` | TIMESTAMP | When they joined |

**Unique constraint**: (campaign_id, user_id) - prevents duplicate memberships

#### `campaign_invites`
Tracks pending invitations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | Which campaign |
| `inviter_id` | UUID | Who sent the invite |
| `invitee_email` | VARCHAR(255) | Email of invitee |
| `role` | VARCHAR(20) | dm or player |
| `status` | VARCHAR(20) | pending, accepted, declined, expired |
| `invite_token` | UUID | Unique token for accepting |
| `expires_at` | TIMESTAMP | Invite expiration (7 days default) |

## Role Permissions

| Action | Owner | DM | Player |
|--------|-------|----|----|
| Delete campaign | ✅ | ❌ | ❌ |
| Edit campaign settings | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ❌ | ❌ |
| Manage items | ✅ | ✅ | ❌ |
| Manage players | ✅ | ✅ | ❌ |
| Distribute gold | ✅ | ✅ | ❌ |
| View campaign | ✅ | ✅ | ✅ |
| View items | ✅ | ✅ | ✅ |
| View transactions | ✅ | ✅ | ✅ |
| Leave campaign | ❌ | ✅ | ✅ |

**Note**: Owners cannot leave their own campaigns (they must delete it or transfer ownership in future versions).

## Usage Examples

### Frontend Integration

#### 1. Fetch User's Campaigns (Owned + Member)

```javascript
// Get campaigns where user is owner
const { data: ownedCampaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('owner_id', user.id)
  .order('created_at', { ascending: false });

// Get campaigns where user is a member (including owned ones)
const { data: memberCampaigns } = await supabase
  .from('campaign_members')
  .select(`
    role,
    joined_at,
    campaigns (
      id,
      name,
      owner_id,
      game_system,
      party_fund_gets_share,
      created_at
    )
  `)
  .eq('user_id', user.id)
  .order('joined_at', { ascending: false });
```

#### 2. Display Campaigns in Selector

```javascript
// Separate owned vs shared
const myOwnedCampaigns = memberCampaigns.filter(m => m.role === 'owner');
const sharedWithMe = memberCampaigns.filter(m => m.role !== 'owner');

// Render
<section>
  <h3>My Campaigns (Owner)</h3>
  {myOwnedCampaigns.map(member => (
    <CampaignCard
      key={member.campaigns.id}
      campaign={member.campaigns}
      role={member.role}
      badge="Owner"
    />
  ))}
</section>

<section>
  <h3>Shared With Me</h3>
  {sharedWithMe.map(member => (
    <CampaignCard
      key={member.campaigns.id}
      campaign={member.campaigns}
      role={member.role}
      badge={member.role === 'dm' ? 'DM' : 'Player'}
    />
  ))}
</section>
```

#### 3. Invite a User

```javascript
// Send invite
const { data, error } = await supabase
  .from('campaign_invites')
  .insert({
    campaign_id: campaignId,
    inviter_id: currentUser.id,
    invitee_email: 'friend@example.com',
    role: 'player', // or 'dm'
    status: 'pending'
  })
  .select()
  .single();

if (data) {
  // Share the invite link with the user
  const inviteLink = `${window.location.origin}/accept-invite/${data.invite_token}`;
  console.log('Share this link:', inviteLink);
}
```

#### 4. Accept an Invite

```javascript
// When user clicks invite link, call the database function
const { data, error } = await supabase.rpc('accept_campaign_invite', {
  p_invite_token: inviteToken
});

if (data.success) {
  console.log('Joined campaign:', data.campaign_id);
  // Redirect to campaign
  navigate(`/campaign/${data.campaign_id}`);
} else {
  console.error(data.error);
}
```

#### 5. Decline an Invite

```javascript
const { data, error } = await supabase.rpc('decline_campaign_invite', {
  p_invite_token: inviteToken
});

if (data.success) {
  console.log('Invite declined');
}
```

#### 6. View Campaign Members

```javascript
const { data: members } = await supabase
  .from('campaign_members')
  .select(`
    id,
    role,
    joined_at,
    user:user_id (
      id,
      email
    ),
    invited_by_user:invited_by (
      email
    )
  `)
  .eq('campaign_id', campaignId)
  .order('role'); // Shows owner first, then dm, then player
```

#### 7. Remove a Member (Owner only)

```javascript
const { error } = await supabase
  .from('campaign_members')
  .delete()
  .eq('campaign_id', campaignId)
  .eq('user_id', memberUserId);

// Note: RLS ensures only owners can do this
```

#### 8. Leave a Campaign (DM/Player only)

```javascript
const { error } = await supabase
  .from('campaign_members')
  .delete()
  .eq('campaign_id', campaignId)
  .eq('user_id', currentUser.id);

// Note: This will fail for owners (must delete campaign instead)
```

#### 9. Check User's Role in Campaign

```javascript
// Method 1: Query campaign_members
const { data } = await supabase
  .from('campaign_members')
  .select('role')
  .eq('campaign_id', campaignId)
  .eq('user_id', currentUser.id)
  .single();

const userRole = data?.role; // 'owner', 'dm', or 'player'

// Method 2: Use the helper function
const { data: role } = await supabase.rpc('get_campaign_role', {
  p_campaign_id: campaignId,
  p_user_id: currentUser.id
});
```

#### 10. List Pending Invites for User

```javascript
// Get invites sent to current user's email
const { data: myInvites } = await supabase
  .from('campaign_invites')
  .select(`
    id,
    invite_token,
    role,
    created_at,
    expires_at,
    campaigns (
      id,
      name,
      game_system
    ),
    inviter:inviter_id (
      email
    )
  `)
  .eq('invitee_email', currentUser.email)
  .eq('status', 'pending')
  .gt('expires_at', new Date().toISOString());
```

### Realtime Subscriptions

#### Listen for New Members

```javascript
const memberChannel = supabase
  .channel('campaign-members')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'campaign_members',
      filter: `campaign_id=eq.${campaignId}`
    },
    (payload) => {
      console.log('New member joined:', payload.new);
      // Refresh member list
    }
  )
  .subscribe();
```

#### Listen for Invite Updates

```javascript
const inviteChannel = supabase
  .channel('my-invites')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'campaign_invites',
      filter: `invitee_email=eq.${currentUser.email}`
    },
    (payload) => {
      console.log('Invite update:', payload);
      // Refresh invites list
    }
  )
  .subscribe();
```

## Migration Instructions

To apply these collaboration features to your Supabase database:

1. **Open Supabase SQL Editor**:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the Migration**:
   - Copy the contents of `database_collaboration_features.sql`
   - Paste into the SQL Editor
   - Click "Run"

3. **Verify Migration**:
   ```sql
   -- Check tables were created
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('campaign_members', 'campaign_invites');

   -- Check existing campaigns have owner as member
   SELECT c.name, cm.role
   FROM campaigns c
   JOIN campaign_members cm ON c.id = cm.campaign_id
   WHERE c.owner_id = cm.user_id;
   ```

4. **Test Permissions**:
   - Create a test campaign
   - Verify you're automatically added as a member with 'owner' role
   - Try inviting another user

## Security Notes

- **Row Level Security (RLS)**: All tables enforce strict RLS policies
- **Owner Protection**: Owners cannot accidentally remove themselves or change their role
- **Invite Expiration**: Invites expire after 7 days by default
- **Email Validation**: Invites are tied to specific email addresses
- **Token Security**: Invite tokens are UUIDs, cryptographically secure

## Future Enhancements

Ideas for future versions:

- [ ] Transfer campaign ownership
- [ ] Custom role permissions
- [ ] Email notifications for invites
- [ ] Bulk invite via CSV
- [ ] Activity feed showing who changed what
- [ ] Player-specific permissions (assign items to themselves only)
- [ ] Public campaigns (discoverable)
- [ ] Campaign templates

## Troubleshooting

### "RLS policy violation" errors

Make sure the user is a member of the campaign:
```sql
SELECT * FROM campaign_members
WHERE campaign_id = 'your-campaign-id'
AND user_id = auth.uid();
```

### User can't see campaigns they were invited to

Check if they accepted the invite:
```sql
SELECT * FROM campaign_invites
WHERE invitee_email = 'their@email.com'
AND campaign_id = 'campaign-id';
```

If status is 'pending', they need to accept the invite first.

### Duplicate member errors

The (campaign_id, user_id) unique constraint prevents duplicates. This is expected behavior. Check if the user is already a member before sending invites.

## Support

For issues or questions:
- Check existing campaigns: `SELECT * FROM campaign_members WHERE user_id = auth.uid()`
- Verify RLS policies are enabled: `SELECT tablename, policies FROM pg_tables JOIN pg_policies ON tablename = tablename WHERE schemaname = 'public'`
- Review Supabase logs for detailed error messages
