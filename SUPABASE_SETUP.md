# Supabase Setup Guide

This guide will help you set up Supabase for your site.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name:** nez-updates (or whatever you like)
   - **Database Password:** Choose a strong password (save it!)
   - **Region:** Choose closest to you
4. Click **"Create new project"**
5. Wait 2-3 minutes for setup to complete

## Step 2: Create Database Tables

1. Go to **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Copy and paste the contents of `supabase-schema.sql`
4. Click **"Run"** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

## Step 3: Set Up Authentication

1. Go to **Authentication** → **Providers** in the left sidebar
2. Make sure **Email** is enabled (it should be by default)
3. Go to **Authentication** → **Users**
4. Click **"Add user"** → **"Create new user"**
5. Enter:
   - **Email:** your-email@example.com
   - **Password:** your password
   - **Auto Confirm User:** Check this (so you don't need email verification)
6. Click **"Create user"**

## Step 4: Get Your API Keys

1. Go to **Settings** → **API** in the left sidebar
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## Step 5: Update Your Code

1. Open `app.js`
2. Replace these values in the `CONFIG` object:
   ```javascript
   SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
   SUPABASE_ANON_KEY: 'YOUR_ANON_KEY_HERE'
   ```
3. Save the file

## Step 6: Deploy to GitHub Pages

1. Push your code to GitHub
2. Go to your repo → **Settings** → **Pages**
3. Set **Source** to `main` branch, `/` (root)
4. Click **Save**
5. Your site will be live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`

## Step 7: Configure CORS (Optional but Recommended)

1. Go to **Settings** → **API** in Supabase
2. Under **CORS**, add your GitHub Pages URL:
   ```
   https://YOUR-USERNAME.github.io
   ```
3. Click **Save**

## That's It!

Your site should now work with Supabase:
- ✅ Public users can view posts and submit suggestions
- ✅ Only you (authenticated) can create/delete posts
- ✅ Password is managed by Supabase (secure!)
- ✅ No serverless functions needed!

## Troubleshooting

### Can't sign in
- Check that you created a user in Supabase
- Verify email/password are correct
- Check browser console for errors

### Can't create posts
- Make sure you're signed in
- Check that RLS policies are set up correctly
- Verify your anon key is correct in `app.js`

### CORS errors
- Add your GitHub Pages URL to Supabase CORS settings
- Make sure your Supabase URL and key are correct

## Security Notes

✅ **Secure:** 
- Your Supabase anon key is safe to expose (designed for client-side use)
- Row Level Security (RLS) protects your data
- Only authenticated users can write/delete
- Password is managed securely by Supabase

🔑 **Password Management:**
- Change password: Go to Supabase dashboard → Authentication → Users → Edit user
- Reset password: Use Supabase's built-in password reset (can be configured in Auth settings)
- All password management is handled by Supabase (no custom code needed!)

