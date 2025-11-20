import SpotifyWebApi from 'spotify-web-api-node';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

/**
 * Get a Spotify API instance with access token from cookies
 * Automatically refreshes the token if it's expired
 * Use this in API routes that need to make authenticated requests
 */
export async function getSpotifyApi(
  req: { cookies: { spotify_access_token?: string; spotify_refresh_token?: string } },
  res?: { setHeader: (name: string, value: string | string[]) => void }
): Promise<SpotifyWebApi> {
  const accessToken = req.cookies.spotify_access_token;
  const refreshToken = req.cookies.spotify_refresh_token;

  if (!accessToken && !refreshToken) {
    throw new Error('No access token found. Please login first.');
  }

  const spotifyApi = new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
  });

  // If we have an access token, use it
  // We'll validate it when making actual API calls, not here
  if (accessToken) {
    spotifyApi.setAccessToken(accessToken);
    console.log('Using access token from cookies (length:', accessToken.length, ')');
    return spotifyApi;
  }

  // If no access token but we have refresh token, try to get a new one
  if (refreshToken && res) {
    try {
      spotifyApi.setRefreshToken(refreshToken);
      const data = await spotifyApi.refreshAccessToken();
      const { access_token, expires_in } = data.body;
      
      // Update the access token cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: expires_in * 1000,
        path: '/',
      };
      
      res.setHeader(
        'Set-Cookie',
        `spotify_access_token=${access_token}; ${Object.entries(cookieOptions)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ')}`
      );
      
      spotifyApi.setAccessToken(access_token);
      return spotifyApi;
    } catch (refreshError: any) {
      throw new Error('Failed to refresh access token. Please login again.');
    }
  }

  throw new Error('No valid access token or refresh token found. Please login first.');
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

