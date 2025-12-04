# Authentication & Security

This document explains how authentication and security work in this application.

## Overview

Authentication is handled entirely by **Supabase**, a secure backend-as-a-service platform. The system provides:
- ✅ Secure password authentication (managed by Supabase)
- ✅ Session management (automatic)
- ✅ Row Level Security (RLS) for data protection
- ✅ No passwords stored in client-side code

## How It Works

### Authentication Flow

1. **User enters email/password** → Sent to Supabase (over HTTPS)
2. **Supabase verifies credentials** → Checks against their secure user database
3. **Supabase returns session** → Stored automatically in browser (secure cookies/localStorage)
4. **Subsequent requests** → Include session token automatically
5. **Row Level Security** → Supabase enforces that only authenticated users can write

### Password Storage

- **All passwords** are stored securely by Supabase (hashed and encrypted)
- **No passwords** are ever stored in your code or client-side
- **Password management** is handled entirely by Supabase's secure system

### Session Management

- Sessions are managed automatically by Supabase
- Sessions persist across browser sessions (until you sign out)
- Sessions are validated server-side on every request
- Signing out invalidates the session immediately

## Password Management

### Change Password

Password changes are handled through Supabase:

1. Go to Supabase dashboard → **Authentication** → **Users**
2. Find your user and click **Edit**
3. Update the password
4. Or use Supabase's password reset flow (can be configured in Auth settings)

### Reset Password (If Forgotten)

Supabase provides built-in password reset:

1. Configure password reset in Supabase: **Authentication** → **Email Templates**
2. Users can request password reset (if you enable this feature)
3. Reset link is sent via email
4. Or manually reset in Supabase dashboard

## Security Features

✅ **No passwords in client code** - Everything handled by Supabase  
✅ **Secure password storage** - Supabase uses industry-standard hashing/encryption  
✅ **Session security** - Sessions are cryptographically signed  
✅ **Row Level Security** - Database-level protection ensures only authenticated users can write  
✅ **HTTPS only** - All communication is encrypted  

## Row Level Security (RLS)

The database uses Row Level Security policies:

- **Public read:** Anyone can read posts and suggestions
- **Authenticated write:** Only signed-in users can create/delete posts
- **Public suggestions:** Anyone can submit suggestions
- **Authenticated moderation:** Only signed-in users can delete suggestions

These policies are enforced at the database level, so even if someone tries to bypass your frontend code, they cannot modify data without authentication.

## Important Notes

⚠️ **Supabase anon key:** The anon key in `app.js` is safe to expose publicly. It's designed for client-side use and is protected by RLS policies.

⚠️ **Password security:** All password management is handled by Supabase. Never store passwords in your code or environment variables.

⚠️ **Session security:** Sessions are automatically managed. Users stay signed in until they explicitly sign out or the session expires.

## Architecture

```
GitHub Pages (Static HTML/JS)
    ↓
Supabase Client Library (in browser)
    ↓
Supabase Backend (secure server)
    ├── Authentication Service
    ├── Database (Postgres with RLS)
    └── API Gateway
```

This architecture ensures:
- No serverless functions needed
- No API keys to manage (anon key is public-safe)
- No password storage in your code
- All security handled by Supabase's proven infrastructure
