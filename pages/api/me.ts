import type { NextApiRequest, NextApiResponse } from 'next';
import { getSpotifyApi } from '@/lib/spotify';

/**
 * Example API route that gets the current user's Spotify profile
 * Access at: GET /api/me
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const spotifyApi = getSpotifyApi(req);
    const me = await spotifyApi.getMe();

    return res.json({
      user: {
        id: me.body.id,
        display_name: me.body.display_name,
        email: me.body.email,
        images: me.body.images,
        country: me.body.country,
      },
    });
  } catch (error: any) {
    if (error.message.includes('No access token')) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }
    
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

