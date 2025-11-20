import type { NextApiRequest, NextApiResponse } from 'next';
import SpotifyWebApi from 'spotify-web-api-node';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Get redirect URI from environment, or auto-detect from request
function getRedirectUri(req: NextApiRequest): string {
  // If explicitly set in environment, use that
  if (process.env.SPOTIFY_REDIRECT_URI) {
    return process.env.SPOTIFY_REDIRECT_URI;
  }

  // Auto-detect from request (works for both dev and production)
  // Spotify requirement: Use 127.0.0.1 instead of localhost for loopback
  const protocol = req.headers['x-forwarded-proto'] || 
    (req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1') ? 'http' : 'https');
  
  let host = req.headers.host || '127.0.0.1:3000';
  
  // Replace localhost with 127.0.0.1 (Spotify requirement)
  if (host.includes('localhost')) {
    host = host.replace('localhost', '127.0.0.1');
  }
  
  return `${protocol}://${host}/api/auth/callback`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  // Debug logging
  if (process.env.NODE_ENV !== 'production') {
    console.log('Callback received - Query params:', { code: code ? 'present' : 'missing', state, error });
    console.log('All cookies:', req.cookies);
    console.log('Cookie header:', req.headers.cookie);
  }

  // Helper to clear state cookie
  const clearStateCookie = () => {
    res.setHeader('Set-Cookie', 'spotify_auth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  };

  // Check for errors from Spotify
  if (error) {
    clearStateCookie();
    return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
  }

  // Validate state (optional but recommended for security)
  // Try both req.cookies (parsed) and manual parsing from cookie header
  let storedState = req.cookies?.spotify_auth_state;
  
  // Fallback: manually parse cookie header if req.cookies doesn't have it
  if (!storedState && req.headers.cookie) {
    const cookieMatch = req.headers.cookie.match(/spotify_auth_state=([^;]+)/);
    if (cookieMatch) {
      storedState = cookieMatch[1].trim();
    }
  }
  
  if (!state || typeof state !== 'string') {
    clearStateCookie();
    return res.status(400).json({ error: 'State parameter missing' });
  }

  if (!storedState) {
    clearStateCookie();
    const host = req.headers.host || 'unknown';
    const cookieHeader = req.headers.cookie || 'none';
    console.error('State cookie not found:', {
      host,
      cookieHeader,
      allCookies: req.cookies,
      redirectUri: getRedirectUri(req),
    });
    return res.status(400).json({ 
      error: 'State cookie not found. Please try logging in again.',
      hint: 'Make sure you access the login page using the same URL as your Spotify redirect URI (e.g., if redirect URI uses 127.0.0.1, access login via 127.0.0.1, not localhost)'
    });
  }

  if (state !== storedState) {
    clearStateCookie();
    console.error('State mismatch:', { received: state, stored: storedState });
    return res.status(400).json({ error: 'State mismatch. Please try logging in again.' });
  }

  // Clear the state cookie after successful validation
  clearStateCookie();

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Spotify credentials not configured' });
  }

  try {
    const SPOTIFY_REDIRECT_URI = getRedirectUri(req);

    // Exchange authorization code for access token
    const spotifyApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
      redirectUri: SPOTIFY_REDIRECT_URI,
    });

    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;
    
    // Log token info for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('Token received:', {
        accessTokenLength: access_token?.length || 0,
        refreshTokenLength: refresh_token?.length || 0,
        expiresIn: expires_in,
        clientId: SPOTIFY_CLIENT_ID?.substring(0, 10) + '...',
      });
    }

    // Store tokens securely (in production, use a secure session store or database)
    // For now, we'll set them in cookies with httpOnly flag
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: expires_in * 1000, // Convert to milliseconds
      path: '/',
    };

    // Build cookie strings
    const accessTokenCookie = `spotify_access_token=${access_token}; HttpOnly; Secure=${cookieOptions.secure}; SameSite=${cookieOptions.sameSite}; Path=${cookieOptions.path}; Max-Age=${cookieOptions.maxAge}`;
    const refreshTokenCookie = `spotify_refresh_token=${refresh_token}; HttpOnly; Secure=${cookieOptions.secure}; SameSite=${cookieOptions.sameSite}; Path=/; Max-Age=${60 * 60 * 24 * 7 * 1000}`;

    res.setHeader('Set-Cookie', [accessTokenCookie, refreshTokenCookie]);
    
    // Verify the token works by testing it
    if (process.env.NODE_ENV !== 'production') {
      try {
        const testApi = new SpotifyWebApi({
          clientId: SPOTIFY_CLIENT_ID,
          clientSecret: SPOTIFY_CLIENT_SECRET,
        });
        testApi.setAccessToken(access_token);
        const testMe = await testApi.getMe();
        console.log('✅ Token verified - user:', testMe.body.display_name || testMe.body.id);
      } catch (testError: any) {
        console.error('❌ CRITICAL: Token verification failed immediately after receiving it!');
        console.error('This means the token is invalid from the start.');
        
        // Extract actual error message from Spotify
        let spotifyError = 'Unknown error';
        if (testError.body) {
          if (typeof testError.body === 'object') {
            spotifyError = JSON.stringify(testError.body);
          } else {
            spotifyError = String(testError.body);
          }
        } else if (testError.message) {
          spotifyError = String(testError.message);
        }
        
        console.error('Error details:', {
          statusCode: testError.statusCode,
          body: testError.body,
          spotifyError: spotifyError,
          clientIdUsed: SPOTIFY_CLIENT_ID?.substring(0, 15) + '...',
        });
        console.error('Possible causes:');
        console.error('1. Client ID/Secret in .env.local don\'t match your Spotify app');
        console.error('2. The Spotify app Client ID in dashboard:', 'Check https://developer.spotify.com/dashboard');
        console.error('3. Token was created but is invalid (very rare)');
        
        // Actually fail the callback if token is invalid
        return res.redirect(`/?error=${encodeURIComponent('Token verification failed. Please check your Spotify app Client ID/Secret match your .env.local file.')}`);
      }
    }

    // Redirect to upload page after successful authentication
    res.redirect('/upload');
  } catch (error: any) {
    console.error('Error during token exchange:', error);
    return res.redirect(`/?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
  }
}

