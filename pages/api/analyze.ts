import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    let image = req.body.image;

    // If image is a base64 data URL, use it directly
    // If it's just base64, add the data URL prefix
    if (image && !image.startsWith('data:')) {
      image = `data:image/jpeg;base64,${image}`;
    }

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    // Check image size (OpenAI has limits on base64 image size)
    // Base64 is ~33% larger than binary, so we check the base64 string length
    const imageSizeMB = (image.length * 3) / 4 / 1024 / 1024;
    if (imageSizeMB > 20) {
      return res.status(400).json({ 
        error: 'Image is too large. Please use an image smaller than 20MB.',
        sizeMB: imageSizeMB.toFixed(2)
      });
    }

    console.log(`Analyzing image (size: ${imageSizeMB.toFixed(2)}MB)`);

    // Call OpenAI Vision API to analyze the image
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a music curator analyzing an image to create a Spotify playlist. Your goal is to identify the musical characteristics that would perfectly match this image's visual mood, atmosphere, and aesthetic.

**ANALYSIS FRAMEWORK:**

1. **VISUAL-TO-MUSICAL TRANSLATION**: Think about how visual elements translate to musical qualities:
   
   **COLORS → GENRE MAPPING (CRITICAL)**:
   - Bright, vibrant colors (bright reds, yellows, oranges, pinks, electric blues) → **POP** music (upbeat, energetic pop songs)
   - Warm earth tones (browns, oranges, warm greens) → **FOLK** or **COUNTRY** music
   - Cool, muted colors (soft blues, grays, pastels) → **INDIE POP** or **ACOUSTIC** music
   - Dark colors (deep blues, purples, blacks) → **R&B**, **INDIE POP**, or atmospheric music
   - Natural greens (forest greens, nature tones) → **FOLK** or **COUNTRY** music
   
   **SETTING → GENRE MAPPING (CRITICAL)**:
   - **Forest/Nature/Woods/Mountains** → **INDIE FOLK** (primary), **FOLK POP** (secondary), **FOLK** (tertiary), **ACOUSTIC POP** (quaternary)
   - **Party/Club/Concert/Festival** → **POP** (primary), **HIP HOP** (secondary), **DANCE** (tertiary), **ELECTRONIC** (if electronic party)
   - **Urban/City/Street/Neon lights** → **HIP HOP** (primary), **POP** (secondary), **INDIE POP** (tertiary), **ROCK** (if gritty)
   - **Beach/Ocean/Water/Tropical** → **POP** (primary), **REGGAE** (secondary), **TROPICAL HOUSE** (tertiary)
   - **Night/Evening/City lights** → **POP** (primary), **R&B** (secondary), **INDIE POP** (tertiary)
   - **Cozy/Indoor/Home/Cafe** → **INDIE POP** (primary), **ACOUSTIC** (secondary), **POP** (tertiary)
   - **Desert/Arid landscapes** → **FOLK** (primary), **COUNTRY** (secondary), **ACOUSTIC** (tertiary)
   - **Rainy/Stormy weather** → **INDIE POP** (primary), **ACOUSTIC** (secondary), **MELANCHOLIC POP** (tertiary)
   
   **LIGHTING → ENERGY LEVEL**:
   - Bright sunlight = high energy
   - Soft/diffuse light = medium energy
   - Dark/night = low to medium energy, often more atmospheric
   
   **TIME OF DAY → TEMPO**:
   - Morning = moderate to fast
   - Afternoon = moderate
   - Evening/night = slow to moderate, more atmospheric
   
   **COMPOSITION → MUSICAL STRUCTURE**:
   - Simple/minimal = acoustic, instrumental
   - Complex/busy = layered, rhythmic, full production

2. **MOOD SCORING ACCURACY**: Score each mood (0-100) based on how strongly the image evokes that feeling:
   - Look for visual cues: Smiles/laughter = high happy. Peaceful scenes = high calm. Movement/action = high energetic. Soft focus/dreamy visuals = high dreamy. Dark tones = high melancholy. Couples/romantic settings = high romantic. Vintage/retro elements = high nostalgic.
   - Scores should reflect the PRIMARY emotions (highest scores) and SECONDARY emotions (medium scores). Not all moods will be high - be selective.
   - Total scores don't need to equal 100 - each mood is independent.

3. **GENRE SELECTION STRATEGY**:
   - **CRITICAL**: The PRIMARY genre (first in the array) MUST match the dominant visual element:
     * Forest/nature scenes → "indie folk" or "folk pop" MUST be first genre (think artists like Noah Kahan, Hozier, Lizzy McAlpine, Mt. Joy)
     * Party/club scenes → "pop" MUST be first genre (or "hip hop" if urban party)
     * Bright, vibrant colors → "pop" MUST be first genre
     * Urban/city scenes → "hip hop" or "pop" as first genre
     * Beach/ocean → "pop" as first genre
     * Night scenes → "pop" or "R&B" as first genre
   - Choose 3-5 mainstream genres that are popular on Spotify
   - Primary genre should be the STRONGEST visual match based on the mappings above
   - Secondary genres add variety but should still match the vibe
   - Use specific but recognizable genre names: "indie pop" not "indie", "hip hop" not "rap", "R&B" not "rhythm and blues"
   - Avoid niche subgenres that won't return good results on Spotify

4. **MUSICAL KEYWORDS FOR SPOTIFY SEARCH**:
   - Use a mix of musical/instrumental descriptors AND mood/feeling terms
   - Good keywords: "acoustic", "instrumental", "atmospheric", "upbeat", "mellow", "folk", "pop", "indie", "electronic", "guitar", "piano", "synth", "calm", "happy", "chill", "energetic", "dreamy", "romantic", "nostalgic"
   - These will be combined with genres in search (e.g., "folk calm" not just "calm") to match musical characteristics, not just song titles
   - Include 3-5 keywords that describe both the MUSICAL STYLE and the MOOD/feeling
   - Mix: 2-3 musical style keywords (instruments, production) + 2-3 mood/feeling keywords

5. **DESCRIPTION QUALITY**:
   - Write 2-3 sentences that capture the image's essence in musical terms
   - Include: Setting, time of day, dominant colors, mood, and how it "feels" musically
   - Use descriptive words that could appear in song lyrics or descriptions (e.g., "sunset", "rainy day", "city lights", "mountain view")
   - This description will be used to extract search terms, so make it rich with searchable keywords

Return your response as a JSON object with this exact structure:
{
  "colors": "specific description of dominant colors (e.g., 'warm golden yellows and soft oranges' or 'cool blues and muted grays')",
  "lighting": "specific lighting description (bright/dark/warm/cool/soft/harsh) with context",
  "mood": "primary mood word (happy/sad/energetic/calm/melancholic/upbeat/nostalgic/romantic/mysterious/etc.)",
  "emotion": "more detailed emotional tone (2-3 words describing the feeling)",
  "moodScores": {
    "calm": 0-100,
    "happy": 0-100,
    "chill": 0-100,
    "dreamy": 0-100,
    "melancholy": 0-100,
    "energetic": 0-100,
    "romantic": 0-100,
    "nostalgic": 0-100
  },
  "genres": ["genre1", "genre2", "genre3"],
  "energy": "low/medium/high",
  "tempo": "slow/moderate/fast",
  "characteristics": ["characteristic1", "characteristic2", "characteristic3"],
  "musicalKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "description": "2-3 sentence description rich with searchable terms about the image's setting, mood, and musical vibe",
  "playlistTheme": "short, catchy playlist name (2-4 words) that captures the vibe (e.g., 'Sunset Drive', 'Rainy Day Blues', 'City Lights', 'Forest Walk')"
}

**CRITICAL REQUIREMENTS**:
- moodScores: Score based on visual evidence. Primary moods should be 60-90, secondary 30-60, unrelated moods 0-30
         - genres: Must be mainstream Spotify genres. Include 3-5 genres, with the first being the strongest match. For nature/forest scenes, prioritize "indie folk" or "folk pop" as the first genre to match artists like Noah Kahan, Hozier, Lizzy McAlpine, Mt. Joy
- musicalKeywords: 5 keywords that work in Spotify search - mix genre terms and mood/feeling terms
- description: Must include searchable location/setting words, time references, and mood words that could match song descriptions
- playlistTheme: Keep it short and evocative - this becomes the playlist name`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      let errorMessage = 'Failed to analyze image';
      
      try {
        const errorJson = JSON.parse(errorData);
        // Extract the actual error message from OpenAI's error structure
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson.error?.code) {
          errorMessage = `OpenAI API error (${errorJson.error.code})`;
        } else if (typeof errorJson.error === 'string') {
          errorMessage = errorJson.error;
        }
      } catch {
        // If parsing fails, use the raw error data (truncated if too long)
        errorMessage = errorData.length > 200 ? errorData.substring(0, 200) + '...' : errorData || errorMessage;
      }
      
      // Return a user-friendly error message
      return res.status(500).json({ 
        error: errorMessage,
        openaiError: true,
      });
    }

    const data = await response.json();
    const analysisText = data.choices[0]?.message?.content || '';

    // Try to parse JSON from the response
    let analysis;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/) || analysisText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : analysisText;
      analysis = JSON.parse(jsonText);
    } catch {
      // If parsing fails, create a structured response from the text
      analysis = {
        description: analysisText,
        colors: 'Various',
        lighting: 'Mixed',
        mood: 'Neutral',
        emotion: 'Neutral',
        moodScores: {
          calm: 50,
          happy: 50,
          chill: 50,
          dreamy: 50,
          melancholy: 50,
        },
        genres: ['Pop'],
        energy: 'medium',
        tempo: 'moderate',
        characteristics: ['instrumental'],
        musicalKeywords: ['pop', 'mainstream'],
        playlistTheme: 'General Vibes',
      };
    }

    return res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze image' });
  }
}

