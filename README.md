# 🎙️ AI Call Screener & Voice Agent

A production-ready real-time Voice AI system that intercepts phone calls, reasons with LLMs (Claude), and responds with human-like latency using **Twilio**, **Deepgram**, and **ElevenLabs**.

![Dashboard Screenshot](https://raw.githubusercontent.com/dhonitheja/Ai-calling-assistance/main/docs/dashboard.png)

## ✨ Features

- **Real-time Audio Pipeline**: Sub-second latency using WebSockets. 
- **Voice Interruption Detection**: AI stops speaking immediately when the caller interrupts.
- **Human-in-the-Loop**: Seamlessly handoff a live AI call to your personal phone via a Twilio Conference bridge.
- **Dynamic Personality**: Grounded in your own `knowledge_base` (Resume/DNA) via RAG (Pinecone).
- **Self-Training**: Automatically ingests transcripts of every call to improve its knowledge over time.
- **Glassmorphism Dashboard**: Monitor live calls, review history, and "arm/disarm" your agent.

---

## 🛠️ Tech Stack

- **Backend**: Java 21, Spring Boot 3.2, Spring WebSocket
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **AI/ML**: 
  - **Brain**: Anthropic Claude 3.5 Sonnet
  - **STT**: Deepgram Nova-3 (Streaming μ-law)
  - **TTS**: ElevenLabs (Turbo v2.5)
  - **Vector DB**: Pinecone (for RAG)
- **Infrastructure**: Twilio (Voice SDK), Google Cloud Run, Redis

---

## 🚀 Setup Guide

### 1. Prerequisites
- **Twilio Account**: A purchased phone number.
- **Deepgram API Key**: For real-time transcription.
- **ElevenLabs API Key**: For voice synthesis.
- **Anthropic API Key**: For the AI brain.
- **Pinecone API Key**: (Optional) For RAG self-training.

### 2. Physical Setup (Environment Variables)
Create a `.env` file in the root directory:
```env
# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# AI Services
ANTHROPIC_API_KEY=your_key
DEEPGRAM_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
ELEVENLABS_VOICE_ID=your_voice_id

# Database & Routing
REDIS_URL=redis://localhost:6379
SERVER_BASE_URL=https://your-app-url.com
USER_REAL_PHONE=+19876543210
```

### 3. Local Development
**Run Backend:**
```bash
cd backend
./mvnw spring-boot:run
```

**Run Frontend:**
```bash
cd voice-ai-agent
npm install
npm run dev
```

### 4. Configure Twilio
In the Twilio Console, set your Number's **Voice Webhook** to:
`https://<your-base-url>/api/calls/incoming`

---

## 📘 How to Use

1. **Arm the Agent**: On the dashboard, toggle the "Agent Armed" switch.
2. **The Call Flow**:
   - An incoming call hits Twilio.
   - Twilio sends a webhook to the backend.
   - Backend returns TwiML instructions to open a WebSocket stream.
   - AI Agent starts reasoning and speaking based on your `ai_dna.txt`.
3. **Live Monitoring**: Watch the transcript appear in real-time on the dashboard.
4. **Handoff**: Click "Take Over" to stop the AI and bridge the call to your real phone.

---

## 🔒 Privacy & Safety
This project is designed with privacy in mind. Ensure you do not commit your `.env` file. Modify `src/main/resources/ai_dna.txt` and `resume.json` to reflect your own background before deploying.

## 📄 License
MIT License - Feel free to use, modify, and distribute!
