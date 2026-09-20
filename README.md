<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://humanizer-webapp-rho.vercel.app/

## Features
- Paste AI-generated text and get a rewritten, more human-sounding version
- Powered by the Gemini API
- Interactive charts comparing the AI vs. human content split before and after rewriting

## How it works
1. Paste your text into the input box.
2. The app scores the original text and sends it to Gemini with a rewriting prompt.
3. The rewritten text is scored again.
4. Charts compare the before and after results.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

The AI vs. human score is an estimate and not a guarantee. AI-detection tools disagree with each other and can be wrong.
