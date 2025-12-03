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
    const artistsFromAnalysis = analysis.artists || []; // Get artists from OpenAI analysis
    const school = analysis.school || null; // Get school name if detected

    // School-specific songs mapping
    const schoolSongs: { [key: string]: string[] } = {
      'unc chapel hill': ['Carolina on my mind', 'Carolina in my mind', 'Carolina', 'Tar Heel', 'UNC', 'Chapel Hill'],
      'unc': ['Carolina on my mind', 'Carolina in my mind', 'Carolina', 'Tar Heel', 'UNC', 'Chapel Hill'],
      'university of north carolina': ['Carolina on my mind', 'Carolina in my mind', 'Carolina', 'Tar Heel', 'UNC', 'Chapel Hill'],
      'duke university': ['Duke', 'Blue Devil', 'Duke Blue Devils'],
      'duke': ['Duke', 'Blue Devil', 'Duke Blue Devils'],
      'harvard university': ['Harvard', 'Crimson'],
      'harvard': ['Harvard', 'Crimson'],
      'yale university': ['Yale', 'Bulldog'],
      'yale': ['Yale', 'Bulldog'],
      'stanford university': ['Stanford', 'Cardinal'],
      'stanford': ['Stanford', 'Cardinal'],
      'mit': ['MIT', 'Massachusetts Institute of Technology'],
      'massachusetts institute of technology': ['MIT', 'Massachusetts Institute of Technology'],
      'princeton university': ['Princeton', 'Tiger'],
      'princeton': ['Princeton', 'Tiger'],
      'columbia university': ['Columbia', 'Lion'],
      'columbia': ['Columbia', 'Lion'],
      'university of pennsylvania': ['Penn', 'Quaker'],
      'penn': ['Penn', 'Quaker'],
      'upenn': ['Penn', 'Quaker'],
    };

    // Check if a specific school is detected
    let detectedSchool: string | null = null;
    let schoolSearchTerms: string[] = [];
    
    if (school) {
      const schoolLower = school.toLowerCase();
      // Check for exact matches or partial matches
      for (const [schoolKey, songs] of Object.entries(schoolSongs)) {
        if (schoolLower.includes(schoolKey) || schoolKey.includes(schoolLower)) {
          detectedSchool = schoolKey;
          schoolSearchTerms = songs;
          console.log(`School detected: ${school} - Adding school-specific songs: ${songs.join(', ')}`);
          break;
        }
      }
      
      // If no exact match, try to extract school name from description
      if (!detectedSchool && description) {
        const descLower = description.toLowerCase();
        for (const [schoolKey, songs] of Object.entries(schoolSongs)) {
          if (descLower.includes(schoolKey)) {
            detectedSchool = schoolKey;
            schoolSearchTerms = songs;
            console.log(`School detected from description: ${schoolKey} - Adding school-specific songs: ${songs.join(', ')}`);
            break;
          }
        }
      }
    }

    // Check if this is a nature scene (forest, nature, woods, mountains, etc.)
    const isNatureScene = description?.toLowerCase().includes('forest') || 
                         description?.toLowerCase().includes('nature') || 
                         description?.toLowerCase().includes('wood') ||
                         description?.toLowerCase().includes('mountain') ||
                         description?.toLowerCase().includes('tree') ||
                         genres[0]?.toLowerCase().includes('folk') ||
                         genres[0]?.toLowerCase().includes('indie folk');

    // Check if this is a classroom/school scene - be more aggressive with detection
    const descriptionLower = description?.toLowerCase() || '';
    const isClassroomScene = descriptionLower.includes('classroom') || 
                            descriptionLower.includes('school') || 
                            descriptionLower.includes('study') ||
                            descriptionLower.includes('desk') ||
                            descriptionLower.includes('student') ||
                            descriptionLower.includes('teacher') ||
                            descriptionLower.includes('education') ||
                            descriptionLower.includes('learning') ||
                            descriptionLower.includes('academic') ||
                            descriptionLower.includes('lecture') ||
                            descriptionLower.includes('whiteboard') ||
                            descriptionLower.includes('blackboard') ||
                            descriptionLower.includes('chalkboard') ||
                            genres[0]?.toLowerCase().includes('lofi') ||
                            genres[0]?.toLowerCase().includes('lo-fi') ||
                            genres.some((g: string) => g?.toLowerCase().includes('lofi')) ||
                            genres.some((g: string) => g?.toLowerCase().includes('lo-fi'));

    // Use artists from OpenAI analysis (primary source)
    // If analysis didn't provide artists, fall back to genre-based mapping
    let seedArtists: string[] = [];
    
    // FORCE lofi artists for classroom scenes, regardless of what OpenAI returns
    const lofiArtists = ['Lofi Girl', 'Chillhop Music', 'Kupla', 'Idealism', 'Jinsang', 'Nujabes', 'Tomppabeats', 'Birocratic', 'Sleepy Fish', 'Aso', 'eery', 'SwuM', 'Bonobo', 'Tycho', 'Boards of Canada', 'Brian Eno'];
    
    if (isClassroomScene) {
      // For classroom scenes, prioritize lofi artists
      console.log('Classroom scene detected - forcing lofi/study music');
      seedArtists = [...lofiArtists];
      
      // Also add any lofi artists from the analysis if they exist
      if (artistsFromAnalysis && artistsFromAnalysis.length > 0) {
        const lofiFromAnalysis = artistsFromAnalysis.filter((artist: string) => 
          lofiArtists.some((lofi: string) => artist.toLowerCase().includes(lofi.toLowerCase()) || lofi.toLowerCase().includes(artist.toLowerCase()))
        );
        seedArtists = [...new Set([...seedArtists, ...lofiFromAnalysis])];
      }
      
      // Limit to 25 but prioritize lofi
      seedArtists = seedArtists.slice(0, 25);
      console.log(`Using ${seedArtists.length} lofi/study artists for classroom scene`);
    } else if (artistsFromAnalysis && artistsFromAnalysis.length > 0) {
      // Use the artists from OpenAI analysis - they're specifically matched to the image
      seedArtists = artistsFromAnalysis.slice(0, 25); // Use up to 25 artists from analysis
      console.log(`Using ${seedArtists.length} artists from OpenAI analysis`);
    } else {
      // Fallback: Use genre-based artist mapping if analysis didn't provide artists
      console.log('No artists from analysis, using fallback genre mapping');
      const genreToArtists: { [key: string]: string[] } = {
        'indie folk': ['Noah Kahan', 'Hozier', 'Lizzy McAlpine', 'Mt. Joy', 'Bon Iver', 'The Lumineers', 'Gregory Alan Isakov', 'Phoebe Bridgers', 'Fleet Foxes', 'Iron & Wine', 'Ben Howard', 'Jose Gonzalez'],
        'folk pop': ['Noah Kahan', 'Hozier', 'Lizzy McAlpine', 'Mt. Joy', 'The Lumineers', 'Mumford & Sons', 'Of Monsters and Men', 'Vance Joy'],
        'folk': ['Noah Kahan', 'Hozier', 'The Lumineers', 'Mumford & Sons', 'Iron & Wine', 'Fleet Foxes', 'Bon Iver'],
        'pop': ['Taylor Swift', 'Ariana Grande', 'Ed Sheeran', 'Dua Lipa', 'The Weeknd', 'Billie Eilish', 'Olivia Rodrigo', 'Harry Styles'],
        'indie pop': ['Phoebe Bridgers', 'Clairo', 'Boygenius', 'Lorde', 'Tame Impala', 'Arctic Monkeys', 'The 1975', 'Lana Del Rey'],
        'hip hop': ['Drake', 'Kendrick Lamar', 'Travis Scott', 'Post Malone', 'J. Cole', 'Tyler, The Creator', 'Kanye West'],
        'R&B': ['The Weeknd', 'SZA', 'Frank Ocean', 'Daniel Caesar', 'Khalid', 'H.E.R.', 'Alicia Keys'],
        'country': ['Luke Combs', 'Morgan Wallen', 'Zach Bryan', 'Kacey Musgraves', 'Chris Stapleton', 'Maren Morris'],
        'acoustic': ['Ed Sheeran', 'John Mayer', 'James Bay', 'Damien Rice', 'Ben Howard', 'Jose Gonzalez'],
        'rock': ['The Killers', 'Arctic Monkeys', 'Foo Fighters', 'Red Hot Chili Peppers', 'Imagine Dragons'],
        'electronic': ['Daft Punk', 'The Chemical Brothers', 'ODESZA', 'Flume', 'Disclosure'],
        'dance': ['Calvin Harris', 'David Guetta', 'Avicii', 'Swedish House Mafia', 'Martin Garrix'],
        'lofi': ['Lofi Girl', 'Chillhop Music', 'Kupla', 'Idealism', 'Jinsang', 'Nujabes', 'Tomppabeats', 'Birocratic', 'Sleepy Fish', 'Aso', 'eery', 'SwuM', 'Bonobo', 'Tycho'],
        'lo-fi': ['Lofi Girl', 'Chillhop Music', 'Kupla', 'Idealism', 'Jinsang', 'Nujabes', 'Tomppabeats', 'Birocratic', 'Sleepy Fish', 'Aso', 'eery', 'SwuM', 'Bonobo', 'Tycho'],
        'ambient': ['Bonobo', 'Tycho', 'Boards of Canada', 'Brian Eno', 'Marconi Union', 'Hammock', 'Stars of the Lid'],
        'instrumental': ['Bonobo', 'Tycho', 'Nujabes', 'Jinsang', 'Tomppabeats', 'Birocratic'],
        'chill': ['Lofi Girl', 'Chillhop Music', 'Kupla', 'Bonobo', 'Tycho', 'ODESZA'],
      };
      
      for (const genre of genres.slice(0, 3)) {
        const genreKey = genre.toLowerCase();
        const artists = genreToArtists[genreKey] || [];
        for (const artist of artists.slice(0, 5)) {
          if (!seedArtists.includes(artist)) {
            seedArtists.push(artist);
          }
        }
      }
    }

    // Get seed genres for recommendations API
    const seedGenres: string[] = [];
    
    // FORCE chill/ambient genres for classroom scenes
    if (isClassroomScene) {
      seedGenres.push('chill', 'ambient');
      console.log('Forcing chill/ambient genres for classroom scene');
    } else {
      for (const genre of genres.slice(0, 2)) {
        const genreKey = genre.toLowerCase();
        let spotifyGenre = genreKey
          .replace(/\s+/g, '-')
          .replace('r&b', 'r-n-b')
          .replace('hip-hop', 'hip-hop')
          .replace('indie-folk', 'indie-folk')
          .replace('folk-pop', 'folk-pop');
        
        // Map lofi/lo-fi to Spotify's genre format
        if (genreKey === 'lofi' || genreKey === 'lo-fi') {
          spotifyGenre = 'chill';
        }
        
        if (!seedGenres.includes(spotifyGenre)) {
          seedGenres.push(spotifyGenre);
        }
      }
    }

    // Search for artist IDs (needed for recommendations API)
    // Use more artists (up to 5) for seed, but search through many more for direct track searches
    const artistIds: string[] = [];
    const artistSearchPromises = seedArtists.slice(0, 5).map(async (artistName) => {
      try {
        const artistSearch = await spotifyApi.searchArtists(artistName, { limit: 1 });
        if (artistSearch.body.artists?.items?.[0]?.id) {
          return artistSearch.body.artists.items[0].id;
        }
      } catch (error) {
        console.error(`Error searching for artist "${artistName}":`, error);
      }
      return null;
    });
    
    const resolvedIds = await Promise.all(artistSearchPromises);
    artistIds.push(...resolvedIds.filter((id): id is string => id !== null));

    // Create search queries for direct track searches (as backup/complement to recommendations)
    const searchQueries: string[] = [];
    
    // Add school-specific songs FIRST (highest priority) if a school is detected
    if (detectedSchool && schoolSearchTerms.length > 0) {
      console.log(`Adding ${schoolSearchTerms.length} school-specific search queries for ${detectedSchool}`);
      // Add direct song title searches for school-specific songs
      for (const songTerm of schoolSearchTerms) {
        searchQueries.push(`"${songTerm}"`);
      }
      // Also add searches combining school name with common music terms
      const schoolName = school || detectedSchool;
      searchQueries.push(`${schoolName} fight song`);
      searchQueries.push(`${schoolName} anthem`);
      searchQueries.push(`${schoolName} song`);
    }
    
    // For classroom scenes, prioritize lofi/study music searches
    if (isClassroomScene) {
      // Add lofi-specific search terms
      searchQueries.push('lofi');
      searchQueries.push('lo-fi');
      searchQueries.push('study music');
      searchQueries.push('chillhop');
      searchQueries.push('lofi hip hop');
      
      // Add artist-based searches for lofi artists
      for (const artist of lofiArtists.slice(0, 20)) {
        searchQueries.push(`artist:"${artist}"`);
      }
    } else {
      // Add artist-based searches - use artists from the analysis (up to 25)
      // This gives us a large pool of tracks to choose from
      for (const artist of seedArtists.slice(0, 25)) {
        searchQueries.push(`artist:"${artist}"`);
      }
    }
    
    // Add genre + mood/energy searches (combine to avoid title-only matches)
    if (genres.length > 0) {
      const primaryGenre = genres[0];
      
      // Combine genre with mood
      if (mood) {
        searchQueries.push(`${primaryGenre} ${mood}`);
      }
      
      // Combine genre with energy descriptors
      if (energy === 'high') {
        searchQueries.push(`${primaryGenre} upbeat`);
      } else if (energy === 'low') {
        searchQueries.push(`${primaryGenre} mellow`);
        searchQueries.push(`${primaryGenre} acoustic`);
      }
      
      // Combine genre with musical keywords
      for (const keyword of musicalKeywords.slice(0, 3)) {
        searchQueries.push(`${primaryGenre} ${keyword}`);
      }
    }

    // Helper function to check if a track is school-related
    const isSchoolRelatedTrack = (track: any): boolean => {
      if (!detectedSchool || schoolSearchTerms.length === 0) return false;
      
      const trackName = (track.name || '').toLowerCase();
      const artistName = (track.artists?.[0]?.name || '').toLowerCase();
      const albumName = (track.album?.name || '').toLowerCase();
      
      // Check if track name, artist, or album contains any school-specific terms
      for (const term of schoolSearchTerms) {
        const termLower = term.toLowerCase();
        if (trackName.includes(termLower) || artistName.includes(termLower) || albumName.includes(termLower)) {
          return true;
        }
      }
      
      // Also check for school name in track metadata
      const schoolNameLower = (school || detectedSchool).toLowerCase();
      if (trackName.includes(schoolNameLower) || artistName.includes(schoolNameLower)) {
        return true;
      }
      
      return false;
    };

    // Helper function for shuffling arrays (Fisher-Yates shuffle)
    const shuffleArray = <T,>(arr: T[]): T[] => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Perform multiple searches to get diverse results
    let allTracks: any[] = [];
    const seenTrackIds = new Set<string>(); // Track IDs we've already added
    const artistCounts: { [key: string]: number } = {};
    const maxTracksPerArtist = 3; // Maximum tracks per artist (at most 3)
    const targetTrackCount = 20;

    // PRIMARY METHOD: Use Spotify Recommendations API for accurate genre matching
    if (artistIds.length > 0 || seedGenres.length > 0) {
      try {
        // Build recommendations parameters
        const recommendationsParams: any = {
          limit: 50, // Get more recommendations
        };
        
        // Add seed artists (up to 5) - shuffle to get different results on refresh
        if (artistIds.length > 0) {
          const shuffledArtistIds = [...artistIds].sort(() => Math.random() - 0.5);
          recommendationsParams.seed_artists = shuffledArtistIds.slice(0, 5);
        }
        
        // Add seed genres (up to 2) - shuffle to get different results on refresh
        if (seedGenres.length > 0) {
          const shuffledGenres = [...seedGenres].sort(() => Math.random() - 0.5);
          recommendationsParams.seed_genres = shuffledGenres.slice(0, 2);
        }
        
        // Special handling for classroom scenes - prioritize lofi/study music
        if (isClassroomScene) {
          recommendationsParams.target_energy = 0.2;
          recommendationsParams.max_energy = 0.4;
          recommendationsParams.target_tempo = 85;
          recommendationsParams.max_tempo = 100;
          recommendationsParams.target_valence = 0.5;
          recommendationsParams.target_danceability = 0.3;
          recommendationsParams.max_danceability = 0.5;
          recommendationsParams.target_instrumentalness = 0.7;
          recommendationsParams.min_instrumentalness = 0.5;
        } else {
          // Map energy to target_energy (0.0 to 1.0)
          if (energy === 'high') {
            recommendationsParams.target_energy = 0.8;
            recommendationsParams.min_energy = 0.6;
          } else if (energy === 'low') {
            recommendationsParams.target_energy = 0.3;
            recommendationsParams.max_energy = 0.5;
          } else {
            recommendationsParams.target_energy = 0.5;
          }
          
          // Map tempo to target_tempo (BPM)
          if (tempo === 'fast') {
            recommendationsParams.target_tempo = 140;
            recommendationsParams.min_tempo = 120;
          } else if (tempo === 'slow') {
            recommendationsParams.target_tempo = 80;
            recommendationsParams.max_tempo = 100;
          } else {
            recommendationsParams.target_tempo = 110;
          }
          
          // Map mood to valence (positivity) and danceability
          if (mood) {
            const moodLower = mood.toLowerCase();
            if (['happy', 'upbeat', 'energetic'].includes(moodLower)) {
              recommendationsParams.target_valence = 0.8;
              recommendationsParams.target_danceability = 0.7;
            } else if (['sad', 'melancholy', 'melancholic'].includes(moodLower)) {
              recommendationsParams.target_valence = 0.3;
              recommendationsParams.max_valence = 0.5;
            } else if (['calm', 'chill', 'peaceful'].includes(moodLower)) {
              recommendationsParams.target_energy = 0.3;
              recommendationsParams.target_valence = 0.5;
            } else if (['romantic', 'dreamy'].includes(moodLower)) {
              recommendationsParams.target_valence = 0.6;
              recommendationsParams.target_energy = 0.4;
            }
          }
        }
        
        const recommendations = await spotifyApi.getRecommendations(recommendationsParams);
        
        if (recommendations.body.tracks) {
          // Shuffle recommendations to get different order on each refresh
          const shuffledTracks = [...recommendations.body.tracks].sort(() => Math.random() - 0.5);
          
          for (const track of shuffledTracks) {
            if (!track || !track.id) continue;
            if (seenTrackIds.has(track.id)) continue;
            
            const primaryArtist = track.artists?.[0]?.name || '';
            if (primaryArtist && artistCounts[primaryArtist] >= maxTracksPerArtist) {
              continue;
            }
            
            seenTrackIds.add(track.id);
            allTracks.push(track);
            
            if (primaryArtist) {
              artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
            }
          }
        }
      } catch (error) {
        console.error('Error getting recommendations:', error);
        // Fall back to search if recommendations fail
      }
    }

    // SECONDARY METHOD: Direct track searches to complement recommendations
    // Prioritize school-specific queries if a school is detected
    // Shuffle queries to ensure different results on each refresh
    let orderedQueries: string[] = [];
    if (detectedSchool && schoolSearchTerms.length > 0) {
      // Put school-specific queries first
      const schoolQueries = searchQueries.filter(q => 
        schoolSearchTerms.some(term => q.toLowerCase().includes(term.toLowerCase()))
      );
      const otherQueries = searchQueries.filter(q => 
        !schoolSearchTerms.some(term => q.toLowerCase().includes(term.toLowerCase()))
      );
      // Shuffle other queries for variety
      orderedQueries = [...schoolQueries, ...shuffleArray(otherQueries)];
    } else {
      // Shuffle all queries for randomization
      orderedQueries = shuffleArray(searchQueries);
    }
    
    for (const query of orderedQueries.slice(0, 15)) { // Increased from 10 to 15 to give more room for school searches
      if (allTracks.length >= targetTrackCount * 3) break;
      
      try {
        const searchResults = await spotifyApi.searchTracks(query, {
          limit: 10,
        });

        if (searchResults.body.tracks?.items) {
          for (const track of searchResults.body.tracks.items) {
            if (!track || !track.id) continue;
            if (seenTrackIds.has(track.id)) continue;
            
            const primaryArtist = track.artists?.[0]?.name || '';
            if (primaryArtist && artistCounts[primaryArtist] >= maxTracksPerArtist) {
              continue;
            }
            
            seenTrackIds.add(track.id);
            allTracks.push(track);
            
            if (primaryArtist) {
              artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
            }
          }
        }
      } catch (error) {
        console.error(`Error searching with query "${query}":`, error);
      }
    }

    // If we don't have enough tracks, do a fallback search using more artists from the analysis
    // Continue searching until we have at least 3x target count to account for filtering and artist limits
    if (allTracks.length < targetTrackCount * 2 && seedArtists.length > 5) {
      // Use more artists from the analysis that we haven't searched yet
      const fallbackArtists = seedArtists.slice(5, 25); // Use artists 6-25 from the list
      
      // Search for tracks by these artists
      for (const artist of fallbackArtists) {
        if (allTracks.length >= targetTrackCount * 2) break;
        
        try {
          const fallbackResults = await spotifyApi.searchTracks(`artist:"${artist}"`, {
            limit: 20,
          });
          
          if (fallbackResults.body.tracks?.items) {
            for (const track of fallbackResults.body.tracks.items) {
              if (allTracks.length >= targetTrackCount * 2) break;
              if (!track || !track.id) continue;
              if (seenTrackIds.has(track.id)) continue;
              
              const primaryArtist = track.artists?.[0]?.name || '';
              if (primaryArtist && artistCounts[primaryArtist] >= maxTracksPerArtist) {
                continue;
              }
              
              seenTrackIds.add(track.id);
              allTracks.push(track);
              
              if (primaryArtist) {
                artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
              }
            }
          }
        } catch (error) {
          console.error(`Error in fallback search for artist "${artist}":`, error);
        }
      }
    }

    if (allTracks.length === 0) {
      return res.status(404).json({ error: 'No tracks found matching the analysis' });
    }

    // For classroom scenes, filter out EDM/electronic/dance tracks that don't match the lofi vibe
    if (isClassroomScene) {
      const edmKeywords = ['edm', 'electronic', 'dance', 'house', 'techno', 'trance', 'dubstep', 'rave', 'festival'];
      allTracks = allTracks.filter(track => {
        if (!track || !track.name) return true;
        const trackNameLower = track.name.toLowerCase();
        const artistNameLower = track.artists?.[0]?.name?.toLowerCase() || '';
        const albumNameLower = track.album?.name?.toLowerCase() || '';
        
        // Filter out tracks with EDM keywords in name/artist/album
        const hasEdmKeyword = edmKeywords.some(keyword => 
          trackNameLower.includes(keyword) || 
          artistNameLower.includes(keyword) || 
          albumNameLower.includes(keyword)
        );
        
        // Also filter out high-energy tracks (EDM is typically high energy)
        const isHighEnergy = (track as any).energy && (track as any).energy > 0.7;
        
        return !hasEdmKeyword && !isHighEnergy;
      });
      console.log(`Filtered EDM tracks for classroom scene, ${allTracks.length} tracks remaining`);
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
      
      // Shuffle within each tier (using the shuffleArray function defined above)
      
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
    
    // Prioritize school-related tracks if a school is detected
    if (detectedSchool && schoolSearchTerms.length > 0) {
      const schoolTracks = filteredTracks.filter(track => isSchoolRelatedTrack(track));
      const nonSchoolTracks = filteredTracks.filter(track => !isSchoolRelatedTrack(track));
      
      console.log(`Found ${schoolTracks.length} school-related tracks for ${detectedSchool}`);
      
      // Prioritize school tracks: include at least 2-3 school-related tracks if available
      // But don't force too many if we don't have enough
      const schoolTrackCount = Math.min(schoolTracks.length, 5); // Max 5 school tracks
      const remainingCount = targetTrackCount - schoolTrackCount;
      
      // Combine: school tracks first, then fill with non-school tracks
      filteredTracks = [
        ...schoolTracks.slice(0, schoolTrackCount),
        ...nonSchoolTracks.slice(0, remainingCount)
      ];
      
      // If we still need more tracks, add remaining school tracks or non-school tracks
      if (filteredTracks.length < targetTrackCount) {
        const usedIds = new Set(filteredTracks.map(t => t.id));
        const remaining = [...schoolTracks.slice(schoolTrackCount), ...nonSchoolTracks.slice(remainingCount)]
          .filter(t => !usedIds.has(t.id));
        filteredTracks = [...filteredTracks, ...remaining.slice(0, targetTrackCount - filteredTracks.length)];
      }
    }
    
    // Always shuffle the final tracks to ensure variety on refresh (unless school tracks are prioritized)
    // Even for mainstream/indie filters, shuffle after sorting to get different results
    if (!detectedSchool || filteredTracks.length > 5) {
      // Shuffle all tracks, but if school tracks are prioritized, keep first few school tracks
      if (detectedSchool && schoolSearchTerms.length > 0) {
        // Keep first 2-3 school tracks, shuffle the rest
        const schoolTracksInList = filteredTracks.filter(t => isSchoolRelatedTrack(t));
        const nonSchoolTracksInList = filteredTracks.filter(t => !isSchoolRelatedTrack(t));
        const keepSchoolCount = Math.min(3, schoolTracksInList.length);
        filteredTracks = [
          ...schoolTracksInList.slice(0, keepSchoolCount),
          ...shuffleArray([...schoolTracksInList.slice(keepSchoolCount), ...nonSchoolTracksInList])
        ];
      } else {
        filteredTracks = shuffleArray(filteredTracks);
      }
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

    // FINAL ABSOLUTE DEDUPLICATION: Remove any duplicate tracks by ID
    const absoluteUniqueTracks: typeof uniqueTracks = [];
    const absoluteSeenIds = new Set<string>();
    
    for (const track of uniqueTracks) {
      if (!track || !track.id) continue;
      if (absoluteSeenIds.has(track.id)) {
        console.log(`Removing duplicate track: ${track.name} by ${track.artists} (ID: ${track.id})`);
        continue; // Skip duplicate
      }
      absoluteSeenIds.add(track.id);
      absoluteUniqueTracks.push(track);
    }
    
    uniqueTracks = absoluteUniqueTracks;

    if (uniqueTracks.length === 0) {
      return res.status(404).json({ error: 'No valid tracks found' });
    }

    console.log(`Returning ${uniqueTracks.length} unique tracks (target: ${targetTrackCount})`);

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

