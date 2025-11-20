import type { NextApiRequest, NextApiResponse } from 'next';
import { getSpotifyApi } from '@/lib/spotify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { analysis } = req.body;

    if (!analysis) {
      return res.status(400).json({ error: 'Analysis data is required' });
    }

    // Log what tokens we have
    console.log('Cookies received:', {
      hasAccessToken: !!req.cookies.spotify_access_token,
      hasRefreshToken: !!req.cookies.spotify_refresh_token,
      accessTokenLength: req.cookies.spotify_access_token?.length || 0,
    });
    
    // Verify environment variables are set
    const clientIdConfigured = !!process.env.SPOTIFY_CLIENT_ID;
    const clientSecretConfigured = !!process.env.SPOTIFY_CLIENT_SECRET;
    console.log('Spotify Client ID configured:', clientIdConfigured);
    console.log('Spotify Client Secret configured:', clientSecretConfigured);
    
    if (!clientIdConfigured || !clientSecretConfigured) {
      return res.status(500).json({ 
        error: 'Spotify credentials not configured on server',
      });
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
      console.error('getMe() error details:', {
        statusCode: error.statusCode,
        body: error.body,
        message: error.message,
      });
      
      if (error.statusCode === 401) {
        return res.status(401).json({ 
          error: 'Token expired. Please login to Spotify again.',
          requiresAuth: true,
        });
      }
      // If 403 on getMe(), the token is completely invalid or has no permissions
      // This is very unusual - getMe() should work with any valid token
      if (error.statusCode === 403) {
        console.error('CRITICAL: getMe() returned 403 - token is invalid or from wrong app');
        console.error('This usually means:');
        console.error('1. Token was obtained with a different Client ID');
        console.error('2. Token is corrupted or invalid');
        console.error('3. Client ID/Secret mismatch');
        
        return res.status(403).json({ 
          error: 'Token is invalid. This usually means the token was created with a different Spotify app. Please clear all cookies and login again.',
          requiresAuth: true,
          requiresReauth: true,
          debug: 'getMe() returned 403 - token appears invalid',
        });
      }
      throw error;
    }
    
    const userId = me.body.id;
    console.log('Creating playlist for user:', userId);

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

    // Get track URIs
    const trackUris = searchResults.body.tracks.items
      .map(track => track.uri)
      .filter(uri => uri) as string[];

    if (trackUris.length === 0) {
      return res.status(404).json({ error: 'No valid tracks found' });
    }

    // Create playlist description
    const description = `Created from photo analysis: ${analysis.description || 'A curated playlist based on your photo'}. Mood: ${mood}, Energy: ${energy}, Tempo: ${tempo}`;

    // Create the playlist
    // Note: createPlaylist signature is: createPlaylist(userId, name, options)
    let playlistResponse;
    try {
      console.log('Attempting to create playlist:', {
        userId,
        name: playlistTheme,
        description: description.substring(0, 300),
        public: true,
      });
      
      // createPlaylist signature: createPlaylist(userId, name, options)
      playlistResponse = await spotifyApi.createPlaylist(userId, playlistTheme, {
        description: description.substring(0, 300), // Spotify has a 300 char limit
        public: true,
      } as any);
    } catch (createError: any) {
      console.error('Error creating playlist:', createError);
      console.error('Create error details:', {
        statusCode: createError.statusCode,
        body: createError.body,
        message: createError.message,
      });
      
      // If 403, it's a permissions issue
      if (createError.statusCode === 403) {
        // Log the full error for debugging
        console.error('403 Forbidden Error Details:', {
          statusCode: createError.statusCode,
          body: createError.body,
          headers: createError.headers,
          message: createError.message,
        });
        
        // Try to extract more details from the error
        let detailedError = 'Permission denied. Your Spotify token does not have permission to create playlists.';
        if (createError.body && typeof createError.body === 'object') {
          if (createError.body.error?.message) {
            detailedError = createError.body.error.message;
          } else if (Object.keys(createError.body).length > 0) {
            detailedError += ` Details: ${JSON.stringify(createError.body)}`;
          }
        }
        
        return res.status(403).json({ 
          error: detailedError,
          requiresAuth: true,
          requiresReauth: true,
          debug: {
            statusCode: createError.statusCode,
            body: createError.body,
          },
        });
      }
      throw createError;
    }

    const playlist = (playlistResponse as any).body;
    console.log('Playlist created successfully:', playlist.id, playlist.name);

    // Add tracks to playlist (Spotify allows up to 100 tracks per request)
    const tracksToAdd = trackUris.slice(0, 50); // Limit to 50 tracks
    await spotifyApi.addTracksToPlaylist(playlist.id, tracksToAdd);

    return res.json({
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        external_urls: playlist.external_urls,
        tracks: {
          total: tracksToAdd.length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating playlist:', error);
    console.error('Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body,
      stack: error.stack,
    });
    
    // Check for authentication errors (401)
    if (error.message?.includes('No access token') || 
        error.message?.includes('No access token found') ||
        error.statusCode === 401 ||
        error.body?.error?.status === 401) {
      return res.status(401).json({ 
        error: 'Not authenticated. Please login to Spotify first. Your session may have expired.',
        requiresAuth: true,
      });
    }
    
    // Check for permission errors (403) - missing scopes or insufficient permissions
    if (error.statusCode === 403) {
      console.error('403 Forbidden - Missing playlist creation scopes');
      console.error('User needs to re-authenticate with playlist-modify scopes');
      return res.status(403).json({ 
        error: 'Permission denied. Your Spotify token does not have permission to create playlists. Please click "Login with Spotify" again and make sure to grant ALL permissions.',
        requiresAuth: true,
        requiresReauth: true,
        missingScopes: ['playlist-modify-public', 'playlist-modify-private'],
      });
    }
    
    // Check for token expiration
    if (error.statusCode === 401 || error.body?.error?.message?.includes('expired')) {
      return res.status(401).json({ 
        error: 'Your Spotify session has expired. Please login again.',
        requiresAuth: true,
      });
    }
    
    // Extract error message properly - handle WebapiError format
    let errorMessage = 'Failed to create playlist';
    
    // Try to extract from error body (Spotify API format)
    if (error.body) {
      if (typeof error.body === 'object') {
        if (error.body.error?.message) {
          errorMessage = String(error.body.error.message);
        } else if (error.body.error) {
          errorMessage = String(error.body.error);
        } else if (Object.keys(error.body).length > 0) {
          errorMessage = JSON.stringify(error.body);
        }
      } else if (typeof error.body === 'string') {
        errorMessage = error.body;
      }
    }
    
    // Fallback to error message
    if (errorMessage === 'Failed to create playlist' && error.message) {
      if (typeof error.message === 'string' && error.message !== '[object Object]') {
        errorMessage = error.message;
      }
    }
    
    // Add more context for debugging
    const statusCode = error.statusCode || 500;
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      spotifyError: true,
      statusCode: statusCode,
    });
  }
}

