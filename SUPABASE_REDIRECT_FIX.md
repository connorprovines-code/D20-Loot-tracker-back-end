# Fixing Supabase Redirect URL

## Problem
After email confirmation, users are being redirected to `http://localhost:3000` instead of your deployed app.

## Solution

### Step 1: Go to Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: `xmtjdeidlupsqipywkwt`

### Step 2: Configure Redirect URLs
1. Click **Authentication** in the left sidebar
2. Click **URL Configuration**
3. Update the following fields:

**Site URL:** (Your production URL)
```
https://your-app-name.vercel.app
```
OR if using a custom domain:
```
https://yourdomain.com
```

**Redirect URLs:** (Add these URLs - one per line)
```
https://your-app-name.vercel.app/**
http://localhost:5173/**
http://localhost:3000/**
```

### Step 3: Save Changes
Click **Save** at the bottom of the page.

### Step 4: Test
1. Sign up with a new email
2. Click the confirmation link
3. You should now be redirected to your production app instead of localhost

## Finding Your Vercel URL

If you don't know your Vercel URL:
1. Go to https://vercel.com/dashboard
2. Find your loot tracker project
3. Click on it
4. Look for the **Domains** section
5. Copy the URL (usually `something.vercel.app`)

## Notes
- The `/**` wildcard allows redirects to any path in your app
- You can add multiple URLs for different environments (staging, production, etc.)
- Changes take effect immediately
