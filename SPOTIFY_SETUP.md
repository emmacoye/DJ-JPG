# Spotify Web API Setup Guide

## Step 1: Get Your Spotify Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications)
2. Log in with your Spotify account
3. Click **"Create app"**
4. Fill in the app details:
   - **App name**: DJ JPG (or any name you prefer)
   - **App description**: Turn photos into Spotify playlists
   - **Redirect URI**: `http://localhost:3000/api/auth/callback`
   - Check the box: **"I understand and agree..."**
5. Click **"Save"**
6. You'll see your **Client ID** and **Client Secret**

## Step 2: Create .env.local File

Create a file named `.env.local` in the root of your project (`/Users/emmasmacbook/DJJPG/.env.local`) with the following content:

```env
# Spotify Web API Credentials
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Optional: Spotify OAuth Redirect URI
# If not set, the code will auto-detect based on the request (127.0.0.1 for dev, your domain for production)
# Note: Spotify requires 127.0.0.1 (not localhost) for loopback addresses
# SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
```

**Replace:**
- `your_client_id_here` with your actual Client ID from Spotify
- `your_client_secret_here` with your actual Client Secret from Spotify

## Step 3: Add Redirect URIs to Spotify App

**Important:** Spotify allows you to add multiple redirect URIs for development and production!

In your Spotify app settings, add BOTH:

1. **Development URI (use 127.0.0.1, not localhost - Spotify requirement):**
   ```
   http://127.0.0.1:3000/api/auth/callback
   ```
   
   **Important:** Spotify does NOT allow `localhost` as a redirect URI. You MUST use the explicit IP address `127.0.0.1` instead.

2. **Production URI** (when you deploy):
   ```
   https://yourdomain.com/api/auth/callback
   ```
   Replace `yourdomain.com` with your actual production domain.

**How to add multiple URIs:**
1. Go to your Spotify app settings
2. Under "Redirect URIs", click "Add"
3. Add the development URI: `http://127.0.0.1:3000/api/auth/callback` (NOT localhost!)
4. Click "Add" again
5. Add your production URI: `https://yourdomain.com/api/auth/callback`
6. Click "Save"

The code will automatically detect which environment you're in and use the correct URI!

## Step 4: Test the Authentication

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000`
3. Click the "Login with Spotify" button
4. You should be redirected to Spotify's authorization page
5. After authorizing, you'll be redirected back to your app

## What Was Set Up

✅ **API Routes Created:**
- `/api/auth/login` - Initiates Spotify OAuth flow
- `/api/auth/callback` - Handles OAuth callback and stores tokens
- `/api/auth/refresh` - Refreshes expired access tokens

✅ **Spotify Web API Node Package:** Installed and ready to use

✅ **Login Button:** Updated to link to the auth endpoint

✅ **Utility Functions:** Created in `lib/spotify.ts` for easy API usage

## Using the Spotify API in Your Code

### In API Routes:

```typescript
import { getSpotifyApi } from '@/lib/spotify';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const spotifyApi = getSpotifyApi(req);
    
    // Example: Get user's playlists
    const playlists = await spotifyApi.getUserPlaylists();
    
    return res.json({ playlists: playlists.body });
  } catch (error: any) {
    return res.status(401).json({ error: error.message });
  }
}
```

### Example: Creating a Playlist

```typescript
const spotifyApi = getSpotifyApi(req);
const me = await spotifyApi.getMe();

// Create a new playlist
const playlist = await spotifyApi.createPlaylist(me.body.id, 'My New Playlist', {
  description: 'Created from DJ JPG',
  public: true,
});

// Add tracks to playlist
await spotifyApi.addTracksToPlaylist(playlist.body.id, ['spotify:track:4iV5W9uYEdYUVa79Axb7Rh']);
```

## Security Notes

- ⚠️ **Never commit `.env.local` to git** - It's already in `.gitignore`
- ⚠️ **Never expose your Client Secret** in client-side code
- ✅ Access tokens are stored in httpOnly cookies for security
- ✅ Refresh tokens are stored securely with 7-day expiration

## Troubleshooting

**Error: "Spotify Client ID not configured"**
- Make sure `.env.local` exists in the project root
- Verify the environment variable names match exactly
- Restart your development server after creating `.env.local`

**Error: "redirect_uri_mismatch"**
- Verify the Redirect URI in your Spotify app settings matches exactly
- Check for trailing slashes or http vs https issues

**Tokens expired?**
- The refresh token endpoint at `/api/auth/refresh` will automatically refresh your access token
- Access tokens expire after 1 hour, but refresh tokens last longer

## Next Steps

- Create a dashboard page (`/pages/dashboard.tsx`) to show user info after login
- Build the photo upload and AI analysis features
- Use the Spotify API to create playlists based on photo moods

