# Besmara's Loot Tracker 🏴‍☠️

A real-time collaborative loot tracker for Pathfinder 1e campaigns with user authentication, multi-campaign support, and flexible gold distribution.

![Pathfinder 1e](https://img.shields.io/badge/Pathfinder-1e-blue)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ What's New in V2

- 🔐 **User Authentication** - Secure email/password login
- 📚 **Multiple Campaigns** - Manage multiple campaigns per user
- ⚙️ **Party Fund Toggle** - Choose whether party fund gets a share (x vs x+1 split)
- 💎 **Flexible Item Selling** - Sell from inventory with "Split to All" or "Keep for Player" options
- 📱 **Mobile Responsive** - Enhanced mobile experience
- 🔒 **Data Isolation** - Row Level Security ensures complete data privacy

## Features

### 🔐 Authentication & Campaign Management
- **User Accounts**: Secure email/password authentication
- **Multiple Campaigns**: Create and switch between different campaigns
- **Data Privacy**: Your campaigns are completely isolated from other users
- **Campaign Settings**: Customizable gold distribution rules per campaign

### 📦 Loot Management
- **Incoming Loot**: Add items as you find them
- **Treasure vs Loot**: Treasure sells at 100%, loot at 50%
- **Bulk Import**: Paste formatted loot lists for quick entry
- **Smart Assignment**: Assign items to players or party fund
- **Flexible Selling**: Choose to split gold or keep it for the selling player

### 💰 Gold Tracking
- **Individual Player Gold**: Track each player's wealth
- **Party Fund**: Shared gold pool for group expenses
- **Party Fund Toggle**: Control whether party fund gets a share of sold loot
- **Transaction Log**: Complete history of all gold movements
- **Manual Adjustments**: Edit gold values with automatic logging

### 🎒 Inventory System
- **Per-Player Inventories**: Each player has their own inventory
- **Party Inventory**: Shared party items
- **Item Transfer**: Move items between players
- **Buy Items**: Purchase items from shops with player or party gold
- **Consumables Tab**: Track items with charges
- **Charge Tracking**: Increment/decrement item charges
- **Smart Selling**: Sell from inventory with two options:
  - **Split to All**: Distribute gold to all players (and party fund if enabled)
  - **Player Only**: Give all gold to the selling player

### ⚡ Real-Time Collaboration
- **Live Updates**: See changes instantly across all users
- **Multi-User Support**: 2-10+ players simultaneously
- **Automatic Sync**: Items, gold, transactions all sync in real-time
- **Conflict Prevention**: Database constraints prevent data corruption

## Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- A Supabase account (free tier works great!)

### 2. Clone & Install
```bash
git clone https://github.com/connorprovines-code/besmaras-loot-tracker-external.git
cd besmaras-loot-tracker-external
npm install
```

### 3. Set Up Supabase

#### Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **API**
4. Copy your **Project URL** and **anon public key**

#### Enable Authentication
1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional)

#### Create Environment File
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### Run Database Setup
1. In Supabase, go to **SQL Editor**
2. Run the SQL from `database_setup_v2.sql` (creates tables with authentication)
3. This sets up:
   - User authentication schema
   - Campaigns table
   - Row Level Security policies
   - All required tables

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` 🎉

### 5. Create Your First Campaign
1. Sign up with your email and password
2. Click "Create New Campaign"
3. Enter your campaign name
4. Start tracking loot!

## Database Schema

The app creates these tables:

- **campaigns**: Campaign data with owner_id and settings
- **players**: Player names and gold amounts (per campaign)
- **party_fund**: Shared party gold (per campaign)
- **items**: All loot items (incoming, assigned, sold, etc.)
- **transactions**: Complete transaction history
- **auth.users**: Supabase authentication table (managed automatically)

See `database_setup_v2.sql` for full schema with RLS policies.

## Party Fund Toggle

**Location:** Settings Tab → Gold Distribution

### How It Works

- **Toggle ON (Default)**: Party fund receives a share of sold loot
  - Gold splits: (number of players + 1)
  - Example: 3 players, 100gp → Each player gets 25gp, Party Fund gets 25gp

- **Toggle OFF**: Only players receive shares
  - Gold splits: (number of players)
  - Example: 3 players, 100gp → Each player gets 33gp, Party Fund gets nothing

### When to Use Each Setting

**Toggle ON** - Best for:
- Groups with shared expenses (ship repairs, supplies, etc.)
- Campaigns where the party needs a communal fund
- Traditional loot-sharing parties

**Toggle OFF** - Best for:
- Individual-focused gameplay
- When players manage their own expenses
- Parties that don't pool resources

## Flexible Item Selling

When selling items from a player's inventory, choose:

### Split Gold to All
- Gold is distributed to all players
- Party fund gets a share if toggle is ON
- Best for: Party-owned items, fair distribution

### Give Gold to Player Only
- The selling player keeps all the gold
- Great for: Personal items, individual profits
- Party fund doesn't get a share even if toggle is ON

## Migration from V1

**Upgrading from the old version?** See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed instructions.

## Real-Time Setup

Real-time collaboration is **enabled by default**. To use it:

1. Run `database_setup_v2.sql` in Supabase
2. Open the app in multiple browsers
3. Changes sync automatically!

### Kill Switch
To disable real-time, edit `src/App.jsx`:
```javascript
const ENABLE_REALTIME = false; // Change to false
```

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

### Netlify
```bash
npm run build
# Drag and drop the `dist` folder to Netlify
```

### Future: Android App
The codebase is ready for Capacitor integration! See the Capacitor setup todo for converting this to an Android app.

## Configuration

### Gold Distribution
When selling loot:
- Treasure: 100% of value
- Loot: 50% of value
- Distribution: Configurable via Party Fund Toggle

### Gold Split Examples

**3 Players, Party Fund Toggle ON, 100gp Treasure:**
- Each player: 25gp
- Party Fund: 25gp
- Total shares: 4

**3 Players, Party Fund Toggle OFF, 100gp Treasure:**
- Each player: 33gp
- Party Fund: 0gp
- Total shares: 3

## Usage Tips

### Setting Up Your Campaign
1. Sign up / Log in
2. Create a campaign with a descriptive name
3. Go to Settings and add your players
4. Configure Party Fund toggle based on your group's needs

### Managing Multiple Campaigns
- Click "Campaigns" in header to switch
- Each campaign has its own:
  - Players
  - Items
  - Gold totals
  - Transaction history
  - Settings

### Selling From Inventory
1. Go to a player's inventory
2. Click "Sell" on any item
3. Choose your distribution method:
   - **Split to All**: Fair distribution
   - **Player Only**: Player keeps profit

### Bulk Import
Format: `* [quantity] [item name] = [price per unit] gp`
```
* 4 mwk breastplate = 700 gp
* 10 crossbow bolts = 0.5 gp
* 1 spellbook = 7.5 gp
```

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-Time**: Supabase Realtime (WebSockets)
- **Security**: Row Level Security (RLS)
- **Icons**: Lucide React

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Troubleshooting

### Authentication Issues
- ✓ Check Email provider is enabled in Supabase
- ✓ Verify environment variables are set
- ✓ Clear browser cache/cookies

### Real-Time Not Working?
- ✓ Run `database_setup_v2.sql`
- ✓ Check Supabase Realtime is enabled
- ✓ Verify `ENABLE_REALTIME = true`
- ✓ Check browser console for errors

### Database Errors?
- ✓ Run `database_setup_v2.sql` first
- ✓ Check Row Level Security policies
- ✓ Verify you're logged in
- ✓ Confirm campaign_id exists in queries

### Build Errors?
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Security

- **Row Level Security**: All tables protected with RLS policies
- **User Isolation**: Users can only access their own campaigns
- **Secure Authentication**: Handled by Supabase Auth
- **Data Privacy**: Complete separation between campaigns

## License

MIT License - feel free to use this for your own campaigns!

## Credits

Built for Pathfinder 1e campaigns. Perfect for Skull & Shackles, Serpent's Skull, or any adventure!

**Besmara's blessing upon your plunder!** 🏴‍☠️⚔️💰

---

## Links

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Issue Tracker](https://github.com/connorprovines-code/besmaras-loot-tracker-external/issues)
- [Supabase](https://supabase.com)
- [Pathfinder 1e SRD](https://www.d20pfsrd.com)
