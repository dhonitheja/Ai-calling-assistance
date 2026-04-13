package com.callscreen.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Deepgram streaming STT service.
 * Opens a WebSocket to Deepgram, pipes raw μ-law audio,
 * and calls the transcript consumer on each final utterance.
 */
@Slf4j
@Service
public class DeepgramService {

    @Value("${deepgram.api-key:}")
    private String apiKey;

    @Value("${deepgram.model:nova-3}")
    private String model;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Opens a Deepgram streaming WebSocket session.
     *
     * @param onTranscript called with final transcript text
     * @return WebSocket instance you can send audio bytes to
     */
    public WebSocket openStream(Consumer<String> onTranscript) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("Deepgram API key not set — STT disabled");
            return null;
        }

        String url = String.format(
                // smart_format: capitalises, adds punctuation, formats numbers naturally
                // utterance_end_ms: fires final transcript after 1000ms of silence (good for phone pauses)
                // endpointing: 300ms silence threshold to detect end of utterance quickly
                "wss://api.deepgram.com/v1/listen?model=%s&encoding=mulaw&sample_rate=8000" +
                "&channels=1&punctuate=true&smart_format=true&interim_results=false" +
                "&utterance_end_ms=1000&endpointing=300",
                model
        );

        Request request = new Request.Builder()
                .url(url)
                .addHeader("Authorization", "Token " + apiKey)
                .build();

        return httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                log.info("Deepgram WS opened");
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                try {
                    JsonNode root = mapper.readTree(text);
                    JsonNode channel = root.path("channel");
                    JsonNode alternatives = channel.path("alternatives");
                    if (alternatives.isArray() && alternatives.size() > 0) {
                        String transcript = alternatives.get(0).path("transcript").asText();
                        boolean isFinal = root.path("is_final").asBoolean(false);
                        if (isFinal && !transcript.isBlank()) {
                            log.debug("Deepgram final: {}", transcript);
                            onTranscript.accept(transcript);
                        }
                    }
                } catch (Exception e) {
                    log.error("Deepgram parse error: {}", e.getMessage());
                }
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                log.error("Deepgram WS failure: {}", t.getMessage());
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                log.info("Deepgram WS closed: {} {}", code, reason);
            }
        });
    }

    /**
     * Send raw audio bytes to the Deepgram stream.
     * Audio must be μ-law 8kHz as received from Twilio Media Streams.
     */
    public void sendAudio(WebSocket ws, byte[] audioBytes) {
        if (ws != null) {
            ws.send(okio.ByteString.of(audioBytes));
        }
    }

    public void closeStream(WebSocket ws) {
        if (ws != null) {
            ws.send("{\"type\": \"CloseStream\"}");
            ws.close(1000, "Done");
        }
    }
}
