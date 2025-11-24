import type { NextApiRequest, NextApiResponse } from 'next';
import { getSpotifyApi } from '@/lib/spotify';

/**
 * Get playlist preview (tracks) without creating the playlist
 * This allows users to preview tracks before adding to Spotify
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { analysis } = req.body;

    if (!analysis) {
      return res.status(400).json({ error: 'Analysis data is required' });
    }

    let spotifyApi;
    try {
      spotifyApi = await getSpotifyApi(req, res);
    } catch (error: any) {
      console.error('Error getting Spotify API:', error);
      if (error.message?.includes('No access token')) {
        return res.status(401).json({ 
          error: 'Not authenticated. Please login to Spotify first.',
          requiresAuth: true,
        });
      }
      return res.status(401).json({ 
        error: error.message || 'Authentication failed. Please login to Spotify again.',
        requiresAuth: true,
      });
    }

    // Get current user info - this validates the token works
    let me;
    try {
      me = await spotifyApi.getMe();
      console.log('User authenticated:', me.body.display_name || me.body.id);
    } catch (error: any) {
      console.error('Error getting user info:', error);
      
      if (error.statusCode === 401) {
        return res.status(401).json({ 
          error: 'Token expired. Please login to Spotify again.',
          requiresAuth: true,
        });
      }
      if (error.statusCode === 403) {
        return res.status(403).json({ 
          error: 'Token is invalid. Please login to Spotify again.',
          requiresAuth: true,
          requiresReauth: true,
        });
      }
      throw error;
    }
    
    // Build search queries based on analysis
    const genres = analysis.genres || ['pop'];
    const mood = analysis.mood || '';
    const energy = analysis.energy || 'medium';
    const tempo = analysis.tempo || 'moderate';
    const playlistTheme = analysis.playlistTheme || 'Photo Playlist';

    // Search for tracks based on genres and mood
    const searchQueries: string[] = [];
    
    // Add genre-based searches
    for (const genre of genres.slice(0, 3)) {
      searchQueries.push(`genre:"${genre}"`);
    }
    
    // Add mood/energy keywords
    if (mood) {
      searchQueries.push(mood);
    }
    if (energy === 'high') {
      searchQueries.push('energetic');
    } else if (energy === 'low') {
      searchQueries.push('chill');
    }

    // Combine queries
    const searchQuery = searchQueries.slice(0, 2).join(' ');
    
    // Search for tracks
    const searchResults = await spotifyApi.searchTracks(searchQuery, {
      limit: 20,
    });

    if (!searchResults.body.tracks || searchResults.body.tracks.items.length === 0) {
      // Fallback: search by genre only
      const fallbackQuery = genres[0] || 'pop';
      const fallbackResults = await spotifyApi.searchTracks(`genre:"${fallbackQuery}"`, {
        limit: 20,
      });
      
      if (!fallbackResults.body.tracks || fallbackResults.body.tracks.items.length === 0) {
        return res.status(404).json({ error: 'No tracks found matching the analysis' });
      }
      
      searchResults.body.tracks = fallbackResults.body.tracks;
    }

    // Get tracks with preview URLs
    const tracks = searchResults.body.tracks.items
      .filter(track => track) // Filter out any null/undefined tracks
      .map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => artist.name).join(', '),
        album: track.album?.name || '',
        preview_url: track.preview_url, // 30-second preview URL
        external_urls: track.external_urls,
        uri: track.uri,
        duration_ms: track.duration_ms,
        album_image: track.album?.images?.[0]?.url || null,
      }))
      .filter(track => track.id); // Only include tracks with IDs

    if (tracks.length === 0) {
      return res.status(404).json({ error: 'No valid tracks found' });
    }

    return res.json({
      success: true,
      playlistTheme,
      tracks,
      analysis: {
        mood,
        energy,
        tempo,
        genres,
        description: analysis.description,
      },
    });
  } catch (error: any) {
    console.error('Error getting playlist preview:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get playlist preview',
    });
  }
}

