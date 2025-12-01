import type { NextApiRequest, NextApiResponse } from 'next';
import SpotifyWebApi from 'spotify-web-api-node';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const refreshToken = req.cookies.spotify_refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token found' });
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Spotify credentials not configured' });
  }

  try {
    const spotifyApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
      refreshToken,
    });

    const data = await spotifyApi.refreshAccessToken();
    const { access_token, expires_in } = data.body;

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

    return res.json({ success: true, expires_in });
  } catch (error: any) {
    console.error('Error refreshing token:', error);
    return res.status(401).json({ error: 'Failed to refresh token' });
  }
}

