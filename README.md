# A Quiet Place to Post

A minimal, poetic website for sharing updates. Built with HTML, CSS, JavaScript, and Supabase.

---

## Setup (10 minutes)

### 1. Create your Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **"New Project"**
3. Fill in:
   - **Name:** nez-updates (or whatever you like)
   - **Database Password:** Choose a strong password (save it!)
   - **Region:** Choose closest to you
4. Click **"Create new project"**
5. Wait 2-3 minutes for setup to complete

### 2. Set Up Database Tables

1. In Supabase, go to **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Copy and paste the contents of `supabase-schema.sql`
4. Click **"Run"** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

### 3. Create Your User Account

1. Go to **Authentication** → **Users** in Supabase
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - **Email:** your-email@example.com
   - **Password:** your password
   - **Auto Confirm User:** Check this (so you don't need email verification)
4. Click **"Create user"**

### 4. Get Your API Keys

1. Go to **Settings** → **API** in Supabase
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### 5. Configure the Site

Open `app.js` and update these values at the top:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
    SUPABASE_ANON_KEY: 'YOUR_ANON_KEY_HERE'
};
```

### 6. Deploy

1. Push your code to GitHub
2. Go to your repo → **Settings** → **Pages**
3. Set **Source** to `main` branch, `/` (root)
4. Click **Save**
5. Your site will be live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`

### 7. Configure CORS (Optional but Recommended)

1. Go to **Settings** → **API** in Supabase
2. Under **CORS**, add your GitHub Pages URL:
   ```
   https://YOUR-USERNAME.github.io
   ```
3. Click **Save**

---

## Usage

- Visit your site to read posts (public)
- Click **"offline"** → enter your email/password → write and post
- Posts appear immediately, newest first
- Click **delete** on any post (when signed in) to remove it
- Anyone can submit suggestions (you approve them when signed in)
- Click the heart icon (♡) to like posts (one like per user per post)
- **Letterboxd Integration:** In the admin tab, enter a Letterboxd profile URL to fetch and display film reviews in your feed

---

## Files

```
index.html           — the page
styles.css           — the look
app.js               — the logic
supabase-schema.sql  — database schema
manifest.json        — PWA manifest
service-worker.js    — offline support
icon-192.png         — app icon (192x192)
icon-512.png         — app icon (512x512)
```

## Installing as PWA

### iOS (iPhone/iPad)
1. Open the site in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Customize the name if desired
5. Tap "Add"

### Android/Desktop
1. Look for the install prompt in your browser
2. Or use browser menu → "Install App" / "Add to Home Screen"

**Note:** You'll need to create icon files (192x192 and 512x512 pixel PNG images) for the app icons. Update `manifest.json` and `index.html` with your icon filenames.

## Features

- **Real-time updates:** Posts and suggestions update automatically without page refresh
- **Likes:** Users can like posts (one like per user per post, tracked in browser)
- **Tags:** Add tags to posts for organization
- **Suggestions:** Public users can submit suggestions for approval
- **Letterboxd Integration:** Fetch and display film reviews from Letterboxd profiles
- **Playlist:** Background music/playlist support (YouTube, Spotify, SoundCloud)
- **PWA:** Install as a Progressive Web App on mobile devices

## Security

✅ **Secure:** Your Supabase anon key is safe to expose (designed for client-side use)  
✅ **Protected:** Row Level Security (RLS) ensures only authenticated users can write  
✅ **Managed:** Password authentication is handled securely by Supabase  
✅ **Likes Security:** Secure database function prevents public users from modifying post data (only likes column can be updated)  

## Troubleshooting

- **Can't sign in:** Check that you created a user in Supabase and verify email/password
- **Can't create posts:** Make sure you're signed in and RLS policies are set up correctly
- **CORS errors:** Add your GitHub Pages URL to Supabase CORS settings

For detailed setup instructions, see `SUPABASE_SETUP.md`.
