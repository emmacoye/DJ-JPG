import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Track {
  id: string;
  name: string;
  artists: string;
  album: string;
  preview_url: string | null;
  external_urls: { spotify: string };
  uri: string;
  duration_ms: number;
  album_image: string | null;
}

export default function Playlist() {
  const router = useRouter();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlistTheme, setPlaylistTheme] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [createdPlaylist, setCreatedPlaylist] = useState<any>(null);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Get image and analysis from sessionStorage
    const storedImage = sessionStorage.getItem('uploadedImage');
    const storedAnalysis = sessionStorage.getItem('analysisData');

    if (!storedImage || !storedAnalysis) {
      router.push('/upload');
      return;
    }

    setImageSrc(storedImage);
    
    try {
      const analysisData = JSON.parse(storedAnalysis);
      setAnalysis(analysisData);
      setPlaylistTheme(analysisData.playlistTheme || 'Photo Playlist');
      
      // Fetch playlist preview
      fetchPlaylistPreview(analysisData);
    } catch (err) {
      console.error('Error parsing analysis data:', err);
      setError('Failed to load analysis data');
      setIsLoading(false);
    }
  }, [router]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, [audio]);

  const fetchPlaylistPreview = async (analysisData: any) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/playlist-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysis: analysisData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresAuth || response.status === 401 || response.status === 403) {
          setError('Please login to Spotify to preview tracks.');
          setTimeout(() => {
            window.location.href = '/api/auth/login?force=true';
          }, 2000);
          return;
        }
        throw new Error(errorData.error || 'Failed to fetch playlist preview');
      }

      const data = await response.json();
      if (data.success) {
        setTracks(data.tracks || []);
        if (data.playlistTheme) {
          setPlaylistTheme(data.playlistTheme);
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Error fetching playlist preview:', err);
      setError(err.message || 'Failed to load playlist preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPreview = (track: Track) => {
    if (!track.preview_url) {
      alert('No preview available for this track');
      return;
    }

    // Stop current audio if playing
    if (audio) {
      audio.pause();
      audio.src = '';
    }

    // If clicking the same track, stop it
    if (playingTrack === track.id) {
      setPlayingTrack(null);
      setAudio(null);
      return;
    }

    // Play new track
    const newAudio = new Audio(track.preview_url);
    newAudio.play().catch(err => {
      console.error('Error playing preview:', err);
      alert('Failed to play preview');
    });
    
    setAudio(newAudio);
    setPlayingTrack(track.id);

    // Auto-stop after 30 seconds (preview length)
    setTimeout(() => {
      if (newAudio) {
        newAudio.pause();
        setPlayingTrack(null);
        setAudio(null);
      }
    }, 30000);

    // Handle audio end
    newAudio.onended = () => {
      setPlayingTrack(null);
      setAudio(null);
    };
  };

  const handleAddToSpotify = async () => {
    if (!analysis) {
      setError('No analysis data available');
      return;
    }

    setIsCreatingPlaylist(true);
    setError(null);

    try {
      const response = await fetch('/api/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysis }),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = 'Failed to create playlist';
        let requiresAuth = false;
        
        try {
          const errorData = JSON.parse(responseText);
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          }
          if (errorData.requiresAuth || response.status === 401 || response.status === 403) {
            requiresAuth = true;
          }
        } catch {
          errorMessage = responseText || `Server error: ${response.status}`;
        }
        
        if (requiresAuth) {
          setError('Please login to Spotify to create playlists.');
          setTimeout(() => {
            window.location.href = '/api/auth/login?force=true';
          }, 2000);
          return;
        }
        
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      if (data.success && data.playlist) {
        setCreatedPlaylist(data.playlist);
        
        // Open playlist in Spotify
        if (data.playlist.external_urls?.spotify) {
          window.open(data.playlist.external_urls.spotify, '_blank');
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Error creating playlist:', err);
      setError(err.message || 'Failed to create playlist');
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8]">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <a href="/" className="text-gray-700 hover:text-gray-900">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 16V20C10 20.5523 14.4477 21 15 21M9 21H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          Step 3: Your Playlist is Ready!
        </h1>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left: Image */}
          <Card>
            <CardContent className="p-4">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Uploaded photo"
                  className="w-full h-auto rounded-lg object-cover"
                />
              ) : (
                <Skeleton className="w-full h-64" />
              )}
            </CardContent>
          </Card>

          {/* Right: Analysis Summary */}
          <div className="space-y-4">
            {/* Mood Bars */}
            {analysis && (
              <Card className="bg-[#FFE8A0] border-[#FFE8A0]">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">Mood & Emotion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.mood && (
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 capitalize">{analysis.mood}</span>
                        <span className="text-xs text-gray-600">High</span>
                      </div>
                      <Progress value={90} className="h-2" />
                    </div>
                  )}
                  {analysis.emotion && (
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 capitalize">{analysis.emotion}</span>
                        <span className="text-xs text-gray-600">Medium</span>
                      </div>
                      <Progress value={70} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Genres */}
            {analysis && analysis.genres && Array.isArray(analysis.genres) && analysis.genres.length > 0 && (
              <Card className="bg-[#E8E5F0] border-[#E8E5F0]">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">Genres</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.genres.map((genre: string, index: number) => (
                      <Badge key={index} variant="secondary" className="bg-white text-gray-700 hover:bg-gray-50">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {createdPlaylist && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-green-800 mb-2">Playlist Created!</h2>
            <p className="text-green-700 mb-4">{createdPlaylist.name}</p>
            {createdPlaylist.external_urls?.spotify && (
              <a
                href={createdPlaylist.external_urls.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-white px-6 py-3 rounded-lg transition-colors"
              >
                <span>Open in Spotify</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Playlist Tracks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">{playlistTheme}</CardTitle>
            {!createdPlaylist && (
              <Button
                onClick={handleAddToSpotify}
                disabled={isCreatingPlaylist || isLoading}
                className="bg-[#1DB954] hover:bg-[#1ed760] text-white"
                size="lg"
              >
                {isCreatingPlaylist ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    <span>Add to Spotify</span>
                  </>
                )}
              </Button>
            )}
          </div>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded" />
                  <div className="flex-grow space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="w-10 h-10 rounded-full" />
                </div>
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No tracks found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-500 font-semibold">
                    {index + 1}
                  </div>
                  
                  {track.album_image && (
                    <img
                      src={track.album_image}
                      alt={track.album}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                  )}
                  
                  <div className="flex-grow min-w-0">
                    <p className="font-medium text-gray-800 truncate">{track.name}</p>
                    <p className="text-sm text-gray-600 truncate">{track.artists}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{formatDuration(track.duration_ms)}</span>
                    
                    {track.preview_url ? (
                      <button
                        onClick={() => handlePlayPreview(track)}
                        className="w-10 h-10 rounded-full bg-[#504E76] hover:bg-[#64628A] text-white flex items-center justify-center transition-colors"
                        title={playingTrack === track.id ? 'Stop preview' : 'Play 30s preview'}
                      >
                        {playingTrack === track.id ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center" title="No preview available">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                        </svg>
                      </div>
                    )}
                    
                    <a
                      href={track.external_urls.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1DB954] hover:text-[#1ed760]"
                      title="Open in Spotify"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>

        {/* Step Indicator */}
        <div className="flex gap-3 justify-center mt-12">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <div className="w-3 h-3 rounded-full bg-gray-700"></div>
        </div>
      </div>
    </div>
  );
}

