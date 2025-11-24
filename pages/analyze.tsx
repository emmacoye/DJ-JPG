import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Analyze() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [playlist, setPlaylist] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Get image from sessionStorage
    const storedImage = sessionStorage.getItem('uploadedImage');
    if (!storedImage) {
      router.push('/upload');
      return;
    }

    setImageSrc(storedImage);
    analyzeImage(storedImage);
  }, [router]);

  const analyzeImage = async (base64Image: string) => {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      });

      // Check if response is OK before parsing
      if (!response.ok) {
        let errorMessage = 'Failed to analyze image';
        try {
          const errorData = await response.json();
          // Extract error message, ensuring it's a string
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.error && typeof errorData.error === 'object') {
            errorMessage = errorData.error.message || JSON.stringify(errorData.error);
          } else if (errorData.details) {
            errorMessage = typeof errorData.details === 'string' 
              ? errorData.details 
              : JSON.stringify(errorData.details);
          }
          
          // Add retry suggestion for OpenAI errors
          if (errorData.openaiError) {
            errorMessage += ' Please try again in a moment.';
          }
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(String(errorMessage));
      }

      // Parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error('Invalid response from server');
      }

      if (!data.success || !data.analysis) {
        throw new Error('Invalid response from analysis API');
      }

      setAnalysis(data.analysis);
      setIsAnalyzing(false);
    } catch (err: any) {
      console.error('Error analyzing image:', err);
      setError(err.message || 'Failed to analyze image');
      setIsAnalyzing(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!analysis) {
      setError('No analysis data available');
      return;
    }

    setIsCreatingPlaylist(true);
    setError(null);

    // First, test if we have the required permissions
    try {
      const permissionTest = await fetch('/api/test-permissions');
      if (!permissionTest.ok) {
        const testData = await permissionTest.json();
        if (testData.requiresReauth) {
          setError('Missing playlist permissions. Redirecting to login...');
          setTimeout(() => {
            window.location.href = '/api/auth/login?force=true';
          }, 2000);
          setIsCreatingPlaylist(false);
          return;
        }
      }
    } catch (testError) {
      console.warn('Permission test failed, continuing anyway:', testError);
      // Continue with playlist creation attempt
    }

    try {
      const response = await fetch('/api/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysis }),
      });

      // Get response text first to handle both JSON and non-JSON responses
      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = 'Failed to create playlist';
        let requiresAuth = false;
        
        try {
          const errorData = JSON.parse(responseText);
          // Ensure error message is a string, not an object
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.error && typeof errorData.error === 'object') {
            errorMessage = JSON.stringify(errorData.error);
          } else if (typeof errorData.details === 'string') {
            errorMessage = errorData.details;
          } else if (errorData.details && typeof errorData.details === 'object') {
            errorMessage = JSON.stringify(errorData.details);
          } else if (responseText) {
            errorMessage = responseText.substring(0, 200); // Limit length
          }
          
          // Check if authentication is required
          if (errorData.requiresAuth || response.status === 401 || response.status === 403) {
            requiresAuth = true;
            if (errorData.requiresReauth) {
              errorMessage = 'Please login to Spotify again to grant playlist permissions.';
            } else {
              errorMessage += ' Redirecting to login...';
            }
          }
        } catch (parseError) {
          // If not JSON, use the text directly
          errorMessage = responseText || `Server error: ${response.status} ${response.statusText}`;
          if (response.status === 403) {
            requiresAuth = true;
            errorMessage = 'Permission denied. Please login to Spotify again.';
          }
        }
        
        // If authentication is required, redirect to login with force re-auth
        if (requiresAuth || response.status === 401 || response.status === 403) {
          // Show error message briefly, then redirect
          setError(errorMessage);
          setTimeout(() => {
            // Force re-authentication by adding ?force=true to clear old tokens
            // show_dialog=true in login.ts will ensure consent screen appears
            window.location.href = '/api/auth/login?force=true';
          }, 3000); // Give user time to read the error
          // Don't throw error if we're redirecting - just return
          setIsCreatingPlaylist(false);
          return;
        }
        
        // Only throw error if we're not redirecting
        throw new Error(String(errorMessage));
      }

      // Parse successful response
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Invalid JSON response from server');
      }

      if (!data.success || !data.playlist) {
        throw new Error('Invalid response from playlist API');
      }

      setPlaylist(data.playlist);
      
      // Open playlist in Spotify
      if (data.playlist.external_urls?.spotify) {
        window.open(data.playlist.external_urls.spotify, '_blank');
      }
    } catch (err: any) {
      console.error('Error creating playlist:', err);
      // Ensure we always set a string error message
      const errorMsg = err instanceof Error 
        ? err.message 
        : typeof err === 'string' 
        ? err 
        : JSON.stringify(err);
      setError(errorMsg || 'Failed to create playlist');
    } finally {
      setIsCreatingPlaylist(false);
    }
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
              d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-6 py-8 relative min-h-[calc(100vh-100px)]">
        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Step 2: Analyzing...</h1>

        {/* Image Container with Loading Spinner */}
        <div className="relative w-full max-w-2xl mb-6">
          {imageSrc && (
            <div className="relative rounded-xl overflow-hidden bg-white shadow-lg">
              <img
                src={imageSrc}
                alt="Uploaded photo"
                className="w-full h-auto object-cover"
              />
              {isAnalyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          )}

          {/* Analysis Banner */}
          <div className="mt-6 bg-[#FFE8A0] rounded-xl px-6 py-4 text-center">
            <p className="text-gray-800 text-lg font-medium">
              {isAnalyzing
                ? 'Analyzing colors, lighting, and emotion...'
                : error
                ? 'Analysis failed. Please try again.'
                : 'Analysis complete!'}
            </p>
          </div>
        </div>

        {/* Step Indicator Dots */}
        <div className="flex gap-3 mt-12">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <div className="w-3 h-3 rounded-full bg-gray-700"></div>
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-6 max-w-2xl">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-red-700 mb-4">{error}</p>
            {error.includes('Permission denied') || error.includes('403') || error.includes('required permissions') ? (
              <div className="bg-white border border-red-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-gray-700 mb-2 font-semibold">To fix this:</p>
                <ol className="text-sm text-gray-600 list-decimal list-inside space-y-2 mb-3">
                  <li>Go to <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">your Spotify apps page</a> and click "Remove Access" for this app</li>
                  <li>Clear ALL cookies for this site (F12 → Application → Cookies → Delete all)</li>
                  <li>Click "Login with Spotify" again</li>
                  <li><strong>IMPORTANT:</strong> When you see the Spotify consent screen, make sure ALL permission checkboxes are checked, especially:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li>Create, edit, and follow playlists</li>
                      <li>Modify your public playlists</li>
                      <li>Modify your private playlists</li>
                    </ul>
                  </li>
                  <li>Click "Agree" or "Authorize"</li>
                </ol>
                <p className="text-xs text-gray-500 mt-2">If the consent screen doesn't appear, the app might already be authorized. You must revoke access first.</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Playlist Success Message */}
        {playlist && (
          <div className="mt-8 w-full max-w-2xl bg-green-50 border border-green-200 rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-green-800 mb-2">Playlist Created!</h2>
            <p className="text-green-700 mb-4">{playlist.name}</p>
            {playlist.external_urls?.spotify && (
              <a
                href={playlist.external_urls.spotify}
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

        {/* Analysis Results (when complete) */}
        {!isAnalyzing && analysis && !error && !playlist && (
          <div className="mt-8 w-full max-w-2xl bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {analysis.playlistTheme || 'Analysis Results'}
            </h2>
            <div className="space-y-3">
              {analysis.mood && (
                <div>
                  <span className="font-semibold">Mood: </span>
                  <span className="capitalize">{analysis.mood}</span>
                </div>
              )}
              {analysis.emotion && (
                <div>
                  <span className="font-semibold">Emotion: </span>
                  <span className="capitalize">{analysis.emotion}</span>
                </div>
              )}
              {analysis.genres && Array.isArray(analysis.genres) && analysis.genres.length > 0 && (
                <div>
                  <span className="font-semibold">Suggested Genres: </span>
                  <span>{analysis.genres.join(', ')}</span>
                </div>
              )}
              {analysis.energy && (
                <div>
                  <span className="font-semibold">Energy Level: </span>
                  <span className="capitalize">{analysis.energy}</span>
                </div>
              )}
              {analysis.tempo && (
                <div>
                  <span className="font-semibold">Tempo: </span>
                  <span className="capitalize">{analysis.tempo}</span>
                </div>
              )}
              {analysis.characteristics && Array.isArray(analysis.characteristics) && analysis.characteristics.length > 0 && (
                <div>
                  <span className="font-semibold">Characteristics: </span>
                  <span>{analysis.characteristics.join(', ')}</span>
                </div>
              )}
              {analysis.colors && (
                <div>
                  <span className="font-semibold">Colors: </span>
                  <span>{analysis.colors}</span>
                </div>
              )}
              {analysis.lighting && (
                <div>
                  <span className="font-semibold">Lighting: </span>
                  <span>{analysis.lighting}</span>
                </div>
              )}
              {analysis.description && (
                <div className="mt-4 pt-4 border-t">
                  <span className="font-semibold">Description: </span>
                  <p className="mt-2 text-gray-700">{analysis.description}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                // Store analysis in sessionStorage and navigate to playlist preview page
                sessionStorage.setItem('analysisData', JSON.stringify(analysis));
                router.push('/playlist');
              }}
              className="mt-6 bg-[#504E76] hover:bg-[#64628A] text-white px-6 py-3 rounded-lg transition-colors w-full"
            >
              View Playlist Preview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

