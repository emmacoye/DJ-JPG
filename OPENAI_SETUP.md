# OpenAI API Setup Guide

## Step 1: Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to [API Keys](https://platform.openai.com/api-keys)
4. Click **"Create new secret key"**
5. Give it a name (e.g., "DJ JPG App")
6. Copy the API key (you won't be able to see it again!)

## Step 2: Add API Key to Your Project

Add the OpenAI API key to your `.env.local` file in the project root:

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-api-key-here
```

**Important:**
- Replace `sk-your-api-key-here` with your actual API key
- Never commit `.env.local` to git (it's already in `.gitignore`)
- Restart your development server after adding the key

## Step 3: Verify It Works

1. Start your dev server: `npm run dev`
2. Upload an image on the upload page
3. You should see the analysis page with results

## Troubleshooting

### Error: "OpenAI API key not configured"
- Make sure `.env.local` exists in the project root
- Verify the variable name is exactly `OPENAI_API_KEY`
- Restart your dev server after adding the key

### Error: "Failed to analyze image"
- Check your OpenAI API key is valid
- Verify you have credits in your OpenAI account
- Check the server console for detailed error messages
- Make sure the image isn't too large (should be under 20MB)

### Error: "Image is too large"
- The image needs to be compressed more
- Try uploading a smaller image
- The upload page automatically compresses images, but very large originals may still be too big

## API Usage Notes

- The app uses OpenAI's GPT-4 Vision model (`gpt-4o`)
- Each image analysis uses API credits
- Check your usage at [OpenAI Usage Dashboard](https://platform.openai.com/usage)

## Cost Considerations

- GPT-4 Vision pricing varies by image size
- Typical image analysis costs a few cents per image
- Monitor your usage in the OpenAI dashboard

