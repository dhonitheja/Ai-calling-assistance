package com.callscreen.handler;

import com.callscreen.service.ClaudeService;
import com.callscreen.service.DeepgramService;
import com.callscreen.service.ElevenLabsService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class AudioStreamHandler extends TextWebSocketHandler {

    private final DeepgramService deepgramService;
    private final ClaudeService claudeService;
    private final ElevenLabsService elevenLabsService;
    private final ObjectMapper mapper = new ObjectMapper();

    // Map Twilio Session ID -> Deepgram WebSocket
    private final Map<String, okhttp3.WebSocket> activeStreams = new ConcurrentHashMap<>();
    // Store Twilio StreamSids so we can send audio back
    private final Map<String, String> streamSids = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("📞 Twilio WS Connected: {}", session.getId());
        
        // Open Deepgram STT stream
        okhttp3.WebSocket dgWs = deepgramService.openStream(transcript -> {
            log.info("Caller said: {}", transcript);
            handleCallerSpeech(session, transcript);
        });
        
        activeStreams.put(session.getId(), dgWs);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode root = mapper.readTree(message.getPayload());
        String event = root.path("event").asText();

        if ("start".equals(event)) {
            String streamSid = root.path("start").path("streamSid").asText();
            streamSids.put(session.getId(), streamSid);
            log.info("▶\uFE0F Stream started: {}", streamSid);
            
            // Send initial greeting!
            sendBotSpeech(session, "Hi there! I am the AI screening assistant for Sai Teja. How can I help you today?");
            
        } else if ("media".equals(event)) {
            // Forward Twilio mulaw audio bytes to Deepgram
            String base64Audio = root.path("media").path("payload").asText();
            byte[] rawAudio = Base64.getDecoder().decode(base64Audio);
            
            okhttp3.WebSocket dgWs = activeStreams.get(session.getId());
            if (dgWs != null) {
                deepgramService.sendAudio(dgWs, rawAudio);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("🛑 Twilio WS Closed: {}", session.getId());
        okhttp3.WebSocket dgWs = activeStreams.remove(session.getId());
        streamSids.remove(session.getId());
        if (dgWs != null) {
            deepgramService.closeStream(dgWs);
        }
    }

    private void handleCallerSpeech(WebSocketSession session, String text) {
        // Run AI generation asynchronously so we don't block the WebSocket receiving thread
        new Thread(() -> {
            try {
                // 1. Get text from Claude
                String aiReply = claudeService.respond(text, null);
                log.info("AI reply: {}", aiReply);
                
                // 2. Synthesize audio
                sendBotSpeech(session, aiReply);
            } catch (Exception e) {
                log.error("AI pipeline error: {}", e.getMessage());
            }
        }).start();
    }

    private void sendBotSpeech(WebSocketSession session, String text) {
        try {
            byte[] audioBytes = elevenLabsService.synthesize(text);
            if (audioBytes == null) return;
            
            String streamSid = streamSids.get(session.getId());
            if (streamSid == null) return;

            // Twilio requires Base64 encoded payload
            String base64Audio = Base64.getEncoder().encodeToString(audioBytes);
            
            String payload = mapper.writeValueAsString(Map.of(
                "event", "media",
                "streamSid", streamSid,
                "media", Map.of("payload", base64Audio)
            ));
            
            synchronized(session) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(payload));
                }
            }
        } catch (Exception e) {
            log.error("Failed to send audio back to Twilio: {}", e.getMessage());
        }
    }
}
