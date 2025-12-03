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
   
   **COLORS → GENRE**: Bright/vibrant → POP; Warm earth tones → FOLK/COUNTRY; Cool/muted → INDIE POP/ACOUSTIC; Dark → R&B/INDIE POP; Natural greens → FOLK/COUNTRY; Black/dark/metal → METAL, HARD ROCK, ROCK
   
   **SETTING → GENRE**: Forest/Nature → INDIE FOLK (primary), FOLK POP; Party/Club → POP, HIP HOP; Urban/City → HIP HOP, POP; Beach/Ocean → POP, REGGAE; Night → POP, R&B; Cozy/Indoor → INDIE POP, ACOUSTIC; Desert → FOLK, COUNTRY; Rainy → INDIE POP, ACOUSTIC; **Classroom/School/Study** → LOFI (primary), AMBIENT, INSTRUMENTAL, CHILL (secondary); **Concert/Metal/Band/Stage** → METAL (primary), HARD ROCK, ROCK; **Dark/Gothic/Metal aesthetic** → METAL, HARD ROCK, ROCK
   
   **LIGHTING → ENERGY**: Bright = high; Soft = medium; Dark = low-medium
   
   **TIME → TEMPO**: Morning = fast; Afternoon = moderate; Evening/night = slow-moderate
   
   **COMPOSITION**: Simple = acoustic; Complex = full production

2. **MOOD SCORING**: Score 0-100 based on visual evidence. Primary moods: 60-90, secondary: 30-60, unrelated: 0-30. Each mood is independent.

3. **GENRE SELECTION**: PRIMARY genre (first) must match dominant visual. Use 3-5 mainstream Spotify genres. Use "indie pop" not "indie", "hip hop" not "rap", "R&B" not "rhythm and blues". **For classroom/school scenes: MUST use "lofi" or "lo-fi" as PRIMARY genre**, followed by "ambient", "instrumental", "chill". **For metal/rock/band scenes: MUST use "metal" or "hard rock" or "rock" as PRIMARY genre**, followed by "alternative rock", "punk", "grunge". Avoid niche subgenres.

4. **MUSICAL KEYWORDS**: Mix musical descriptors (acoustic, instrumental, guitar, piano) + mood terms (upbeat, mellow, dreamy). 3-5 keywords total. Combine with genres in search.

5. **DESCRIPTION**: 2-3 sentences capturing image essence. Include setting, time, colors, mood. Use searchable terms (sunset, rainy day, city lights, mountain view).

6. **SCHOOL/UNIVERSITY DETECTION**: If the image represents a specific school, college, or university (e.g., UNC Chapel Hill, Duke, Harvard, etc.), identify the school name. Look for:
   - School logos, mascots, or emblems
   - School names on buildings, signs, or banners
   - Distinctive architecture or landmarks associated with specific universities
   - School colors or uniforms
   - If a school is detected, include the school name in the "school" field. If no specific school is identified, set "school" to null.

7. **ARTIST SELECTION (CRITICAL)**:
   - Generate 20-25 specific artists whose music matches this image's vibe, genres, mood, and energy
   - Use well-known, mainstream Spotify artists. Prioritize artists matching the PRIMARY genre
   - **For classroom/school scenes: Include lofi/study music artists** like Lofi Girl, Chillhop Music, Kupla, Idealism, Jinsang, Nujabes, Tomppabeats, Birocratic, Sleepy Fish, Aso, eery, SwuM, plus instrumental/ambient artists like Bonobo, Tycho, Boards of Canada, Brian Eno, Marconi Union
   - **For metal/hard rock/band scenes: Include metal/hard rock artists** like Metallica, Iron Maiden, Black Sabbath, Slipknot, System of a Down, Tool, Avenged Sevenfold, Disturbed, Five Finger Death Punch, Pantera, Megadeth, AC/DC, Guns N' Roses, Led Zeppelin, Black Sabbath, Judas Priest, Motorhead, Slayer, Anthrax
   - Include mix of popular/mainstream + genre-specific artists
   - Use exact Spotify artist names

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
  "playlistTheme": "short, catchy playlist name (2-4 words) that captures the vibe (e.g., 'Sunset Drive', 'Rainy Day Blues', 'City Lights', 'Forest Walk')",
  "school": "school name if detected (e.g., 'UNC Chapel Hill', 'Duke University', 'Harvard University') or null if no specific school is identified",
  "artists": ["Artist Name 1", "Artist Name 2", ... "Artist Name 20-25"]
}

**CRITICAL REQUIREMENTS**:
- moodScores: Score based on visual evidence. Primary moods should be 60-90, secondary 30-60, unrelated moods 0-30
- genres: Must be mainstream Spotify genres. Include 3-5 genres, with the first being the strongest match. For nature/forest scenes, prioritize "indie folk" or "folk pop" as the first genre. **For classroom/school scenes, prioritize "lofi" or "lo-fi" as the PRIMARY genre**, followed by "ambient", "instrumental", "chill". **For metal/rock/band scenes, prioritize "metal" or "hard rock" or "rock" as the PRIMARY genre**, followed by "alternative rock", "punk", "grunge"
- musicalKeywords: 5 keywords that work in Spotify search - mix genre terms and mood/feeling terms
- description: Must include searchable location/setting words, time references, and mood words that could match song descriptions
- playlistTheme: Keep it short and evocative - this becomes the playlist name
- artists: **MUST include 20-25 specific artist names** matching the image's vibe, genres, mood, and energy. Prioritize PRIMARY genre artists.`,
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
        max_tokens: 1000, // Optimized for 20-25 artists
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
        school: null,
        artists: ['Taylor Swift', 'Ed Sheeran', 'Ariana Grande', 'The Weeknd', 'Dua Lipa'],
      };
    }

    return res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze image' });
  }
}

