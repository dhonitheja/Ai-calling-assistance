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
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Component
@RequiredArgsConstructor
public class AudioStreamHandler extends TextWebSocketHandler {

    private final DeepgramService deepgramService;
    private final ClaudeService claudeService;
    private final ElevenLabsService elevenLabsService;
    private final RecordingService recordingService;
    private final ObjectMapper mapper = new ObjectMapper();

    private final Map<String, okhttp3.WebSocket> activeStreams       = new ConcurrentHashMap<>();
    private final Map<String, String>             streamSids         = new ConcurrentHashMap<>();
    private final Map<String, List<SimulateRequest.ConversationMessage>> callHistories = new ConcurrentHashMap<>();
    private final Map<String, List<byte[]>>       callAudioChunks    = new ConcurrentHashMap<>();
    private final Map<String, String>             callerNumbers      = new ConcurrentHashMap<>();

    /**
     * TRUE  = AI is currently speaking (generating + sending audio).
     * Any new transcript received while this is true means the caller
     * interrupted — we cancel the current response immediately and handle
     * the new utterance instead.
     */
    private final Map<String, AtomicBoolean>      speakingFlags      = new ConcurrentHashMap<>();

    /**
     * Holds the latest pending transcript when an interruption happens.
     * The speaking thread checks this after each sentence chunk and stops early.
     */
    private final Map<String, AtomicReference<String>> pendingInterrupt = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("📞 Twilio WS Connected: {}", session.getId());

        callHistories.put(session.getId(), new ArrayList<>());
        callAudioChunks.put(session.getId(), new ArrayList<>());
        speakingFlags.put(session.getId(), new AtomicBoolean(false));
        pendingInterrupt.put(session.getId(), new AtomicReference<>(null));

        okhttp3.WebSocket dgWs = deepgramService.openStream(transcript -> {
            log.info("🎙 Caller: [{}]", transcript);
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

            JsonNode customParams = root.path("start").path("customParameters");
            String callerNum = customParams.path("from").asText("");
            if (!callerNum.isBlank()) {
                callerNumbers.put(session.getId(), callerNum);
            }
            log.info("▶ Stream started: {} caller={}", streamSid, callerNum);

        } else if ("media".equals(event)) {
            String base64Audio = root.path("media").path("payload").asText();
            byte[] rawAudio = Base64.getDecoder().decode(base64Audio);

            List<byte[]> chunks = callAudioChunks.get(session.getId());
            if (chunks != null) chunks.add(rawAudio);

            okhttp3.WebSocket dgWs = activeStreams.get(session.getId());
            if (dgWs != null) deepgramService.sendAudio(dgWs, rawAudio);

        } else if ("stop".equals(event)) {
            log.info("⏹ Stream stop: {}", session.getId());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("🛑 Closed: {} status={}", session.getId(), status);

        okhttp3.WebSocket dgWs = activeStreams.remove(session.getId());
        String streamSid = streamSids.remove(session.getId());
        List<byte[]> chunks = callAudioChunks.remove(session.getId());
        List<SimulateRequest.ConversationMessage> history = callHistories.remove(session.getId());
        String caller = callerNumbers.remove(session.getId());
        speakingFlags.remove(session.getId());
        pendingInterrupt.remove(session.getId());

        if (chunks != null && !chunks.isEmpty() && history != null) {
            recordingService.saveCallRecording(
                streamSid != null ? streamSid : session.getId(), caller, chunks, history);
        }
        if (dgWs != null) deepgramService.closeStream(dgWs);
    }

    // ─── Core speech handler ─────────────────────────────────────────────────

    private void handleCallerSpeech(WebSocketSession session, String text) {
        if (text == null || text.isBlank()) return;

        AtomicBoolean speaking = speakingFlags.get(session.getId());
        AtomicReference<String> interrupt = pendingInterrupt.get(session.getId());

        if (speaking != null && speaking.get()) {
            // AI is mid-speech — store interruption, speaking thread will see it and stop
            if (interrupt != null) {
                interrupt.set(text);
                log.info("⚡ Interrupt queued: [{}]", text);
            }
            return;
        }

        // No ongoing speech — handle immediately
        processUtterance(session, text);
    }

    private void processUtterance(WebSocketSession session, String text) {
        AtomicBoolean speaking = speakingFlags.get(session.getId());
        if (speaking == null || !speaking.compareAndSet(false, true)) return;

        List<SimulateRequest.ConversationMessage> history = callHistories.get(session.getId());

        Thread.ofVirtual().start(() -> {
            try {
                // Build history snapshot WITHOUT the current message
                // (ClaudeService adds the current message itself)
                List<SimulateRequest.ConversationMessage> historySnapshot;
                synchronized (history) {
                    historySnapshot = new ArrayList<>(history);
                }

                // Get AI response
                String aiReply = claudeService.respond(text, historySnapshot);
                log.info("🤖 AI: [{}]", aiReply);

                // Only commit to history if we weren't interrupted
                AtomicReference<String> interrupt = pendingInterrupt.get(session.getId());
                if (interrupt != null && interrupt.get() != null) {
                    log.info("⚡ Response discarded — interrupted before audio sent");
                    return;
                }

                // Add both turns to history
                synchronized (history) {
                    history.add(new SimulateRequest.ConversationMessage("user", text));
                    history.add(new SimulateRequest.ConversationMessage("assistant", aiReply));
                }

                // Send audio — checks for interrupt before each sentence
                sendBotSpeechInterruptible(session, aiReply);

            } catch (Exception e) {
                log.error("AI pipeline error: {}", e.getMessage(), e);
            } finally {
                // Done speaking — check if an interrupt was queued while we were talking
                AtomicBoolean flag = speakingFlags.get(session.getId());
                if (flag != null) flag.set(false);

                AtomicReference<String> interrupt = pendingInterrupt.get(session.getId());
                if (interrupt != null) {
                    String queued = interrupt.getAndSet(null);
                    if (queued != null && !queued.isBlank()) {
                        log.info("▶ Processing queued interrupt: [{}]", queued);
                        processUtterance(session, queued);
                    }
                }
            }
        });
    }

    /**
     * Sends audio sentence by sentence.
     * Before each sentence, checks if an interrupt was received — if so, stops immediately.
     * This is what makes the AI feel responsive when you talk over it.
     */
    private void sendBotSpeechInterruptible(WebSocketSession session, String fullText) {
        // Split on sentence boundaries for interruptibility
        String[] sentences = fullText.split("(?<=[.!?])\\s+");
        if (sentences.length == 0) sentences = new String[]{fullText};

        for (String sentence : sentences) {
            sentence = sentence.trim();
            if (sentence.isBlank()) continue;

            // Check for interrupt before sending each sentence
            AtomicReference<String> interrupt = pendingInterrupt.get(session.getId());
            if (interrupt != null && interrupt.get() != null) {
                log.info("⚡ Mid-speech interrupt detected — stopping after current sentence boundary");
                break;
            }

            sendSentenceAudio(session, sentence);
        }
    }

    private void sendSentenceAudio(WebSocketSession session, String text) {
        try {
            byte[] audioBytes = elevenLabsService.synthesize(text);
            if (audioBytes == null || audioBytes.length == 0) return;

            String streamSid = streamSids.get(session.getId());
            if (streamSid == null) return;

            // Send a clear signal first so Twilio stops any buffered audio
            sendClearSignal(session, streamSid);

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
            log.error("Audio send error: {}", e.getMessage(), e);
        }
    }

    /**
     * Sends Twilio's "clear" event to immediately stop any audio currently
     * playing on the caller's end. This is what makes interruption audible —
     * without this, the old audio keeps playing even after we stop sending.
     */
    private void sendClearSignal(WebSocketSession session, String streamSid) {
        try {
            String clearPayload = mapper.writeValueAsString(Map.of(
                    "event", "clear",
                    "streamSid", streamSid
            ));
            synchronized (session) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(clearPayload));
                }
            }
        } catch (Exception e) {
            log.warn("Could not send clear signal: {}", e.getMessage());
        }
    }
}
