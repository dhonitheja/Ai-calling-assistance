# ⚙️ Voice AI Agent Backend

A high-performance **Spring Boot 3.2** backend that orchestrates the real-time voice AI pipeline via Twilio WebSockets.

## 🚀 Quick Start

1. Prerequisites:
   - JDK 21
   - Maven 3+

2. Run the application:
   ```bash
   ./mvnw spring-boot:run
   ```

## 🔌 Core Webhooks

- `POST /api/calls/incoming`: Twilio entry point. Returns TwiML with `<Connect><Stream>` to establish the WebSocket.
- `GET /api/agent/status`: Returns current AI mode status.
- `POST /api/agent/arm`: Enables the AI calling assistant.

## 🛠️ Key Services

- `TwilioStreamHandler`: Managed WebSocket sessions for two-way audio streaming.
- `AIGenerationService`: Proxies requests to LLMs and handles response streaming.
- `ElevenLabsService`: Handles Text-to-Speech synthesis with sub-200ms latency.

## 🚢 Deployment (Cloud Run)

The backend is deployed as a containerized Spring Boot app.
```bash
gcloud run deploy callscreen-backend --source . --region us-central1 --allow-unauthenticated
```
