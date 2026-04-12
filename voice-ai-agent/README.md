# 🖥️ Voice AI Agent Frontend

This is the **Next.js 14** frontend for the AI Call Screener. It features a high-fidelity glassmorphism UI for monitoring and training your AI agent.

## 🚀 Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   Create a `.env.local` with:
   ```env
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
   ANTHROPIC_API_KEY=...
   PINECONE_API_KEY=...
   # See root README for all keys
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

## 🏗️ Folder Structure

- `src/app`: Page routes and layouts.
- `src/components`: Glassmorphism UI components (Command Center, Training Studio).
- `src/app/api`: Edge-optimized API routes for Deepgram, Claude, and ElevenLabs.

## 🚢 Deployment (Cloud Run)

The frontend is containerized via the root `Dockerfile` (multi-stage build).
To deploy manually:
```bash
gcloud run deploy callscreen-frontend --source . --port 8080 --memory 2Gi
```
