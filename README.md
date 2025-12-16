# DJ-JPG

DJ-JPG is a web application that integrates with the Spotify Web API to generate custom playlists based on AI-driven image analysis. Users authenticate with Spotify, upload an image, and receive a playlist whose mood, energy, and genre are inferred from visual features in the image—turning memories into a personalized soundtrack.

## How It Works

#### Spotify Authentication: 
- Users log in via OAuth using the Spotify Web API, granting permission to create and modify playlists on their behalf.

#### Image Upload & Analysis:
- Uploaded images are processed using an AI model to extract high-level attributes such as mood, color palette, and emotional tone.

#### Prompt Engineering & AI Mapping:
- These visual attributes are translated into structured prompts that map image characteristics to musical features (e.g., valence, energy, tempo, genre).

#### Playlist Generation:
- The app queries Spotify’s recommendation and search endpoints to curate tracks that match the inferred mood, then programmatically creates and populates a playlist in the user’s Spotify account.

## Tech Stack

Frontend: React / Next.js

Backend: Node.js (API routes / serverless functions)

AI: Image-to-mood inference + prompt-based mapping logic

APIs: Spotify Web API (OAuth, playlists, recommendations)

Tooling: Cursor AI for development, debugging, and rapid prototyping

## Project Context

DJ-JPG was developed as a group class assignment exploring emerging technologies and AI-assisted development workflows. As the primary developer, I used Cursor AI to accelerate implementation, debug edge cases, and explore the strengths and limitations of AI-supported coding in a real-world application.

## Getting Started

First, run the development server:

```bash
npm run dev
```
If this does not work for you, then run the following code snippet before:
```bash
npm install
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000/) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
