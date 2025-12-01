import type { NextApiRequest, NextApiResponse } from 'next';
import SpotifyWebApi from 'spotify-web-api-node';

/**
 * Test endpoint to verify Client ID/Secret work using Client Credentials flow
 * This doesn't require user authentication, so it tests if the credentials themselves are valid
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return res.status(500).json({ 
      error: 'Credentials not configured',
      clientIdSet: !!SPOTIFY_CLIENT_ID,
      clientSecretSet: !!SPOTIFY_CLIENT_SECRET,
    });
  }

  try {
    console.log('Testing Client Credentials flow...');
    console.log('Client ID:', SPOTIFY_CLIENT_ID.substring(0, 10) + '...');
    console.log('Client Secret length:', SPOTIFY_CLIENT_SECRET.length);

    const spotifyApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
    });

    // Try to get an app-level access token (Client Credentials flow)
    const data = await spotifyApi.clientCredentialsGrant();
    const appAccessToken = data.body.access_token;

    console.log('✅ Client Credentials flow succeeded!');
    console.log('App access token received (length):', appAccessToken.length);

    // Try to use this token to search (app-level token can do this)
    spotifyApi.setAccessToken(appAccessToken);
    const searchResults = await spotifyApi.searchTracks('test', { limit: 1 });

    return res.json({
      success: true,
      message: '✅ Your Client ID and Secret are VALID!',
      test: 'Client Credentials flow works, credentials are correct',
      clientIdPrefix: SPOTIFY_CLIENT_ID.substring(0, 10) + '...',
      searchTest: Array.isArray(searchResults.body.tracks?.items) && searchResults.body.tracks.items.length > 0
        ? 'Search works'
        : 'Search failed',
    });
  } catch (error: any) {
    console.error('❌ Client Credentials flow FAILED!');
    console.error('Error:', error?.message);
    console.error('Status:', error.statusCode);
    console.error('Body:', JSON.stringify(error.body, null, 2));

    return res.status(500).json({
      success: false,
      error: 'Client Credentials flow failed',
      message: error.message || 'Unknown error',
      statusCode: error.statusCode,
      body: error.body,
      hint: 'This means your Client ID or Secret is incorrect, or there\'s an issue with your Spotify app',
    });
  }
}

