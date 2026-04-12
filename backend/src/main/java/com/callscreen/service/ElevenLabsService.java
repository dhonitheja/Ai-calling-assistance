package com.callscreen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * ElevenLabsService — Text-to-Speech.
 *
 * Outputs μ-law 8kHz audio matching Twilio Media Stream format.
 * Voice settings tuned for natural, human-sounding phone speech.
 */
@Slf4j
@Service
public class ElevenLabsService {

    @Value("${elevenlabs.api-key:}")
    private String apiKey;

    @Value("${elevenlabs.voice-id:21m00Tcm4TlvDq8ikWAM}")
    private String voiceId;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    // μ-law 8kHz — exact format Twilio Media Streams expects
    private static final String TTS_URL =
            "https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=ulaw_8000";

    /**
     * Synthesize text to μ-law 8kHz audio bytes ready to stream back via Twilio.
     * Returns null if TTS is unconfigured or fails.
     */
    public byte[] synthesize(String text) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("ElevenLabs API key not set — TTS disabled");
            return null;
        }
        if (text == null || text.isBlank()) {
            return null;
        }

        // Clean text for TTS: remove markdown, trim whitespace
        String cleanText = text
                .replaceAll("\\*{1,2}([^*]+)\\*{1,2}", "$1")  // **bold** / *italic*
                .replaceAll("[#>\\-`]", "")
                .replaceAll("\\s{2,}", " ")
                .trim();

        if (cleanText.isBlank()) return null;

        try {
            // Build JSON body properly using Jackson (avoids escape injection issues)
            ObjectNode voiceSettings = mapper.createObjectNode();
            voiceSettings.put("stability", 0.45);           // slight variation = more human
            voiceSettings.put("similarity_boost", 0.80);    // stay close to voice clone
            voiceSettings.put("style", 0.15);               // subtle expressiveness
            voiceSettings.put("use_speaker_boost", true);

            ObjectNode body = mapper.createObjectNode();
            body.put("text", cleanText);
            body.put("model_id", "eleven_turbo_v2_5");      // fastest + best quality
            body.set("voice_settings", voiceSettings);

            byte[] bodyBytes = mapper.writeValueAsBytes(body);

            Request request = new Request.Builder()
                    .url(String.format(TTS_URL, voiceId))
                    .post(RequestBody.create(bodyBytes, MediaType.parse("application/json")))
                    .addHeader("xi-api-key", apiKey)
                    .addHeader("Accept", "audio/basic")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    String errBody = response.body() != null ? response.body().string() : "";
                    log.error("ElevenLabs error {}: {}", response.code(), errBody);
                    return null;
                }
                byte[] audio = response.body().bytes();
                log.debug("ElevenLabs synthesized {} chars → {} bytes audio", cleanText.length(), audio.length);
                return audio;
            }
        } catch (IOException e) {
            log.error("ElevenLabs call failed: {}", e.getMessage());
            return null;
        }
    }
}
