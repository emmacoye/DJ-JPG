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

  // Check for errors from Spotify
  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
  }

  // Validate state (optional but recommended for security)
  const storedState = req.cookies.spotify_auth_state;
  if (state !== storedState) {
    return res.status(400).json({ error: 'State mismatch' });
  }

  // Clear the state cookie
  res.setHeader('Set-Cookie', 'spotify_auth_state=; HttpOnly; Path=/; Max-Age=0');

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

    // Store tokens securely (in production, use a secure session store or database)
    // For now, we'll set them in cookies with httpOnly flag
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: expires_in * 1000, // Convert to milliseconds
      path: '/',
    };

    res.setHeader('Set-Cookie', [
      `spotify_access_token=${access_token}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`,
      `spotify_refresh_token=${refresh_token}; HttpOnly; Secure=${cookieOptions.secure}; SameSite=${cookieOptions.sameSite}; Path=/; Max-Age=${60 * 60 * 24 * 7 * 1000}`, // 7 days
    ]);

    // Redirect to dashboard or home page
    res.redirect('/dashboard');
  } catch (error: any) {
    console.error('Error during token exchange:', error);
    return res.redirect(`/?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
  }
}

