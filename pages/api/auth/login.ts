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
  const currentHost = req.headers.host || '';
  
  // Safely extract host from redirect URI
  let redirectHost = '';
  try {
    redirectHost = new URL(SPOTIFY_REDIRECT_URI).host;
  } catch (error) {
    console.error('Error parsing redirect URI:', SPOTIFY_REDIRECT_URI, error);
    return res.status(500).json({ error: 'Invalid redirect URI configuration' });
  }

  // Log the redirect URI for debugging (remove in production)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Using Redirect URI:', SPOTIFY_REDIRECT_URI);
    console.log('Make sure this EXACT URI is added in your Spotify app settings:');
    console.log(`  ${SPOTIFY_REDIRECT_URI}`);
    console.log('Request host:', currentHost);
    console.log('Redirect host:', redirectHost);
  }

  // Check for host mismatch (localhost vs 127.0.0.1)
  // If there's a mismatch, redirect to the correct host
  if (currentHost !== redirectHost && 
      (currentHost.includes('localhost') || currentHost.includes('127.0.0.1')) &&
      (redirectHost.includes('localhost') || redirectHost.includes('127.0.0.1'))) {
    const protocol = req.headers['x-forwarded-proto'] || 
      (currentHost.includes('localhost') || currentHost.includes('127.0.0.1') ? 'http' : 'https');
    // Use the full request URL or default to /api/auth/login
    const requestUrl = req.url || '/api/auth/login';
    const correctUrl = `${protocol}://${redirectHost}${requestUrl}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log('Host mismatch detected. Redirecting to:', correctUrl);
    }
    return res.redirect(correctUrl);
  }

  // Clear any existing state cookie first
  res.setHeader('Set-Cookie', 'spotify_auth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');

  // Check if we should force re-authentication (clear existing tokens)
  const forceReauth = req.query.force === 'true' || req.query.reauth === 'true';
  
  // If forcing re-auth, clear existing tokens
  if (forceReauth) {
    res.setHeader('Set-Cookie', [
      'spotify_access_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
      'spotify_refresh_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
    ]);
  }

  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // Build authorization URL with show_dialog=true to always show consent screen
  // This ensures users see and grant permissions every time
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `response_type=code` +
    `&client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SPOTIFY_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}` +
    `&show_dialog=true`; // Force consent screen every time
  
  // Log scopes for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.log('Requesting Spotify scopes:', SPOTIFY_SCOPES);
    console.log('Authorization URL:', authUrl.replace(SPOTIFY_CLIENT_ID || '', 'CLIENT_ID_HIDDEN'));
  }

  // Store state in a cookie for validation (or use a session store)
  // SameSite=Lax is important for OAuth redirects to work properly
  // Set cookie for both localhost and 127.0.0.1 to handle domain mismatch
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes
  };
  
  // Build cookie string properly - only include Secure if it's true
  let cookieString = `spotify_auth_state=${state}; HttpOnly; SameSite=${cookieOptions.sameSite}; Path=${cookieOptions.path}; Max-Age=${cookieOptions.maxAge}`;
  if (cookieOptions.secure) {
    cookieString += '; Secure';
  }
  
  // Set cookie without domain (works for both localhost and 127.0.0.1)
  res.setHeader('Set-Cookie', cookieString);
  
  // Debug logging
  if (process.env.NODE_ENV !== 'production') {
    console.log('Setting state cookie:', state);
    console.log('Cookie string:', cookieString);
  }
  
  res.redirect(authUrl);
}

