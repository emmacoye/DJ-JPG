import type { NextApiRequest, NextApiResponse } from 'next';
import { getSpotifyApi } from '@/lib/spotify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { analysis, image, trackUris } = req.body;

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

    // Extract analysis data
    const genres = analysis.genres || ['pop'];
    const mood = analysis.mood || '';
    const energy = analysis.energy || 'medium';
    const tempo = analysis.tempo || 'moderate';
    const playlistTheme = analysis.playlistTheme || 'Photo Playlist';

    // Use track URIs from preview if provided, otherwise search for tracks
    let finalTrackUris: string[] = [];
    
    if (trackUris && Array.isArray(trackUris) && trackUris.length > 0) {
      // Use the exact tracks from the preview (what the user saw)
      console.log(`Using ${trackUris.length} track URIs from preview`);
      // Filter out duplicates by converting to Set and back to array
      const uniqueUris = Array.from(new Set(trackUris.filter(uri => uri && typeof uri === 'string')));
      finalTrackUris = uniqueUris;
      console.log(`After removing duplicates: ${finalTrackUris.length} unique tracks`);
    } else {
      // Fallback: search for tracks (shouldn't happen if preview was shown)
      console.log('No track URIs provided, searching for tracks...');
      
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

      // Get track URIs and remove duplicates
      const allUris = searchResults.body.tracks.items
        .map(track => track.uri)
        .filter(uri => uri) as string[];
      // Remove duplicates by converting to Set and back to array
      finalTrackUris = Array.from(new Set(allUris));
      console.log(`After removing duplicates: ${finalTrackUris.length} unique tracks`);
    }

    if (finalTrackUris.length === 0) {
      return res.status(404).json({ error: 'No valid tracks found' });
    }

    // Create playlist description
    const fullDescription = `Created from photo analysis: ${analysis.description || 'A curated playlist based on your photo'}. Mood: ${mood}, Energy: ${energy}, Tempo: ${tempo}`;
    
    // Truncate to 300 characters at the last complete word (don't cut off mid-word)
    const truncateDescription = (text: string, maxLength: number): string => {
      if (text.length <= maxLength) {
        return text;
      }
      // Find the last space before the max length
      const truncated = text.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      // If we found a space, cut there; otherwise just cut at maxLength
      return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
    };
    
    const description = truncateDescription(fullDescription, 300);

    // Create the playlist
    // Note: createPlaylist signature is: createPlaylist(userId, name, options)
    let playlistResponse;
    try {
      console.log('Attempting to create playlist:', {
        userId,
        name: playlistTheme,
        description: description,
        descriptionLength: description.length,
        public: false,
      });
      
      // Use raw HTTP API call instead of library method (library has callback issues)
      console.log('Creating playlist via raw HTTP API...');
      
      const accessToken = spotifyApi.getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      // Create playlist using Spotify Web API directly
      // Note: public: false means the playlist won't appear on your profile,
      // but it's not fully private - anyone with the link can still access it
      const playlistPayload = {
        name: playlistTheme,
        description: description, // Already truncated to 300 chars at word boundary
        public: false, // Set to false to hide from profile (not fully private via API)
        collaborative: false,
      };
      
      console.log('Playlist creation payload:', JSON.stringify(playlistPayload, null, 2));
      console.log('Public setting being sent:', playlistPayload.public);
      
      const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(playlistPayload),
      });
      
      if (!createPlaylistResponse.ok) {
        const errorText = await createPlaylistResponse.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
          errorJson = { message: errorText };
        }
        
        console.error('Spotify API error:', {
          status: createPlaylistResponse.status,
          statusText: createPlaylistResponse.statusText,
          body: errorJson,
        });
        
        // Throw an error that matches the library's error format
        const spotifyError: any = new Error(errorJson.error?.message || errorText || 'Failed to create playlist');
        spotifyError.statusCode = createPlaylistResponse.status;
        spotifyError.body = errorJson;
        throw spotifyError;
      }
      
      const playlistData = await createPlaylistResponse.json();
      console.log('Playlist created successfully via HTTP API:', playlistData.id, playlistData.name);
      console.log('Playlist visibility from Spotify response:', {
        public: playlistData.public,
        collaborative: playlistData.collaborative,
        snapshot_id: playlistData.snapshot_id,
      });
      
      // Format response to match library's expected format
      playlistResponse = { body: playlistData };
      
      // Log what we got back
      console.log('Playlist response received');
      console.log('Type:', typeof playlistResponse);
      console.log('Response:', playlistResponse);
      
      // Check if response is valid
      if (!playlistResponse) {
        throw new Error('createPlaylist returned undefined');
      }
    } catch (createError: any) {
      console.error('Error creating playlist:', createError);
      console.error('Create error details:', {
        statusCode: createError.statusCode,
        body: createError.body,
        message: createError.message,
        stack: createError.stack,
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

    // Handle different response formats
    let playlist: any;
    if (playlistResponse && (playlistResponse as any).body) {
      playlist = (playlistResponse as any).body;
    } else if (playlistResponse && (playlistResponse as any).id) {
      // If the response is the playlist object directly
      playlist = playlistResponse;
    } else {
      console.error('Unexpected playlist response format:', playlistResponse);
      throw new Error('Unexpected response format from createPlaylist');
    }
    console.log('Playlist created successfully:', playlist.id, playlist.name);
    console.log('Initial playlist visibility:', playlist.public);

    // Ensure playlist is private by updating it if needed
    if (playlist.public !== false) {
      console.log('Playlist was created as public, updating to private...');
      try {
        const updateResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${spotifyApi.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            public: false,
          }),
        });
        
        if (updateResponse.ok) {
          console.log('Playlist updated to private successfully');
        } else {
          const updateError = await updateResponse.text();
          console.warn('Failed to update playlist visibility:', updateResponse.status, updateError);
        }
      } catch (updateError) {
        console.warn('Error updating playlist visibility:', updateError);
      }
    }

    // Add tracks to playlist (Spotify allows up to 100 tracks per request)
    // Use the exact tracks from the preview
    const tracksToAdd = finalTrackUris.slice(0, 100); // Spotify allows up to 100 tracks per request
    await spotifyApi.addTracksToPlaylist(playlist.id, tracksToAdd);

    // Upload cover image if provided
    if (image) {
      try {
        // Get a fresh access token for image upload (refresh if needed)
        // Re-initialize the API to ensure we have a valid token
        const imageSpotifyApi = await getSpotifyApi(req, res);
        let imageAccessToken = imageSpotifyApi.getAccessToken();
        
        // If token is missing or expired, try to refresh it
        if (!imageAccessToken) {
          const refreshToken = req.cookies.spotify_refresh_token;
          if (refreshToken && res) {
            imageSpotifyApi.setRefreshToken(refreshToken);
            const refreshData = await imageSpotifyApi.refreshAccessToken();
            imageAccessToken = refreshData.body.access_token;
            
            // Update the cookie with new token
            const cookieOptions = {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax' as const,
              maxAge: refreshData.body.expires_in * 1000,
              path: '/',
            };
            
            res.setHeader(
              'Set-Cookie',
              `spotify_access_token=${imageAccessToken}; ${Object.entries(cookieOptions)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ')}`
            );
          } else {
            throw new Error('No access token available for image upload');
          }
        }
        
        // Spotify requires base64 JPEG data (without data URL prefix)
        // The image should already be in base64 format from the client
        let base64Image = image;
        
        // Remove data URL prefix if present (data:image/jpeg;base64,)
        if (base64Image.includes(',')) {
          base64Image = base64Image.split(',')[1];
        }
        
        // Spotify has a 256KB limit for cover images (after base64 encoding)
        // Check size (base64 is ~33% larger than binary)
        let imageSizeKB = (base64Image.length * 3) / 4 / 1024;
        
        // If image is too large, we'll need to compress it further
        // For now, we'll try to upload it and let Spotify handle it
        // If it fails, we'll log a warning but not fail the request
        if (imageSizeKB > 256) {
          console.warn(`Image size (${imageSizeKB.toFixed(0)}KB) exceeds Spotify's 256KB limit. Attempting upload anyway...`);
        }
        
        // Upload cover image using Spotify API
        // IMPORTANT: Spotify expects the base64 string directly in the body, NOT binary data
        // The Content-Type should be "image/jpeg" but the body is the base64 string
        const uploadImageResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/images`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${imageAccessToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: base64Image, // Send base64 string directly, not binary
        });
        
        if (uploadImageResponse.ok) {
          console.log('Cover image uploaded successfully');
        } else {
          const errorText = await uploadImageResponse.text();
          console.warn('Failed to upload cover image:', uploadImageResponse.status, errorText);
          
          // If it's a 401, check if it's a scope issue
          if (uploadImageResponse.status === 401) {
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error?.message?.includes('scope') || errorJson.error?.message?.includes('permission')) {
                console.error('Missing required scope for image upload. User needs to re-authenticate with ugc-image-upload scope.');
                // Don't retry - user needs to re-authenticate
              } else {
                // Token might be expired - try refreshing once more
                console.log('Token expired during image upload, attempting refresh...');
                const refreshToken = req.cookies.spotify_refresh_token;
                if (refreshToken && res) {
                  imageSpotifyApi.setRefreshToken(refreshToken);
                  const refreshData = await imageSpotifyApi.refreshAccessToken();
                  const newToken = refreshData.body.access_token;
                  
                  // Retry with new token
                  const retryResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/images`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${newToken}`,
                      'Content-Type': 'image/jpeg',
                    },
                    body: base64Image, // Send base64 string directly
                  });
                  
                  if (retryResponse.ok) {
                    console.log('Cover image uploaded successfully after token refresh');
                  } else {
                    const retryErrorText = await retryResponse.text();
                    console.warn('Failed to upload cover image after refresh:', retryResponse.status, retryErrorText);
                  }
                }
              }
            } catch (parseError) {
              console.warn('Could not parse error response, token may be invalid');
            }
          }
          // Don't fail the whole request if image upload fails
        }
      } catch (imageError: any) {
        console.warn('Error uploading cover image:', imageError);
        // Don't fail the whole request if image upload fails
      }
    }

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

