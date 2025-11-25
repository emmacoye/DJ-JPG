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
    const { analysis, popularityFilter } = req.body;

    if (!analysis) {
      return res.status(400).json({ error: 'Analysis data is required' });
    }

    // popularityFilter: 'mainstream' (default), 'indie', or 'mixed'
    const filter = popularityFilter || 'mainstream';

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
    const musicalKeywords = analysis.musicalKeywords || [];
    const characteristics = analysis.characteristics || [];
    const description = analysis.description || '';

    // Check if this is a nature scene (forest, nature, woods, mountains, etc.)
    const isNatureScene = description?.toLowerCase().includes('forest') || 
                         description?.toLowerCase().includes('nature') || 
                         description?.toLowerCase().includes('wood') ||
                         description?.toLowerCase().includes('mountain') ||
                         description?.toLowerCase().includes('tree') ||
                         genres[0]?.toLowerCase().includes('folk') ||
                         genres[0]?.toLowerCase().includes('indie folk');

    // Create multiple diverse search queries to ensure artist variety
    const searchQueries: string[] = [];
    
    // For nature scenes, add specific artist searches to get similar artists
    if (isNatureScene) {
      const natureArtists = ['Noah Kahan', 'Hozier', 'Lizzy McAlpine', 'Mt. Joy', 'Bon Iver', 'The Lumineers', 'Gregory Alan Isakov', 'Phoebe Bridgers', 'Fleet Foxes', 'Iron & Wine'];
      for (const artist of natureArtists.slice(0, 5)) {
        searchQueries.push(`artist:"${artist}"`);
      }
    }
    
    // Add genre-based searches (one per genre) - prioritize mainstream genres
    for (const genre of genres.slice(0, 5)) {
      searchQueries.push(`genre:"${genre}"`);
      // Add "popular" or "mainstream" to genre searches to get more mainstream results
      searchQueries.push(`popular ${genre}`);
    }
    
    // Add combined genre + mood searches (always combine mood with genre to avoid title-only matches)
    if (mood && genres.length > 0) {
      for (const genre of genres.slice(0, 3)) {
        // Combine genre with mood - this helps match musical vibe, not just title
        searchQueries.push(`${genre} ${mood}`);
        searchQueries.push(`popular ${genre} ${mood}`);
      }
      
      // Also add mood variations combined with genres
      const moodVariations: { [key: string]: string[] } = {
        'happy': ['upbeat', 'joyful', 'cheerful'],
        'sad': ['melancholic', 'emotional', 'somber'],
        'calm': ['peaceful', 'serene', 'tranquil'],
        'energetic': ['upbeat', 'pumping', 'high energy'],
        'chill': ['relaxed', 'laid back', 'mellow'],
        'dreamy': ['ethereal', 'atmospheric', 'ambient'],
        'nostalgic': ['retro', 'vintage', 'classic'],
        'romantic': ['intimate', 'soft', 'tender'],
      };
      
      if (moodVariations[mood.toLowerCase()]) {
        for (const genre of genres.slice(0, 2)) {
          for (const variation of moodVariations[mood.toLowerCase()].slice(0, 2)) {
            searchQueries.push(`${genre} ${variation}`);
          }
        }
      }
    }
    
    // Add musical keyword searches (always combine with genres to avoid title-only matches)
    for (const keyword of musicalKeywords.slice(0, 5)) {
      // Always combine keywords with genres - never search keyword alone
      if (genres.length > 0) {
        searchQueries.push(`${genres[0]} ${keyword}`);
        // Also try with "popular" prefix for mainstream results
        searchQueries.push(`popular ${genres[0]} ${keyword}`);
      }
    }
    
    // Add energy/tempo-based searches combined with genres (avoid standalone mood words)
    if (genres.length > 0) {
      if (energy === 'high') {
        searchQueries.push(`${genres[0]} upbeat`);
        searchQueries.push(`${genres[0]} driving`);
        searchQueries.push(`popular ${genres[0]}`);
      } else if (energy === 'low') {
        searchQueries.push(`${genres[0]} mellow`);
        searchQueries.push(`${genres[0]} acoustic`);
        searchQueries.push(`popular ${genres[0]}`);
      } else {
        searchQueries.push(`popular ${genres[0]}`);
      }
      
      // Add tempo-based searches combined with genres
      if (tempo === 'fast') {
        searchQueries.push(`${genres[0]} upbeat`);
      } else if (tempo === 'slow') {
        searchQueries.push(`${genres[0]} ballad`);
        searchQueries.push(`${genres[0]} acoustic`);
      }
    }
    
    // Add characteristic-based searches
    for (const char of characteristics.slice(0, 3)) {
      if (char && typeof char === 'string') {
        searchQueries.push(char);
        // Combine with genres
        if (genres.length > 0) {
          searchQueries.push(`${genres[0]} ${char}`);
        }
      }
    }
    
    // Extract key words from description for more contextual searches
    if (description) {
      const descriptionWords = description
        .toLowerCase()
        .split(/\s+/)
        .filter((word: string) => word.length > 4) // Only longer, meaningful words
        .filter((word: string) => !['the', 'this', 'that', 'with', 'from', 'image', 'photo', 'picture'].includes(word))
        .slice(0, 3); // Take top 3 meaningful words
      
      for (const word of descriptionWords) {
        if (genres.length > 0) {
          searchQueries.push(`${genres[0]} ${word}`);
        }
      }
    }

    // Perform multiple searches to get diverse results
    const allTracks: any[] = [];
    const seenTrackIds = new Set<string>(); // Track IDs we've already added
    const artistCounts: { [key: string]: number } = {};
    const maxTracksPerArtist = 3; // Maximum tracks per artist (at most 3)
    const targetTrackCount = 20;

    // Shuffle search queries to get variety
    const shuffledQueries = searchQueries.sort(() => Math.random() - 0.5);
    
    // Search with different queries - fetch enough tracks to ensure we can get 20 after filtering
    for (const query of shuffledQueries.slice(0, 15)) { // Increase to 15 queries to get more tracks
      if (allTracks.length >= targetTrackCount * 3) break; // Get 3x target to account for filtering and artist limits
      
      try {
        const searchResults = await spotifyApi.searchTracks(query, {
          limit: 10, // Get fewer per query but more queries
        });

        if (searchResults.body.tracks?.items) {
          // Separate tracks with and without preview URLs
          const tracksWithPreview: any[] = [];
          const tracksWithoutPreview: any[] = [];
          
          for (const track of searchResults.body.tracks.items) {
            if (!track || !track.id) continue;
            
            // Check if track is already in our list using Set (faster and more reliable)
            if (seenTrackIds.has(track.id)) {
              continue; // Skip duplicate track
            }
            
            // Get primary artist (first artist)
            const primaryArtist = track.artists?.[0]?.name || '';
            
            // Check if we already have enough tracks from this artist
            if (primaryArtist && artistCounts[primaryArtist] >= maxTracksPerArtist) {
              continue; // Skip this track
            }
            
            // Add track ID to seen set
            seenTrackIds.add(track.id);
            
            // Prioritize tracks with preview URLs
            if (track.preview_url) {
              tracksWithPreview.push(track);
            } else {
              tracksWithoutPreview.push(track);
            }
          }
          
          // Add tracks with preview URLs first, then tracks without
          allTracks.push(...tracksWithPreview, ...tracksWithoutPreview);
          
          // Update artist counts
          [...tracksWithPreview, ...tracksWithoutPreview].forEach(track => {
            const primaryArtist = track.artists?.[0]?.name || '';
            if (primaryArtist) {
              artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
            }
          });
        }
      } catch (error) {
        console.error(`Error searching with query "${query}":`, error);
        // Continue with next query
      }
    }

    // If we don't have enough tracks, do a fallback search
    // Continue searching until we have at least 3x target count to account for filtering and artist limits
    while (allTracks.length < targetTrackCount * 3) {
      let fallbackQuery = genres[0] || 'pop';
      
      // For nature scenes, use more specific indie folk searches
      if (isNatureScene) {
        fallbackQuery = 'indie folk';
      }
      
      try {
        // Try multiple fallback queries
        const fallbackQueries = [
          `popular ${fallbackQuery}`,
          fallbackQuery,
          `genre:"${fallbackQuery}"`,
        ];
        
        let foundNewTracks = false;
        for (const query of fallbackQueries) {
          if (allTracks.length >= targetTrackCount * 2) break;
          
          const fallbackResults = await spotifyApi.searchTracks(query, {
            limit: 50, // Get more tracks per query
          });
          
          if (fallbackResults.body.tracks?.items) {
            for (const track of fallbackResults.body.tracks.items) {
              if (allTracks.length >= targetTrackCount * 2) break;
              if (!track || !track.id) continue;
              
              // Check if track is already in our list using Set (faster and more reliable)
              if (seenTrackIds.has(track.id)) {
                continue;
              }
              
              const primaryArtist = track.artists?.[0]?.name || '';
              if (primaryArtist && artistCounts[primaryArtist] >= maxTracksPerArtist) {
                continue;
              }
              
              // Add track ID to seen set
              seenTrackIds.add(track.id);
              
              allTracks.push(track);
              foundNewTracks = true;
              
              if (primaryArtist) {
                artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
              }
            }
          }
        }
        
        // If we didn't find any new tracks, break to avoid infinite loop
        if (!foundNewTracks) {
          break;
        }
      } catch (error) {
        console.error('Error in fallback search:', error);
        break; // Break on error to avoid infinite loop
      }
      
      // Safety check: if we've tried multiple times and still don't have enough, break
      if (allTracks.length < targetTrackCount && allTracks.length > 0) {
        // We have some tracks but not enough - this is okay, we'll work with what we have
        break;
      }
    }

    if (allTracks.length === 0) {
      return res.status(404).json({ error: 'No tracks found matching the analysis' });
    }

    // Apply popularity filter based on user selection
    let filteredTracks = [...allTracks];
    
    if (filter === 'mainstream') {
      // Prioritize high popularity tracks (50+)
      filteredTracks = allTracks.filter(t => (t.popularity || 0) >= 50);
      // If not enough tracks, lower the threshold
      if (filteredTracks.length < targetTrackCount) {
        filteredTracks = allTracks.filter(t => (t.popularity || 0) >= 40);
      }
      // Sort by popularity descending
      filteredTracks.sort((a, b) => {
        const popularityA = a.popularity || 0;
        const popularityB = b.popularity || 0;
        return popularityB - popularityA;
      });
    } else if (filter === 'indie') {
      // Prioritize lower popularity tracks - indie/emerging artists
      filteredTracks = allTracks.filter(t => {
        const pop = t.popularity || 0;
        return pop < 60; // Focus on less popular tracks
      });
      // If not enough tracks, raise the threshold slightly
      if (filteredTracks.length < targetTrackCount) {
        filteredTracks = allTracks.filter(t => (t.popularity || 0) < 70);
      }
      // Sort by popularity ascending (least popular first)
      filteredTracks.sort((a, b) => {
        const popularityA = a.popularity || 0;
        const popularityB = b.popularity || 0;
        return popularityA - popularityB;
      });
    } else {
      // 'mixed' - balanced mix of all popularity levels
      // Group into tiers and mix them
      const highPop = allTracks.filter(t => (t.popularity || 0) >= 70);
      const medPop = allTracks.filter(t => (t.popularity || 0) >= 40 && (t.popularity || 0) < 70);
      const lowPop = allTracks.filter(t => (t.popularity || 0) < 40);
      
      // Shuffle within each tier
      const shuffleArray = (arr: any[]) => arr.sort(() => Math.random() - 0.5);
      
      // Mix: take some from each tier, proportional to availability
      const totalNeeded = targetTrackCount;
      const highCount = Math.min(Math.ceil(totalNeeded * 0.35), highPop.length);
      const medCount = Math.min(Math.ceil(totalNeeded * 0.35), medPop.length);
      const lowCount = Math.min(Math.ceil(totalNeeded * 0.30), lowPop.length);
      
      filteredTracks = [
        ...shuffleArray(highPop).slice(0, highCount),
        ...shuffleArray(medPop).slice(0, medCount),
        ...shuffleArray(lowPop).slice(0, lowCount),
      ];
      
      // If we still don't have enough, fill from remaining tracks
      if (filteredTracks.length < targetTrackCount) {
        const filteredTrackIds = new Set(filteredTracks.map(ft => ft.id));
        const remaining = allTracks.filter(t => !filteredTrackIds.has(t.id));
        filteredTracks = [...filteredTracks, ...shuffleArray(remaining).slice(0, targetTrackCount - filteredTracks.length)];
      }
      
      // Shuffle the final mix
      filteredTracks = shuffleArray(filteredTracks);
    }
    
    // Shuffle within the filtered results for variety (unless already sorted)
    if (filter !== 'mainstream' && filter !== 'indie') {
      const shuffleArray = (arr: any[]) => arr.sort(() => Math.random() - 0.5);
      filteredTracks = shuffleArray(filteredTracks);
    }
    
    const shuffledTracks = filteredTracks;

    // Final deduplication pass - use a fresh Set to catch any duplicates that slipped through
    const finalSeenTrackIds = new Set<string>();
    const deduplicatedTracks = shuffledTracks.filter(track => {
      if (!track || !track.id) return false;
      if (finalSeenTrackIds.has(track.id)) {
        return false; // Duplicate - skip
      }
      finalSeenTrackIds.add(track.id);
      return true;
    });

    // Get tracks with preview URLs, ensuring artist diversity and no duplicates
    // Also filter out tracks where mood words appear in the title
    const moodWordsToFilter = ['calm', 'happy', 'sad', 'chill', 'energetic', 'dreamy', 'romantic', 'nostalgic', 'melancholy'];
    const primaryMood = mood?.toLowerCase() || '';
    
    const tracks = deduplicatedTracks
      .slice(0, targetTrackCount * 1.5) // Get more tracks to filter from
      .filter(track => {
        // Filter out tracks where the primary mood word appears in the title
        if (primaryMood && track.name) {
          const trackNameLower = track.name.toLowerCase();
          // Check if the mood word appears as a whole word in the title (not just part of another word)
          const moodWordRegex = new RegExp(`\\b${primaryMood}\\b`, 'i');
          if (moodWordRegex.test(trackNameLower)) {
            return false; // Skip tracks with mood word in title
          }
        }
        
        return true;
      })
      .slice(0, targetTrackCount * 2) // Get more tracks to filter for preview URLs
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
      .filter(track => track.id) // Only include tracks with IDs
      // Prioritize tracks with preview URLs
      .sort((a, b) => {
        if (a.preview_url && !b.preview_url) return -1;
        if (!a.preview_url && b.preview_url) return 1;
        return 0;
      })
      .slice(0, targetTrackCount); // Take final count after sorting
    
    // Final safety check - remove any duplicates by ID that might have slipped through
    const finalTrackIds = new Set<string>();
    let uniqueTracks = tracks.filter(track => {
      if (finalTrackIds.has(track.id)) {
        return false; // Duplicate
      }
      finalTrackIds.add(track.id);
      return true;
    });

    // If we have fewer than 20 tracks, fill from remaining tracks in allTracks
    if (uniqueTracks.length < targetTrackCount) {
      const usedTrackIds = new Set(uniqueTracks.map(t => t.id));
      const currentArtistCounts: { [key: string]: number } = {};
      
      // Count current artists in uniqueTracks
      uniqueTracks.forEach(track => {
        const artistName = track.artists?.split(', ')[0] || '';
        if (artistName) {
          currentArtistCounts[artistName] = (currentArtistCounts[artistName] || 0) + 1;
        }
      });
      
      const remainingTracks = deduplicatedTracks
        .filter(track => track && track.id && !usedTrackIds.has(track.id))
        .filter(track => {
          // Apply mood word filter if needed
          if (primaryMood && track.name) {
            const trackNameLower = track.name.toLowerCase();
            const moodWordRegex = new RegExp(`\\b${primaryMood}\\b`, 'i');
            if (moodWordRegex.test(trackNameLower)) {
              return false;
            }
          }
          
          // Check artist limit
          const primaryArtist = track.artists?.[0]?.name || '';
          if (primaryArtist && currentArtistCounts[primaryArtist] >= maxTracksPerArtist) {
            return false; // Too many tracks from this artist
          }
          
          return true;
        })
        .slice(0, targetTrackCount - uniqueTracks.length)
        .map(track => {
          const primaryArtist = track.artists?.[0]?.name || '';
          if (primaryArtist) {
            currentArtistCounts[primaryArtist] = (currentArtistCounts[primaryArtist] || 0) + 1;
          }
          return {
            id: track.id,
            name: track.name,
            artists: track.artists.map((artist: any) => artist.name).join(', '),
            album: track.album?.name || '',
            preview_url: track.preview_url,
            external_urls: track.external_urls,
            uri: track.uri,
            duration_ms: track.duration_ms,
            album_image: track.album?.images?.[0]?.url || null,
          };
        })
        .filter(track => track.id);
      
      uniqueTracks = [...uniqueTracks, ...remainingTracks];
    }
    
    // If still not enough, try to get more from allTracks without mood filtering
    if (uniqueTracks.length < targetTrackCount) {
      const usedTrackIds = new Set(uniqueTracks.map(t => t.id));
      const currentArtistCounts: { [key: string]: number } = {};
      
      // Count current artists in uniqueTracks
      uniqueTracks.forEach(track => {
        const artistName = track.artists?.split(', ')[0] || '';
        if (artistName) {
          currentArtistCounts[artistName] = (currentArtistCounts[artistName] || 0) + 1;
        }
      });
      
      const additionalTracks = allTracks
        .filter(track => track && track.id && !usedTrackIds.has(track.id))
        .filter(track => {
          // Check artist limit
          const primaryArtist = track.artists?.[0]?.name || '';
          if (primaryArtist && currentArtistCounts[primaryArtist] >= maxTracksPerArtist) {
            return false; // Too many tracks from this artist
          }
          return true;
        })
        .slice(0, targetTrackCount - uniqueTracks.length)
        .map(track => {
          const primaryArtist = track.artists?.[0]?.name || '';
          if (primaryArtist) {
            currentArtistCounts[primaryArtist] = (currentArtistCounts[primaryArtist] || 0) + 1;
          }
          return {
            id: track.id,
            name: track.name,
            artists: track.artists.map((artist: any) => artist.name).join(', '),
            album: track.album?.name || '',
            preview_url: track.preview_url,
            external_urls: track.external_urls,
            uri: track.uri,
            duration_ms: track.duration_ms,
            album_image: track.album?.images?.[0]?.url || null,
          };
        })
        .filter(track => track.id);
      
      uniqueTracks = [...uniqueTracks, ...additionalTracks];
    }
    
    // Final deduplication pass on the combined list
    const finalUniqueTrackIds = new Set<string>();
    const finalArtistCounts: { [key: string]: number } = {};
    
    uniqueTracks = uniqueTracks.filter(track => {
      if (finalUniqueTrackIds.has(track.id)) {
        return false; // Duplicate track ID
      }
      
      // Enforce max 3 tracks per artist in final list
      const artistName = track.artists?.split(', ')[0] || ''; // Get first artist name
      if (artistName && finalArtistCounts[artistName] >= maxTracksPerArtist) {
        return false; // Too many tracks from this artist
      }
      
      finalUniqueTrackIds.add(track.id);
      if (artistName) {
        finalArtistCounts[artistName] = (finalArtistCounts[artistName] || 0) + 1;
      }
      return true;
    });
    
    // If we have fewer than 20 tracks after deduplication, fill from allTracks
    while (uniqueTracks.length < targetTrackCount && allTracks.length > 0) {
      const usedTrackIds = new Set(uniqueTracks.map(t => t.id));
      const needed = targetTrackCount - uniqueTracks.length;
      
      // Get more tracks from allTracks that aren't already used
      const moreTracks = allTracks
        .filter(track => {
          if (!track || !track.id) return false;
          if (usedTrackIds.has(track.id)) return false;
          
          // Check artist limit
          const primaryArtist = track.artists?.[0]?.name || '';
          const artistName = primaryArtist;
          if (artistName && finalArtistCounts[artistName] >= maxTracksPerArtist) {
            return false;
          }
          
          return true;
        })
        .slice(0, needed)
        .map(track => {
          const primaryArtist = track.artists?.[0]?.name || '';
          const artistName = primaryArtist;
          if (artistName) {
            finalArtistCounts[artistName] = (finalArtistCounts[artistName] || 0) + 1;
          }
          return {
            id: track.id,
            name: track.name,
            artists: track.artists.map((artist: any) => artist.name).join(', '),
            album: track.album?.name || '',
            preview_url: track.preview_url,
            external_urls: track.external_urls,
            uri: track.uri,
            duration_ms: track.duration_ms,
            album_image: track.album?.images?.[0]?.url || null,
          };
        })
        .filter(track => track.id);
      
      if (moreTracks.length === 0) {
        // No more tracks available that meet our criteria
        break;
      }
      
      uniqueTracks = [...uniqueTracks, ...moreTracks];
    }
    
    // Take exactly 20 tracks (or as many as we have if less than 20)
    uniqueTracks = uniqueTracks.slice(0, targetTrackCount);

    if (uniqueTracks.length === 0) {
      return res.status(404).json({ error: 'No valid tracks found' });
    }

    console.log(`Returning ${uniqueTracks.length} tracks (target: ${targetTrackCount})`);

    return res.json({
      success: true,
      playlistTheme,
      tracks: uniqueTracks,
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

