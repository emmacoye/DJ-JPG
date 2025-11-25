import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

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
  const [popularityFilter, setPopularityFilter] = useState<'mainstream' | 'indie' | 'mixed'>('mainstream');
  // Cache tracks for each filter option
  const [tracksCache, setTracksCache] = useState<{
    mainstream?: Track[];
    mixed?: Track[];
    indie?: Track[];
  }>({});

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
      
      // Debug: Log moodScores to see what we're getting
      console.log('Analysis data:', analysisData);
      console.log('Mood scores:', analysisData.moodScores);
      
      // Fetch playlist preview with default filter
      fetchPlaylistPreview(analysisData, 'mainstream');
    } catch (err) {
      console.error('Error parsing analysis data:', err);
      setError('Failed to load analysis data');
      setIsLoading(false);
    }
  }, [router]);


  const fetchPlaylistPreview = async (analysisData: any, filter?: 'mainstream' | 'indie' | 'mixed', forceRefresh: boolean = false) => {
    const activeFilter = filter || popularityFilter;
    
    // Check if we already have cached tracks for this filter (unless forcing refresh)
    if (!forceRefresh && tracksCache[activeFilter] && tracksCache[activeFilter]!.length > 0) {
      setTracks(tracksCache[activeFilter]!);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/playlist-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          analysis: analysisData,
          popularityFilter: activeFilter,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
      if (errorData.requiresAuth || response.status === 401 || response.status === 403) {
        toast.error('Please login to Spotify to preview tracks.');
        setTimeout(() => {
          window.location.href = '/api/auth/login?force=true';
        }, 2000);
        return;
      }
        const errorMsg = errorData.error || 'Failed to fetch playlist preview';
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.success) {
        const fetchedTracks = data.tracks || [];
        // Debug: Log track data to see preview URLs
        console.log('=== TRACK DATA DEBUG ===');
        console.log('Total tracks:', fetchedTracks.length);
        console.log('First track full data:', fetchedTracks[0]);
        console.log('Tracks with preview URLs:', fetchedTracks.filter((t: Track) => t.preview_url).length);
        console.log('Tracks without preview URLs:', fetchedTracks.filter((t: Track) => !t.preview_url).length);
        if (fetchedTracks.length > 0) {
          console.log('Sample track preview_url:', fetchedTracks[0]?.preview_url);
          console.log('Sample track keys:', Object.keys(fetchedTracks[0] || {}));
        }
        console.log('========================');
        
        setTracks(fetchedTracks);
        
        // Cache the tracks for this filter
        setTracksCache(prev => ({
          ...prev,
          [activeFilter]: fetchedTracks,
        }));
        
        if (data.playlistTheme) {
          setPlaylistTheme(data.playlistTheme);
        }
        toast.success(`Found ${fetchedTracks.length} tracks for your playlist!`);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Error fetching playlist preview:', err);
      const errorMsg = err.message || 'Failed to load playlist preview';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshPlaylist = async () => {
    if (!analysis) return;
    
    // Force refresh the current filter's playlist
    await fetchPlaylistPreview(analysis, popularityFilter, true);
    toast.info('Refreshing playlist...');
  };

  const handleAddToSpotify = async () => {
    if (!analysis) {
      setError('No analysis data available');
      return;
    }

    if (tracks.length === 0) {
      setError('No tracks available to add to playlist');
      return;
    }

    setIsCreatingPlaylist(true);
    setError(null);

    try {
      // Get the uploaded image from sessionStorage
      const uploadedImage = sessionStorage.getItem('uploadedImage');
      
      // Extract track URIs from the preview tracks (the exact tracks shown to the user)
      const trackUris = tracks.map(track => track.uri).filter(uri => uri);
      
      const response = await fetch('/api/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          analysis,
          image: uploadedImage, // Send the image to use as cover
          trackUris: trackUris, // Send the exact track URIs from the preview
        }),
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
          toast.error('Please login to Spotify to create playlists.');
          setTimeout(() => {
            window.location.href = '/api/auth/login?force=true';
          }, 2000);
          return;
        }
        
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      if (data.success && data.playlist) {
        setCreatedPlaylist(data.playlist);
        toast.success('Playlist created successfully!');
        
        // Open playlist in Spotify
        if (data.playlist.external_urls?.spotify) {
          window.open(data.playlist.external_urls.spotify, '_blank');
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Error creating playlist:', err);
      const errorMsg = err.message || 'Failed to create playlist';
      setError(errorMsg);
      toast.error(errorMsg);
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

  const getTotalDuration = () => {
    return tracks.reduce((total, track) => total + track.duration_ms, 0);
  };

  const formatTotalDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8]">
      {/* Main Content */}
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 tracking-tight">
            Your Playlist is Ready!
          </h1>
          <p className="text-gray-600 text-sm">Review your tracks and add them to Spotify</p>
        </div>

        {/* Success Message */}
        {createdPlaylist && (
          <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-green-800 mb-1 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Playlist Created Successfully!
                  </h2>
                  <p className="text-green-700 font-medium">{createdPlaylist.name}</p>
                </div>
                {createdPlaylist.external_urls?.spotify && (
                  <a
                    href={createdPlaylist.external_urls.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-white px-4 py-2 rounded-md transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 font-medium"
                  >
                    <span>Open in Spotify</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left Column: Image + Analysis Summary */}
          <div className="space-y-4">
            {/* Image */}
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

            {/* High-level Content Details */}
            <div className="space-y-4">
              {/* Mood Bars */}
              {analysis && (
                <Card className="bg-[#FFE8A0] border-[#FFE8A0] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-800">Mood & Emotion</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.moodScores && typeof analysis.moodScores === 'object' && Object.keys(analysis.moodScores).length > 0 ? (
                      // Display multiple mood bars with scores
                      Object.entries(analysis.moodScores)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([mood, score]) => {
                          const numScore = typeof score === 'number' ? score : parseFloat(score as string) || 0;
                          return (
                            <div key={mood} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700 capitalize">{mood}</span>
                                <span className="text-xs text-gray-600">{Math.round(numScore)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                <div 
                                  className="h-full bg-[#504E76] rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(0, numScore))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      // Fallback: Show default mood bars if moodScores not available
                      <>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 capitalize">Calm</span>
                            <span className="text-xs text-gray-600">60%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="h-full bg-[#504E76] rounded-full transition-all duration-300"
                              style={{ width: '60%' }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 capitalize">Happy</span>
                            <span className="text-xs text-gray-600">40%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="h-full bg-[#504E76] rounded-full transition-all duration-300"
                              style={{ width: '40%' }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 capitalize">Chill</span>
                            <span className="text-xs text-gray-600">30%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="h-full bg-[#504E76] rounded-full transition-all duration-300"
                              style={{ width: '30%' }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 capitalize">Dreamy</span>
                            <span className="text-xs text-gray-600">20%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="h-full bg-[#504E76] rounded-full transition-all duration-300"
                              style={{ width: '20%' }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 capitalize">Melancholy</span>
                            <span className="text-xs text-gray-600">10%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="h-full bg-[#504E76] rounded-full transition-all duration-300"
                              style={{ width: '10%' }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Genres */}
              {analysis && analysis.genres && Array.isArray(analysis.genres) && analysis.genres.length > 0 && (
                <Card className="bg-[#E8E5F0] border-[#E8E5F0] shadow-sm">
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

              {/* Energy & Tempo */}
              {(analysis?.energy || analysis?.tempo) && (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-800">Characteristics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.energy && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-gray-600">Energy</span>
                          <span className="text-xs font-medium text-gray-700 capitalize">{analysis.energy}</span>
                        </div>
                        <Progress 
                          value={analysis.energy === 'high' ? 90 : analysis.energy === 'low' ? 30 : 60} 
                          className="h-1.5" 
                        />
                      </div>
                    )}
                    {analysis.tempo && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-gray-600">Tempo</span>
                          <span className="text-xs font-medium text-gray-700 capitalize">{analysis.tempo}</span>
                        </div>
                        <Progress 
                          value={analysis.tempo === 'fast' ? 85 : analysis.tempo === 'slow' ? 35 : 60} 
                          className="h-1.5" 
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column: Playlist Tracks */}
          <Card className="flex flex-col h-full shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-2xl mb-1 truncate">{playlistTheme}</CardTitle>
                {tracks.length > 0 && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                    <span className="flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                      {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                      </svg>
                      {formatTotalDuration(getTotalDuration())}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Popularity Filter - Side placement */}
            {!createdPlaylist && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Filter by popularity</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshPlaylist}
                    disabled={isLoading}
                    className="h-6 w-6 p-0"
                    title="Refresh playlist for current filter"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <ToggleGroup
                  type="single"
                  value={popularityFilter}
                  onValueChange={(value) => {
                    if (value && (value === 'mainstream' || value === 'mixed' || value === 'indie')) {
                      setPopularityFilter(value);
                      // Check cache first - if we have tracks for this filter, use them immediately
                      if (tracksCache[value] && tracksCache[value]!.length > 0) {
                        setTracks(tracksCache[value]!);
                      } else if (analysis) {
                        // Only fetch if we don't have cached data
                        fetchPlaylistPreview(analysis, value);
                      }
                    }
                  }}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                >
                  <ToggleGroupItem 
                    value="mainstream" 
                    aria-label="Mainstream"
                    className="data-[state=on]:bg-[#504E76] data-[state=on]:text-white data-[state=on]:border-[#504E76] hover:bg-[#504E76]/10"
                  >
                    Mainstream
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="mixed" 
                    aria-label="Mixed"
                    className="data-[state=on]:bg-[#504E76] data-[state=on]:text-white data-[state=on]:border-[#504E76] hover:bg-[#504E76]/10"
                  >
                    Mixed
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="indie" 
                    aria-label="Indie & Emerging"
                    className="data-[state=on]:bg-[#504E76] data-[state=on]:text-white data-[state=on]:border-[#504E76] hover:bg-[#504E76]/10"
                  >
                    Indie & Emerging
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}
            
            {!createdPlaylist && (
              <Button
                onClick={handleAddToSpotify}
                disabled={isCreatingPlaylist || isLoading || tracks.length === 0}
                className="bg-[#1DB954] hover:bg-[#1ed760] text-white shrink-0 mt-4 shadow-lg shadow-[#1DB954]/30 hover:shadow-xl hover:shadow-[#1DB954]/40 transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:opacity-60"
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
          </CardHeader>
          <Separator />
          <CardContent className="flex-1 overflow-hidden flex flex-col pt-4">
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
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-gray-400 mb-4">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-gray-600 font-medium">No tracks found</p>
              <p className="text-sm text-gray-500 mt-1">Try uploading a different image</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 pr-2 -mr-2">
              <div className="space-y-1">
                {tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-all duration-200 group border border-transparent hover:border-gray-200 hover:shadow-sm relative"
                    onClick={(e) => {
                      console.log('Track row clicked:', track.name);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 font-medium w-6 text-right group-hover:text-gray-600 transition-colors">
                        {index + 1}
                      </span>
                      {track.album_image ? (
                        <img
                          src={track.album_image}
                          alt={track.album}
                          className="w-10 h-10 rounded object-cover flex-shrink-0 shadow-sm group-hover:shadow transition-shadow"
                        />
                      ) : (
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded flex items-center justify-center text-gray-500 text-xs font-semibold">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate group-hover:text-gray-900 transition-colors">
                        {track.name}
                      </p>
                      <p className="text-xs text-gray-600 truncate">{track.artists}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 font-mono">{formatDuration(track.duration_ms)}</span>
                      
                      <a
                        href={track.external_urls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1DB954] hover:text-[#1ed760] transition-colors p-1 rounded hover:bg-green-50"
                        title="Open in Spotify"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </CardContent>
        </Card>
        </div>

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

