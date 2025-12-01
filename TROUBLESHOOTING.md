# Troubleshooting Guide

## INVALID_CLIENT: Invalid redirect URI

This error means the redirect URI in your code doesn't match what's registered in your Spotify app settings.

### Quick Fix Steps:

1. **Check what redirect URI is being used:**
   - Click the login button and check your terminal/console
   - You'll see a log like: `Using Redirect URI: http://localhost:3000/api/auth/callback`

2. **Add the EXACT URI to Spotify Dashboard:**
   - Go to https://developer.spotify.com/dashboard/applications
   - Click on your app
   - Click "Edit Settings"
   - Under "Redirect URIs", add: `http://127.0.0.1:3000/api/auth/callback`
   - **Important:** It must match EXACTLY:
     - ✅ Use `http://` (not `https://`) for loopback (127.0.0.1)
     - ✅ Use `127.0.0.1` (NOT `localhost` - Spotify requirement!)
     - ✅ No trailing slash at the end
     - ✅ Must be lowercase
     - ✅ Must include the full path: `/api/auth/callback`
   - Click "Add" then "Save"

3. **Common Mistakes:**
   - ❌ `http://localhost:3000/api/auth/callback` (Spotify doesn't allow localhost - must use 127.0.0.1)
   - ❌ `https://127.0.0.1:3000/api/auth/callback` (should be `http://` for loopback)
   - ❌ `http://127.0.0.1:3000/api/auth/callback/` (trailing slash)
   - ❌ `http://127.0.0.1:3000/` (missing path)

4. **If using a custom redirect URI in `.env.local`:**
   - Make sure `SPOTIFY_REDIRECT_URI` in `.env.local` matches EXACTLY what's in Spotify dashboard
   - After changing `.env.local`, restart your dev server

5. **After making changes:**
   - Save settings in Spotify dashboard
   - Restart your Next.js dev server
   - Try logging in again

### Verify Your Setup:

Check your `.env.local` file has:
```env
SPOTIFY_CLIENT_ID=your_actual_client_id
SPOTIFY_CLIENT_SECRET=your_actual_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
```

**Important:** If you set `SPOTIFY_REDIRECT_URI` manually, use `127.0.0.1` NOT `localhost` (Spotify requirement).

The code will auto-detect and use `http://127.0.0.1:3000/api/auth/callback` for development if you don't set `SPOTIFY_REDIRECT_URI` in `.env.local`.

