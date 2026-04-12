package com.callscreen.handler;

import com.callscreen.model.SimulateRequest;
import com.callscreen.service.ClaudeService;
import com.callscreen.service.DeepgramService;
import com.callscreen.service.ElevenLabsService;
import com.callscreen.service.RecordingService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Component
@RequiredArgsConstructor
public class AudioStreamHandler extends TextWebSocketHandler {

    private final DeepgramService deepgramService;
    private final ClaudeService claudeService;
    private final ElevenLabsService elevenLabsService;
    private final RecordingService recordingService;
    private final ObjectMapper mapper = new ObjectMapper();

    // Map Twilio Session ID -> Deepgram WebSocket
    private final Map<String, okhttp3.WebSocket> activeStreams = new ConcurrentHashMap<>();
    // Store Twilio StreamSids so we can send audio back
    private final Map<String, String> streamSids = new ConcurrentHashMap<>();
    // Per-call conversation history for multi-turn context
    private final Map<String, List<SimulateRequest.ConversationMessage>> callHistories = new ConcurrentHashMap<>();
    // Per-call raw audio accumulation for recording
    private final Map<String, List<byte[]>> callAudioChunks = new ConcurrentHashMap<>();
    // Per-call caller phone number
    private final Map<String, String> callerNumbers = new ConcurrentHashMap<>();
    // Track if we are currently generating a response (prevents overlapping responses)
    private final Map<String, AtomicBoolean> respondingFlags = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("📞 Twilio WS Connected: {}", session.getId());

        callHistories.put(session.getId(), new ArrayList<>());
        callAudioChunks.put(session.getId(), new ArrayList<>());
        respondingFlags.put(session.getId(), new AtomicBoolean(false));

        // Open Deepgram STT stream — only fire on final transcript
        okhttp3.WebSocket dgWs = deepgramService.openStream(transcript -> {
            log.info("Caller said: [{}]", transcript);
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

            // Extract caller phone from customParameters if present
            JsonNode customParams = root.path("start").path("customParameters");
            String callerNum = customParams.path("from").asText("");
            if (!callerNum.isBlank()) {
                callerNumbers.put(session.getId(), callerNum);
            }

            log.info("▶ Stream started: {} caller={}", streamSid, callerNum);
            // DO NOT send any greeting — wait for caller to speak first

        } else if ("media".equals(event)) {
            String base64Audio = root.path("media").path("payload").asText();
            byte[] rawAudio = Base64.getDecoder().decode(base64Audio);

            // Accumulate audio for recording
            List<byte[]> chunks = callAudioChunks.get(session.getId());
            if (chunks != null) {
                chunks.add(rawAudio);
            }

            // Forward to Deepgram for STT
            okhttp3.WebSocket dgWs = activeStreams.get(session.getId());
            if (dgWs != null) {
                deepgramService.sendAudio(dgWs, rawAudio);
            }

        } else if ("stop".equals(event)) {
            log.info("⏹ Stream stop received for session {}", session.getId());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("🛑 Twilio WS Closed: {} status={}", session.getId(), status);
        okhttp3.WebSocket dgWs = activeStreams.remove(session.getId());
        String streamSid = streamSids.remove(session.getId());

        // Finalize recording: save audio + transcript
        List<byte[]> chunks = callAudioChunks.remove(session.getId());
        List<SimulateRequest.ConversationMessage> history = callHistories.remove(session.getId());
        String caller = callerNumbers.remove(session.getId());
        respondingFlags.remove(session.getId());

        if (chunks != null && !chunks.isEmpty() && history != null) {
            recordingService.saveCallRecording(streamSid != null ? streamSid : session.getId(), caller, chunks, history);
        }

        if (dgWs != null) {
            deepgramService.closeStream(dgWs);
        }
    }

    private void handleCallerSpeech(WebSocketSession session, String text) {
        if (text == null || text.isBlank()) return;

        AtomicBoolean responding = respondingFlags.get(session.getId());
        if (responding == null || !responding.compareAndSet(false, true)) {
            log.debug("Skipping transcript — already responding");
            return;
        }

        List<SimulateRequest.ConversationMessage> history = callHistories.get(session.getId());

        // Run AI generation async so we don't block the WebSocket receiving thread
        Thread.ofVirtual().start(() -> {
            try {
                // Add caller utterance to history
                if (history != null) {
                    synchronized (history) {
                        history.add(new SimulateRequest.ConversationMessage("user", text));
                    }
                }

                // Get response from Claude with full conversation history
                List<SimulateRequest.ConversationMessage> historyCopy = history != null
                        ? new ArrayList<>(history) : new ArrayList<>();
                String aiReply = claudeService.respond(text, historyCopy);
                log.info("AI reply: {}", aiReply);

                // Add AI response to history
                if (history != null) {
                    synchronized (history) {
                        history.add(new SimulateRequest.ConversationMessage("assistant", aiReply));
                    }
                }

                // Synthesize and send back audio
                sendBotSpeech(session, aiReply);
            } catch (Exception e) {
                log.error("AI pipeline error: {}", e.getMessage(), e);
            } finally {
                AtomicBoolean flag = respondingFlags.get(session.getId());
                if (flag != null) flag.set(false);
            }
        });
    }

    private void sendBotSpeech(WebSocketSession session, String text) {
        try {
            byte[] audioBytes = elevenLabsService.synthesize(text);
            if (audioBytes == null || audioBytes.length == 0) {
                log.warn("ElevenLabs returned empty audio for text: {}", text);
                return;
            }

            String streamSid = streamSids.get(session.getId());
            if (streamSid == null) {
                log.warn("No streamSid for session {}", session.getId());
                return;
            }

            String base64Audio = Base64.getEncoder().encodeToString(audioBytes);

            String payload = mapper.writeValueAsString(Map.of(
                    "event", "media",
                    "streamSid", streamSid,
                    "media", Map.of("payload", base64Audio)
            ));

            synchronized (session) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(payload));
                }
            }
        } catch (Exception e) {
            log.error("Failed to send audio back to Twilio: {}", e.getMessage(), e);
        }
    }
}
