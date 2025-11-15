import SpotifyWebApi from 'spotify-web-api-node';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

/**
 * Get a Spotify API instance with access token from cookies
 * Use this in API routes that need to make authenticated requests
 */
export function getSpotifyApi(req: { cookies: { spotify_access_token?: string } }) {
  const accessToken = req.cookies.spotify_access_token;

  if (!accessToken) {
    throw new Error('No access token found. Please login first.');
  }

  const spotifyApi = new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
  });

  spotifyApi.setAccessToken(accessToken);
  return spotifyApi;
}

/**
 * Get a Spotify API instance with client credentials (for server-side operations)
 */
export function getSpotifyClientApi() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured');
  }

  return new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
  });
}

