package com.callscreen.service;

import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * ElevenLabs TTS service.
 * Converts text to speech audio bytes using ElevenLabs REST API.
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

    private static final String TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/%s";

    /**
     * Synthesize text to MP3 audio bytes.
     * Returns null if TTS is unconfigured or fails.
     */
    public byte[] synthesize(String text) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("ElevenLabs API key not set — TTS disabled");
            return null;
        }

        try {
            String requestBody = String.format("""
                    {
                        "text": "%s",
                        "model_id": "eleven_turbo_v2",
                        "voice_settings": {
                            "stability": 0.5,
                            "similarity_boost": 0.75
                        }
                    }
                    """, text.replace("\"", "\\\""));

            Request request = new Request.Builder()
                    .url(String.format(TTS_URL, voiceId))
                    .post(RequestBody.create(requestBody.getBytes(),
                            MediaType.parse("application/json")))
                    .addHeader("xi-api-key", apiKey)
                    .addHeader("Accept", "audio/mpeg")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.error("ElevenLabs error: {} {}", response.code(), response.body().string());
                    return null;
                }
                return response.body().bytes();
            }
        } catch (IOException e) {
            log.error("ElevenLabs call failed: {}", e.getMessage());
            return null;
        }
    }
}
