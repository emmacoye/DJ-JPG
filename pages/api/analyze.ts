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
                text: `Analyze this image and provide a detailed analysis that will be used to create a Spotify playlist. 

Focus on:
1. **Visual Elements**: Dominant colors, lighting conditions (bright/dark/warm/cool), composition, and visual style
2. **Mood & Emotion**: Overall emotional tone (happy/sad/energetic/calm/melancholic/upbeat), atmosphere, and feeling
3. **Music Recommendations**: Based on the visual analysis, suggest:
   - Music genres that match the mood (e.g., indie, electronic, jazz, rock, ambient, pop)
   - Energy level (low/medium/high)
   - Tempo/speed (slow/moderate/fast)
   - Musical characteristics (acoustic/electronic, instrumental/vocal, etc.)

Return your response as a JSON object with the following structure:
{
  "colors": "description of dominant colors",
  "lighting": "description of lighting (bright/dark/warm/cool)",
  "mood": "overall mood (happy/sad/energetic/calm/etc.)",
  "emotion": "emotional tone",
  "genres": ["genre1", "genre2", "genre3"],
  "energy": "low/medium/high",
  "tempo": "slow/moderate/fast",
  "characteristics": ["acoustic", "instrumental", etc.],
  "description": "detailed description of the image and how it relates to music",
  "playlistTheme": "a short theme name for the playlist (e.g., 'Sunset Vibes', 'Urban Night', 'Nature Serenity')"
}`,
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
        genres: ['Pop'],
        energy: 'medium',
        tempo: 'moderate',
        characteristics: ['instrumental'],
        playlistTheme: 'General Vibes',
      };
    }

    return res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze image' });
  }
}

