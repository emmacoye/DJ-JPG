import type { NextApiRequest, NextApiResponse } from 'next';
import { getSpotifyApi } from '@/lib/spotify';

/**
 * Test endpoint to check if the current token has playlist creation permissions
 * This helps debug 403 errors
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const spotifyApi = await getSpotifyApi(req, res);
    
    // Try to get user info (basic permission)
    const me = await spotifyApi.getMe();
    const userId = me.body.id;
    
    // Try to create a test playlist (this will fail with 403 if no permissions)
    try {
      // createPlaylist signature: createPlaylist(userId, name, options)
      const testPlaylistResponse = await (spotifyApi.createPlaylist as any)(userId, 'DJ JPG Test Playlist', {
        description: 'Test playlist to verify permissions',
        public: false,
      });
      
      const testPlaylist = (testPlaylistResponse as any).body;
      
      // If successful, delete the test playlist
      try {
        await spotifyApi.unfollowPlaylist(testPlaylist.id);
      } catch (deleteError) {
        // Ignore delete errors
      }
      
      return res.json({
        success: true,
        message: 'Token has all required permissions!',
        user: me.body.display_name || me.body.id,
      });
    } catch (createError: any) {
      if (createError.statusCode === 403) {
        return res.status(403).json({
          success: false,
          error: 'Token does NOT have playlist creation permissions',
          message: 'Please login again and make sure to grant ALL permissions, especially playlist creation.',
          requiresReauth: true,
        });
      }
      throw createError;
    }
  } catch (error: any) {
    console.error('Error testing permissions:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to test permissions',
    });
  }
}

