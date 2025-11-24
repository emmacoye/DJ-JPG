import type { NextApiRequest, NextApiResponse } from 'next';
import SpotifyWebApi from 'spotify-web-api-node';

/**
 * Diagnostic endpoint to verify Spotify credentials are configured correctly
 * This helps debug Client ID/Secret mismatch issues
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

  // Don't expose the full credentials, just verify they exist and are the right format
  const response: any = {
    clientIdConfigured: !!SPOTIFY_CLIENT_ID,
    clientSecretConfigured: !!SPOTIFY_CLIENT_SECRET,
    clientIdLength: SPOTIFY_CLIENT_ID?.length || 0,
    clientSecretLength: SPOTIFY_CLIENT_SECRET?.length || 0,
    clientIdPrefix: SPOTIFY_CLIENT_ID?.substring(0, 10) || 'not set',
  };

  // Spotify Client IDs are typically 32 characters
  if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_ID.length !== 32) {
    response.warning = 'Client ID should be 32 characters long';
  }

  // Spotify Client Secrets are typically 32 characters
  if (SPOTIFY_CLIENT_SECRET && SPOTIFY_CLIENT_SECRET.length !== 32) {
    response.warning = 'Client Secret should be 32 characters long';
  }

  // Try to create a Spotify API instance to verify credentials format
  try {
    const testApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID || '',
      clientSecret: SPOTIFY_CLIENT_SECRET || '',
    });
    response.credentialsFormatValid = true;
  } catch (error) {
    response.credentialsFormatValid = false;
    response.error = 'Failed to create Spotify API instance';
  }

  // Show what redirect URI would be used (if not explicitly set)
  if (!process.env.SPOTIFY_REDIRECT_URI) {
    const host = req.headers.host || '127.0.0.1:3000';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    let redirectHost = host.includes('localhost') ? host.replace('localhost', '127.0.0.1') : host;
    response.redirectUri = `${protocol}://${redirectHost}/api/auth/callback`;
    response.redirectUriNote = 'This is auto-detected. Make sure this EXACT URI is in your Spotify app settings.';
  } else {
    response.redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    response.redirectUriNote = 'This is set from SPOTIFY_REDIRECT_URI environment variable.';
  }

  return res.json(response);
}

