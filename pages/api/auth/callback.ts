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

    // Log redirect URI for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Using Redirect URI for token exchange:', SPOTIFY_REDIRECT_URI);
      console.log('⚠️  Make sure this EXACT URI is in your Spotify app settings:');
      console.log(`   ${SPOTIFY_REDIRECT_URI}`);
      console.log('   (Check: https://developer.spotify.com/dashboard → Your App → Settings → Redirect URIs)');
    }

    // Exchange authorization code for access token
    const spotifyApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
      redirectUri: SPOTIFY_REDIRECT_URI,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 Exchanging authorization code for tokens...');
      console.log('   Using redirect URI:', SPOTIFY_REDIRECT_URI);
      console.log('   Client ID:', SPOTIFY_CLIENT_ID?.substring(0, 10) + '...');
    }

    let data;
    try {
      data = await spotifyApi.authorizationCodeGrant(code);
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Token exchange successful');
      }
    } catch (exchangeError: any) {
      console.error('❌ Token exchange FAILED!');
      console.error('Error:', exchangeError.message);
      console.error('Status:', exchangeError.statusCode);
      console.error('Body:', JSON.stringify(exchangeError.body, null, 2));
      console.error('This usually means the redirect URI in your Spotify app doesn\'t match:', SPOTIFY_REDIRECT_URI);
      return res.redirect(`/?error=${encodeURIComponent(`Token exchange failed: ${exchangeError.message || 'Unknown error'}. Check that your redirect URI matches exactly: ${SPOTIFY_REDIRECT_URI}`)}`);
    }

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
        console.log('🔍 Verifying token...');
        console.log('   Client ID used for token exchange:', SPOTIFY_CLIENT_ID?.substring(0, 15) + '...');
        console.log('   Full Client ID from .env:', SPOTIFY_CLIENT_ID);
        console.log('   Client Secret length:', SPOTIFY_CLIENT_SECRET?.length || 0);
        console.log('   Token length:', access_token?.length || 0);
        console.log('   Token starts with:', access_token?.substring(0, 20));
        
        // Try to decode the token (it's a JWT, but Spotify tokens aren't always JWTs)
        // At least verify it's not empty or malformed
        if (!access_token || access_token.length < 50) {
          throw new Error('Token appears to be invalid (too short)');
        }
        
        const testApi = new SpotifyWebApi({
          clientId: SPOTIFY_CLIENT_ID,
          clientSecret: SPOTIFY_CLIENT_SECRET,
        });
        testApi.setAccessToken(access_token);
        
        console.log('   Making getMe() call to verify token...');
        
        // Try using the token directly with a raw HTTP request first
        // This helps us see if it's a library issue or a token issue
        try {
          const fetchResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            },
          });
          
          console.log('   Raw HTTP request status:', fetchResponse.status);
          if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            console.log('   Raw HTTP error response:', errorText);
            console.log('   Raw HTTP error headers:', Object.fromEntries(fetchResponse.headers.entries()));
            
            // Try to parse as JSON
            let errorJson;
            try {
              errorJson = JSON.parse(errorText);
              console.log('   Parsed error JSON:', JSON.stringify(errorJson, null, 2));
            } catch {
              console.log('   Error response is not JSON');
            }
          } else {
            const userData = await fetchResponse.json();
            console.log('✅ Token verified via raw HTTP - user:', userData.display_name || userData.id);
            // If raw HTTP works, try the library call too
            const testMe = await testApi.getMe();
            console.log('✅ Token verified via library - user:', testMe.body.display_name || testMe.body.id);
          }
        } catch (fetchError: any) {
          console.error('   Raw HTTP request failed:', fetchError.message);
          // Fall back to library call
          const testMe = await testApi.getMe();
          console.log('✅ Token verified - user:', testMe.body.display_name || testMe.body.id);
        }
      } catch (testError: any) {
        console.error('❌ CRITICAL: Token verification failed immediately after receiving it!');
        console.error('This means the token is invalid from the start.');
        
        // Extract actual error message from Spotify
        let spotifyError = 'Unknown error';
        let errorMessage = '';
        if (testError.body) {
          if (typeof testError.body === 'object') {
            spotifyError = JSON.stringify(testError.body, null, 2);
            // Try to extract error.message from the body
            if (testError.body.error) {
              errorMessage = testError.body.error.message || testError.body.error;
            }
          } else {
            spotifyError = String(testError.body);
            errorMessage = spotifyError;
          }
        } else if (testError.message) {
          spotifyError = String(testError.message);
          errorMessage = spotifyError;
        }
        
        console.error('═══════════════════════════════════════════════════════');
        console.error('FULL ERROR DETAILS:');
        console.error('Status Code:', testError.statusCode);
        console.error('Error Body:', spotifyError);
        console.error('Error Message:', errorMessage);
        console.error('Full Error Object:', JSON.stringify(testError, null, 2));
        console.error('Client ID Used:', SPOTIFY_CLIENT_ID?.substring(0, 15) + '...');
        console.error('Redirect URI Used:', SPOTIFY_REDIRECT_URI);
        console.error('Access Token Length:', access_token?.length || 0);
        console.error('Access Token First 20 chars:', access_token?.substring(0, 20) || 'none');
        console.error('═══════════════════════════════════════════════════════');
        console.error('Possible causes:');
        console.error('1. Redirect URI mismatch: Make sure this EXACT URI is in Spotify:');
        console.error(`   ${SPOTIFY_REDIRECT_URI}`);
        console.error('2. Client ID/Secret mismatch: Check .env.local matches Spotify dashboard');
        console.error('3. Token was created with wrong app credentials');
        console.error('4. Spotify API returned an error (check error message above)');
        
        // Actually fail the callback if token is invalid
        // This is a critical error - the token is invalid from the start
        console.error('Failing authentication due to invalid token');
        const redirectErrorMessage = `Authentication failed: Token is invalid immediately after creation. This usually means:
1. Redirect URI mismatch: The redirect URI used (${SPOTIFY_REDIRECT_URI}) doesn't match what's configured in your Spotify app
2. Client ID/Secret mismatch: Your .env.local credentials don't match your Spotify app
3. Visit /api/verify-credentials to check your setup
4. Check your Spotify app settings: https://developer.spotify.com/dashboard`;
        res.redirect(`/?error=${encodeURIComponent(redirectErrorMessage)}`);
        return;
      }
    }

    // Redirect to upload page after successful authentication
    res.redirect('/upload');
  } catch (error: any) {
    console.error('Error during token exchange:', error);
    return res.redirect(`/?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
  }
}

