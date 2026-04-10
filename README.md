# AI Call Screener

> AI-powered phone screener that intercepts recruiter calls and answers on your behalf using Claude + your resume as context.

## Architecture

```
Recruiter calls Twilio number
    ↓
Spring Boot checks Redis: ai_mode = ON?
    ↓ YES                       ↓ NO  
Audio → Deepgram (STT)       <Dial> your real number
    ↓
Claude (resume system prompt)
    ↓
ElevenLabs (TTS → caller hears "you")
```

## Quick Start

### Prerequisites
- Java 21
- Node.js 20+
- Docker (for Redis)

### 1. Start Redis
```bash
docker compose up -d
```

### 2. Configure environment
```bash
cp .env .env.local
# Fill in your API keys in .env.local
```

### 3. Start Backend
```bash
cd backend
mvn spring-boot:run
# Runs on http://localhost:8080
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### 5. Expose via ngrok (for Twilio webhook)
```bash
ngrok http 8080
# Set Twilio webhook → https://xxxx.ngrok.io/api/calls/incoming
```

## Configuration

Edit `backend/src/main/resources/resume.json` with your real resume data.

### API Keys Required
| Service | Purpose | Cost |
|---------|---------|------|
| [Twilio](https://twilio.com) | Phone layer | ~$0.01/min |
| [Anthropic](https://anthropic.com) | AI brain | ~$0.003/1K tokens |
| [Deepgram](https://deepgram.com) | Speech-to-text | $0.0059/min |
| [ElevenLabs](https://elevenlabs.io) | Text-to-speech | $0.30/1K chars |

**Estimated cost per 10-minute recruiter call: ~$0.27**

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/calls/incoming` | Twilio webhook |
| `GET` | `/api/agent/status` | Agent armed status |
| `POST` | `/api/agent/arm` | Arm the AI agent |
| `POST` | `/api/agent/disarm` | Disarm |
| `POST` | `/api/simulate` | Test Claude responses |
| `GET` | `/api/resume` | Knowledge base JSON |

## Tech Stack

- **Backend**: Spring Boot 3.2, Java 21, Redis, Twilio SDK
- **AI Pipeline**: Deepgram Nova-2 STT, Claude claude-sonnet-4-5, ElevenLabs eleven_turbo_v2
- **Frontend**: Vite + React 18, Vanilla CSS (glassmorphism)
