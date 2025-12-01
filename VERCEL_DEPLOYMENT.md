# Vercel Deployment Guide for DJ JPG

This guide will help you deploy your DJ JPG application to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your Spotify App credentials (Client ID and Client Secret)
3. Your OpenAI API key
4. A GitHub account (recommended for easy deployment)

## Step 1: Prepare Your Code

### 1.1 Ensure .env.local is in .gitignore

Your `.env.local` file should already be ignored (it's in `.gitignore`). Never commit API keys to git!

### 1.2 Verify Your Code is Ready

- ✅ All dependencies are in `package.json`
- ✅ No hardcoded API keys or secrets
- ✅ Build script works: `npm run build`

## Step 2: Deploy to Vercel

### Option A: Deploy via GitHub (Recommended)

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings

3. **Configure Build Settings:**
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```
   Follow the prompts. For production, run:
   ```bash
   vercel --prod
   ```

## Step 3: Configure Environment Variables

**CRITICAL:** You must add these environment variables in Vercel before your app will work!

### 3.1 Add Environment Variables in Vercel

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

#### Required Variables:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
OPENAI_API_KEY=sk-your_openai_api_key_here
```

#### Optional Variable (Auto-detected if not set):

```
SPOTIFY_REDIRECT_URI=https://your-domain.vercel.app/api/auth/callback
```

**Note:** If you don't set `SPOTIFY_REDIRECT_URI`, the app will auto-detect it from the request headers. However, you can set it explicitly if you prefer.

### 3.2 Environment Variable Settings

For each variable, set it for:
- ✅ **Production**
- ✅ **Preview** (optional, but recommended)
- ✅ **Development** (optional, for Vercel dev)

## Step 4: Update Spotify App Settings

**IMPORTANT:** You must add your Vercel URL to Spotify's allowed redirect URIs!

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications)
2. Click on your app → **"Edit Settings"**
3. Under **"Redirect URIs"**, add:
   ```
   https://your-app-name.vercel.app/api/auth/callback
   ```
   Replace `your-app-name` with your actual Vercel app name.

4. **Keep both URIs active:**
   - `http://127.0.0.1:3000/api/auth/callback` (for local development)
   - `https://your-app-name.vercel.app/api/auth/callback` (for production)

5. Click **"Add"** then **"Save"**

## Step 5: Deploy and Verify

1. **Trigger a new deployment:**
   - If using GitHub: Push a new commit or redeploy from Vercel dashboard
   - If using CLI: Run `vercel --prod`

2. **Wait for deployment to complete**
   - Check the deployment logs for any errors

3. **Test your deployment:**
   - Visit your Vercel URL: `https://your-app-name.vercel.app`
   - Click "Login with Spotify" - should redirect to Spotify
   - After authorizing, should redirect back to your app
   - Upload an image and test the full flow

## Step 6: Custom Domain (Optional)

If you have a custom domain:

1. Go to **Settings** → **Domains** in Vercel
2. Add your custom domain
3. Follow Vercel's DNS configuration instructions
4. **Update Spotify redirect URI** to use your custom domain:
   ```
   https://your-custom-domain.com/api/auth/callback
   ```
5. **Update environment variable** (if you set `SPOTIFY_REDIRECT_URI`):
   ```
   SPOTIFY_REDIRECT_URI=https://your-custom-domain.com/api/auth/callback
   ```

## Troubleshooting

### Issue: "Spotify Client ID not configured"
- **Solution:** Make sure `SPOTIFY_CLIENT_ID` is set in Vercel environment variables
- Redeploy after adding environment variables

### Issue: "OpenAI API key not configured"
- **Solution:** Make sure `OPENAI_API_KEY` is set in Vercel environment variables
- Redeploy after adding environment variables

### Issue: Spotify OAuth redirect mismatch
- **Solution:** 
  1. Check that your Vercel URL is added to Spotify app settings
  2. The URL must be **exactly** `https://your-app.vercel.app/api/auth/callback`
  3. Make sure you're using HTTPS (not HTTP) for production
  4. Redeploy after updating Spotify settings

### Issue: Cookies not working
- **Solution:** 
  - The app automatically sets `Secure` flag in production
  - Make sure you're accessing via HTTPS
  - Check browser console for cookie errors

### Issue: Build fails
- **Solution:**
  - Check build logs in Vercel dashboard
  - Run `npm run build` locally to test
  - Ensure all dependencies are in `package.json`

### Issue: API routes timeout
- **Solution:**
  - Vercel has a 10-second timeout for Hobby plan
  - Image analysis might take time - consider adding loading states
  - For longer operations, consider upgrading to Pro plan (60s timeout)

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | ✅ Yes | Your Spotify app Client ID |
| `SPOTIFY_CLIENT_SECRET` | ✅ Yes | Your Spotify app Client Secret |
| `OPENAI_API_KEY` | ✅ Yes | Your OpenAI API key |
| `SPOTIFY_REDIRECT_URI` | ❌ No | Auto-detected from request if not set |

## Next Steps After Deployment

1. ✅ Test the full user flow (upload → analyze → playlist → create)
2. ✅ Monitor Vercel function logs for errors
3. ✅ Check OpenAI usage dashboard for API costs
4. ✅ Set up Vercel Analytics (optional)
5. ✅ Configure error monitoring (optional, e.g., Sentry)

## Important Notes

- **Never commit `.env.local` to git** - it's already in `.gitignore`
- **Environment variables are encrypted** in Vercel
- **Redeploy after changing environment variables** - they're injected at build time
- **Spotify redirect URIs are case-sensitive** - make sure they match exactly
- **HTTPS is required** for production OAuth flows

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for client-side errors
3. Check Vercel function logs for API route errors
4. Verify all environment variables are set correctly
5. Verify Spotify redirect URI is added correctly

