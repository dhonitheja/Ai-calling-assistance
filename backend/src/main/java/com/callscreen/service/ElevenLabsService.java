package com.callscreen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import okhttp3.ResponseBody;
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
     * Applies natural Indian English speech patterns to the text before TTS.
     *
     * Indian English characteristics:
     * - Slightly more deliberate pacing — commas added at natural breath points
     * - "actually" and "basically" used as natural thought connectors
     * - Contractions less frequent ("I am" preferred over "I'm" in formal context)
     * - Direct, confident phrasing without excessive hedging
     * - Numbers and acronyms spaced for clarity (LLM → L L M)
     */
    private String applyIndianEnglishStyle(String text) {
        // Expand common contractions → fuller forms sound more natural in Indian English
        text = text.replaceAll("\\bI'm\\b", "I am");
        text = text.replaceAll("\\bI've\\b", "I have");
        text = text.replaceAll("\\bI'd\\b", "I would");
        text = text.replaceAll("\\bI'll\\b", "I will");
        text = text.replaceAll("\\bdon't\\b", "do not");
        text = text.replaceAll("\\bcan't\\b", "cannot");
        text = text.replaceAll("\\bwon't\\b", "will not");
        text = text.replaceAll("\\bdidn't\\b", "did not");
        text = text.replaceAll("\\bhaven't\\b", "have not");
        text = text.replaceAll("\\bwouldn't\\b", "would not");
        text = text.replaceAll("\\bwe're\\b", "we are");
        text = text.replaceAll("\\bthey're\\b", "they are");
        text = text.replaceAll("\\bthat's\\b", "that is");
        text = text.replaceAll("\\bit's\\b", "it is");

        // Spell out acronyms so TTS pronounces each letter clearly
        text = text.replaceAll("\\bLLM\\b", "L L M");
        text = text.replaceAll("\\bRAG\\b", "R A G");
        text = text.replaceAll("\\bAPI\\b", "A P I");
        text = text.replaceAll("\\bCI/CD\\b", "C I C D");
        text = text.replaceAll("\\bGCP\\b", "G C P");
        text = text.replaceAll("\\bAWS\\b", "A W S");
        text = text.replaceAll("\\bOPT\\b", "O P T");

        // Add natural pause after "So" / "Well" / "Yeah" at start of sentence
        text = text.replaceAll("^(So|Well|Yeah|Yes|No),?\\s+", "$1, ");

        return text.trim();
    }

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

        // Clean text: remove markdown artifacts
        String cleanText = text
                .replaceAll("\\*{1,2}([^*]+)\\*{1,2}", "$1")
                .replaceAll("[#>\\-`]", "")
                .replaceAll("\\s{2,}", " ")
                .trim();

        if (cleanText.isBlank()) return null;

        // Apply Indian English naturalness transforms
        cleanText = applyIndianEnglishStyle(cleanText);

        try {
            ObjectNode voiceSettings = mapper.createObjectNode();
            // Tuned for Indian English accent naturalness:
            // - stability 0.60: consistent accent rhythm, not too robotic
            // - similarity_boost 0.65: gives ElevenLabs room to apply accent naturally
            //   (too high = over-cloned American neutral, too low = drifts off voice)
            // - style 0.30: expressive enough to sound like a real person talking
            // - speaker_boost true: adds presence/warmth on phone quality audio
            voiceSettings.put("stability", 0.60);
            voiceSettings.put("similarity_boost", 0.65);
            voiceSettings.put("style", 0.30);
            voiceSettings.put("use_speaker_boost", true);

            ObjectNode body = mapper.createObjectNode();
            body.put("text", cleanText);
            body.put("model_id", "eleven_turbo_v2_5");
            body.set("voice_settings", voiceSettings);

            byte[] bodyBytes = mapper.writeValueAsBytes(body);

            Request request = new Request.Builder()
                    .url(String.format(TTS_URL, voiceId))
                    .post(RequestBody.create(bodyBytes, MediaType.parse("application/json")))
                    .addHeader("xi-api-key", apiKey)
                    // BUG FIX: Accept: audio/basic can cause 406 Not Acceptable on some
                    // ElevenLabs model versions. Use */* and let output_format param control format.
                    .addHeader("Accept", "*/*")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                ResponseBody responseBody = response.body();
                if (!response.isSuccessful()) {
                    // BUG FIX: response.body() can be null; must check before calling .string()
                    String errBody = responseBody != null ? responseBody.string() : "(no body)";
                    log.error("ElevenLabs error {}: {}", response.code(), errBody);
                    return null;
                }
                if (responseBody == null) {
                    log.error("ElevenLabs returned empty body");
                    return null;
                }
                byte[] audio = responseBody.bytes();
                log.debug("ElevenLabs synthesized {} chars → {} bytes audio", cleanText.length(), audio.length);
                return audio;
            }
        } catch (IOException e) {
            log.error("ElevenLabs call failed: {}", e.getMessage());
            return null;
        }
    }
}
