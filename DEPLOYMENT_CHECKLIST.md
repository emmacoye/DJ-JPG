# Vercel Deployment Checklist

Use this checklist to ensure everything is configured correctly before and after deployment.

## Pre-Deployment Checklist

- [ ] Code is pushed to GitHub (or ready for Vercel CLI)
- [ ] `.env.local` is NOT committed to git (it's in `.gitignore`)
- [ ] `npm run build` works locally without errors
- [ ] All dependencies are in `package.json`

## Vercel Setup Checklist

- [ ] Project is imported/created in Vercel
- [ ] Build settings are correct (auto-detected for Next.js)
- [ ] Environment variables are added in Vercel:
  - [ ] `SPOTIFY_CLIENT_ID`
  - [ ] `SPOTIFY_CLIENT_SECRET`
  - [ ] `OPENAI_API_KEY`
  - [ ] `SPOTIFY_REDIRECT_URI` (optional - auto-detected if not set)
- [ ] Environment variables are set for Production environment
- [ ] First deployment completed successfully

## Spotify Configuration Checklist

- [ ] Production redirect URI added to Spotify app:
  - [ ] `https://your-app-name.vercel.app/api/auth/callback`
  - [ ] Development URI still active: `http://127.0.0.1:3000/api/auth/callback`
- [ ] Spotify app settings saved

## Post-Deployment Testing Checklist

- [ ] Visit production URL: `https://your-app-name.vercel.app`
- [ ] Home page loads correctly
- [ ] "Login with Spotify" button works
- [ ] Spotify OAuth redirect works (redirects to Spotify)
- [ ] After authorizing, redirects back to app successfully
- [ ] Can upload an image
- [ ] Image analysis works (OpenAI API)
- [ ] Playlist preview generates correctly
- [ ] Can create playlist in Spotify
- [ ] Playlist appears in Spotify account

## Troubleshooting Checklist

If something doesn't work:

- [ ] Check Vercel deployment logs for errors
- [ ] Verify all environment variables are set in Vercel
- [ ] Verify Spotify redirect URI matches exactly (case-sensitive)
- [ ] Check browser console for client-side errors
- [ ] Check Vercel function logs for API route errors
- [ ] Ensure you're using HTTPS (not HTTP) for production
- [ ] Try redeploying after making changes

## Quick Reference

### Environment Variables Needed:
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
OPENAI_API_KEY=sk-your_api_key
```

### Spotify Redirect URI Format:
```
https://your-app-name.vercel.app/api/auth/callback
```

### Vercel Dashboard Locations:
- **Environment Variables:** Settings → Environment Variables
- **Deployment Logs:** Deployments → [Select deployment] → Logs
- **Function Logs:** Deployments → [Select deployment] → Functions

