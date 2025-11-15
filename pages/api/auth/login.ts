import type { NextApiRequest, NextApiResponse } from 'next';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;

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
const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-library-modify',
].join(' ');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(500).json({ error: 'Spotify Client ID not configured' });
  }

  const SPOTIFY_REDIRECT_URI = getRedirectUri(req);

  // Log the redirect URI for debugging (remove in production)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Using Redirect URI:', SPOTIFY_REDIRECT_URI);
    console.log('Make sure this EXACT URI is added in your Spotify app settings:');
    console.log(`  ${SPOTIFY_REDIRECT_URI}`);
  }

  const state = Math.random().toString(36).substring(2, 15);
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `response_type=code` +
    `&client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SPOTIFY_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}`;

  // Store state in a cookie for validation (or use a session store)
  res.setHeader('Set-Cookie', `spotify_auth_state=${state}; HttpOnly; Path=/; Max-Age=600`);
  
  res.redirect(authUrl);
}

