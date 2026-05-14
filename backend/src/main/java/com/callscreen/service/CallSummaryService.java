package com.callscreen.service;

import com.callscreen.model.SimulateRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * CallSummaryService — after every call, uses Claude to produce a clean
 * human-readable summary and saves it next to the transcript.
 *
 * Summary includes:
 *  - Caller number + timestamp
 *  - Who spoke and what was said (plain English)
 *  - Key topics discussed
 *  - Any action items or next steps mentioned
 *  - Whether AI or you handled it, and when any handoff happened
 *
 * Files written per call:
 *   recordings/<timestamp>_<caller>/
 *       summary.txt     ← plain English summary
 *       transcript.json ← raw Q/A turns (already written by RecordingService)
 *       audio.wav       ← full call audio
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CallSummaryService {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-sonnet-4-5}")
    private String model;

    private final GcsStorageService gcs;
    private final ObjectMapper mapper = new ObjectMapper();
    private static final String CLAUDE_URL = "https://api.anthropic.com/v1/messages";

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build();

    /**
     * Generate and save a call summary. Called async from RecordingService.
     */
    public void generateAndSave(String callId, String caller, String startedAt,
                                  List<SimulateRequest.ConversationMessage> history,
                                  String handledBy) {
        if (history == null || history.isEmpty()) return;

        Thread.ofVirtual().start(() -> {
            try {
                String summary = generateSummary(caller, startedAt, history, handledBy);
                saveSummary(callId, summary);
            } catch (Exception e) {
                log.warn("Summary generation failed: {}", e.getMessage());
            }
        });
    }

    private String generateSummary(String caller, String startedAt,
                                    List<SimulateRequest.ConversationMessage> history,
                                    String handledBy) {
        if (apiKey == null || apiKey.isBlank()) {
            return buildFallbackSummary(caller, startedAt, history, handledBy);
        }

        // Build transcript text
        StringBuilder transcript = new StringBuilder();
        for (SimulateRequest.ConversationMessage msg : history) {
            String label = "user".equals(msg.getRole()) ? "RECRUITER" : "SAITEJA (AI)";
            transcript.append(label).append(": ").append(msg.getContent()).append("\n");
        }

        String systemPrompt = """
                You are summarizing a phone screening call. Be factual and concise.
                Output a plain text summary with these sections — no markdown, no bullets, just paragraphs:

                CALL DETAILS
                WHO CALLED
                WHAT WAS DISCUSSED
                KEY TOPICS
                NEXT STEPS / ACTION ITEMS
                HANDLED BY

                Keep each section to 1-2 sentences. Total summary under 200 words.
                """;

        String userMessage = String.format("""
                Caller: %s
                Time: %s
                Handled by: %s
                Turns: %d

                TRANSCRIPT:
                %s

                Write the call summary now.
                """, caller, startedAt, handledBy, history.size(), transcript);

        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            body.put("max_tokens", 300);
            body.put("system", systemPrompt);

            ArrayNode messages = mapper.createArrayNode();
            ObjectNode userNode = mapper.createObjectNode();
            userNode.put("role", "user");
            userNode.put("content", userMessage);
            messages.add(userNode);
            body.set("messages", messages);

            Request request = new Request.Builder()
                    .url(CLAUDE_URL)
                    .post(RequestBody.create(mapper.writeValueAsBytes(body),
                            MediaType.parse("application/json")))
                    .addHeader("x-api-key", apiKey)
                    .addHeader("anthropic-version", "2023-06-01")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) return buildFallbackSummary(caller, startedAt, history, handledBy);
                ResponseBody responseBody = response.body();
                if (responseBody == null) return buildFallbackSummary(caller, startedAt, history, handledBy);
                JsonNode root = mapper.readTree(responseBody.string());
                JsonNode content = root.path("content");
                if (!content.isArray() || content.isEmpty()) {
                    return buildFallbackSummary(caller, startedAt, history, handledBy);
                }
                return content.get(0).path("text").asText(buildFallbackSummary(caller, startedAt, history, handledBy));
            }
        } catch (IOException e) {
            log.warn("Claude summary call failed: {}", e.getMessage());
            return buildFallbackSummary(caller, startedAt, history, handledBy);
        }
    }

    private void saveSummary(String callId, String summary) {
        String callDir = gcs.findDirByCallId(callId);
        if (callDir == null) {
            log.warn("Could not find GCS call dir for callId={}", callId);
            return;
        }
        gcs.writeSummary(callDir, summary);
        log.info("📋 Summary saved → GCS calls/{}/summary.txt", callDir);
    }

    /** Fallback if Claude API is unavailable — builds summary from raw transcript */
    private String buildFallbackSummary(String caller, String startedAt,
                                          List<SimulateRequest.ConversationMessage> history,
                                          String handledBy) {
        int recruiterTurns  = (int) history.stream().filter(m -> "user".equals(m.getRole())).count();
        int aiTurns         = (int) history.stream().filter(m -> "assistant".equals(m.getRole())).count();

        String firstQuestion = history.stream()
                .filter(m -> "user".equals(m.getRole()))
                .map(SimulateRequest.ConversationMessage::getContent)
                .findFirst().orElse("(no questions recorded)");

        return String.format("""
                CALL DETAILS
                Date/Time: %s | Duration: %d turns total

                WHO CALLED
                Caller number: %s

                WHAT WAS DISCUSSED
                The recruiter asked %d questions. First question: "%s"

                KEY TOPICS
                See full transcript in transcript.json for complete details.

                NEXT STEPS / ACTION ITEMS
                Review transcript for any follow-up actions mentioned.

                HANDLED BY
                %s (%d AI responses)
                """, startedAt, history.size(), caller, recruiterTurns, firstQuestion, handledBy, aiTurns);
    }
}
