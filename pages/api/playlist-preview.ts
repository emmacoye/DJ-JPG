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

    // Create multiple diverse search queries to ensure artist variety
    const searchQueries: string[] = [];
    
    // Add genre-based searches (one per genre)
    for (const genre of genres.slice(0, 5)) {
      searchQueries.push(`genre:"${genre}"`);
    }
    
    // Add mood-based searches
    if (mood) {
      searchQueries.push(mood);
    }
    
    // Add energy/tempo-based searches
    if (energy === 'high') {
      searchQueries.push('energetic');
      searchQueries.push('upbeat');
    } else if (energy === 'low') {
      searchQueries.push('chill');
      searchQueries.push('relaxing');
    } else {
      searchQueries.push('moderate');
    }

    // Perform multiple searches to get diverse results
    const allTracks: any[] = [];
    const artistCounts: { [key: string]: number } = {};
    const maxTracksPerArtist = 2; // Maximum tracks per artist
    const targetTrackCount = 20;

    // Shuffle search queries to get variety
    const shuffledQueries = searchQueries.sort(() => Math.random() - 0.5);
    
    // Search with different queries
    for (const query of shuffledQueries.slice(0, 8)) {
      if (allTracks.length >= targetTrackCount * 1.5) break; // Get more than needed for filtering
      
      try {
        const searchResults = await spotifyApi.searchTracks(query, {
          limit: 10, // Get fewer per query but more queries
        });

        if (searchResults.body.tracks?.items) {
          for (const track of searchResults.body.tracks.items) {
            if (!track || !track.id) continue;
            
            // Get primary artist (first artist)
            const primaryArtist = track.artists?.[0]?.name || '';
            
            // Check if we already have enough tracks from this artist
            if (primaryArtist && artistCounts[primaryArtist] >= maxTracksPerArtist) {
              continue; // Skip this track
            }
            
            // Add track
            allTracks.push(track);
            
            // Update artist count
            if (primaryArtist) {
              artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
            }
          }
        }
      } catch (error) {
        console.error(`Error searching with query "${query}":`, error);
        // Continue with next query
      }
    }

    // If we don't have enough tracks, do a fallback search
    if (allTracks.length < targetTrackCount) {
      const fallbackQuery = genres[0] || 'pop';
      try {
        const fallbackResults = await spotifyApi.searchTracks(`genre:"${fallbackQuery}"`, {
          limit: 30,
        });
        
        if (fallbackResults.body.tracks?.items) {
          for (const track of fallbackResults.body.tracks.items) {
            if (allTracks.length >= targetTrackCount * 1.5) break;
            if (!track || !track.id) continue;
            
            const primaryArtist = track.artists?.[0]?.name || '';
            if (primaryArtist && artistCounts[primaryArtist] >= maxTracksPerArtist) {
              continue;
            }
            
            // Check if track is already in our list
            if (allTracks.some(t => t.id === track.id)) {
              continue;
            }
            
            allTracks.push(track);
            if (primaryArtist) {
              artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
            }
          }
        }
      } catch (error) {
        console.error('Error in fallback search:', error);
      }
    }

    if (allTracks.length === 0) {
      return res.status(404).json({ error: 'No tracks found matching the analysis' });
    }

    // Shuffle tracks to mix up the order
    const shuffledTracks = allTracks.sort(() => Math.random() - 0.5);

    // Get tracks with preview URLs, ensuring artist diversity
    const tracks = shuffledTracks
      .slice(0, targetTrackCount) // Take up to target count
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

