# Deployment Guide

## Setting Up for Production

When deploying your DJ JPG app to production (e.g., Vercel, Netlify, etc.), follow these steps:

### 1. Add Production Redirect URI to Spotify

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications)
2. Click on your app → "Edit Settings"
3. Under "Redirect URIs", add your production URL:
   ```
   https://yourdomain.com/api/auth/callback
   ```
   Replace `yourdomain.com` with your actual domain (e.g., `djjpg.vercel.app` or your custom domain)
4. Click "Add" then "Save"

**You can have BOTH redirect URIs active:**
- `http://127.0.0.1:3000/api/auth/callback` (for local development - MUST use 127.0.0.1, not localhost!)
- `https://yourdomain.com/api/auth/callback` (for production - MUST use HTTPS)

Spotify will accept either one!

### 2. Set Environment Variables in Your Hosting Platform

#### For Vercel:
1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add these variables:
   - `SPOTIFY_CLIENT_ID` = your client ID
   - `SPOTIFY_CLIENT_SECRET` = your client secret
   - (Optional) `SPOTIFY_REDIRECT_URI` = `https://yourdomain.com/api/auth/callback`

#### For Netlify:
1. Go to Site settings → Environment variables
2. Add the same variables as above

#### For Other Platforms:
Set the environment variables in your hosting platform's dashboard.

### 3. The Code Auto-Detects Environment

The code automatically detects whether you're running locally or in production:
- **Development:** Uses `http://127.0.0.1:3000/api/auth/callback` (converts localhost to 127.0.0.1 per Spotify requirements)
- **Production:** Uses `https://yourdomain.com/api/auth/callback` (from request headers, HTTPS required)

You don't need to change any code - just make sure both redirect URIs are added to your Spotify app settings!

### 4. Verify After Deployment

1. Deploy your app
2. Visit your production URL
3. Click "Login with Spotify"
4. You should be redirected to Spotify and then back to your app

If you get a redirect URI error:
- Double-check that your production URI is added in Spotify dashboard
- Make sure it matches exactly (including `https://`)
- Verify the domain in your hosting platform matches

## Environment Variables Reference

```env
# Required
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# Optional - only set if you need to override auto-detection
SPOTIFY_REDIRECT_URI=https://yourdomain.com/api/auth/callback
```

**Note:** If `SPOTIFY_REDIRECT_URI` is not set, the code will automatically use the correct URI based on the request (localhost for dev, your domain for production).

