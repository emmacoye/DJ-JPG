# Troubleshooting Playlist Creation (403 Error)

If you're getting a 403 "Permission denied" error when trying to create a playlist, it means your Spotify token doesn't have the required permissions.

## Solution: Revoke and Re-authenticate

1. **Revoke App Access:**
   - Go to https://www.spotify.com/account/apps/
   - Find "DJ JPG" (or your app name) in the list
   - Click "Remove Access" or "Revoke Access"

2. **Clear Browser Cookies:**
   - Open your browser's developer tools (F12)
   - Go to Application/Storage → Cookies
   - Delete all cookies for `127.0.0.1:3000` or `localhost:3000`

3. **Re-authenticate:**
   - Go back to your app
   - Click "Login with Spotify"
   - **IMPORTANT:** Make sure you see the consent screen asking for permissions
   - Check ALL the boxes, especially:
     - ✅ Create, edit, and follow playlists
     - ✅ Modify your public playlists
     - ✅ Modify your private playlists
   - Click "Agree" or "Authorize"

4. **Try Creating Playlist Again:**
   - After re-authenticating, try creating a playlist again
   - It should work now!

## Why This Happens

- If you authenticated before the playlist scopes were added to the code
- If Spotify skipped the consent screen (it remembers previous authorizations)
- If you didn't grant all permissions the first time

## Required Scopes

Your app needs these scopes to create playlists:
- `playlist-modify-public`
- `playlist-modify-private`

These are included in the login request, but you must grant them when you see the consent screen.

