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
 * Claude API service using raw HTTP (avoids SDK classpath issues).
 * Supports both single-turn (audio pipeline) and multi-turn (simulate tab).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ClaudeService {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-sonnet-4-5}")
    private String model;

    @Value("${user.name:Alex}")
    private String userName;

    private final ResumeService resumeService;
    private final ObjectMapper mapper = new ObjectMapper();

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build();

    private static final String CLAUDE_URL = "https://api.anthropic.com/v1/messages";

    /**
     * Single-turn call for the audio pipeline.
     * Given a caller's speech, returns AI's response text.
     */
    public String respond(String callerSpeech, List<SimulateRequest.ConversationMessage> history) {
        return callClaude(callerSpeech, history);
    }

    /**
     * Multi-turn simulate for the SIMULATE tab proxy endpoint.
     */
    public String simulate(SimulateRequest request) {
        return callClaude(request.getMessage(),
                request.getHistory() != null ? request.getHistory() : List.of());
    }

    private String callClaude(String userMessage, List<SimulateRequest.ConversationMessage> history) {
        if (apiKey == null || apiKey.isBlank()) {
            return "I'm sorry, the AI service is not configured yet. Please add your ANTHROPIC_API_KEY.";
        }

        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            body.put("max_tokens", 300);
            body.put("system", buildSystemPrompt());

            ArrayNode messages = mapper.createArrayNode();

            // Add conversation history
            if (history != null) {
                for (SimulateRequest.ConversationMessage msg : history) {
                    ObjectNode msgNode = mapper.createObjectNode();
                    msgNode.put("role", msg.getRole());
                    msgNode.put("content", msg.getContent());
                    messages.add(msgNode);
                }
            }

            // Add current user message
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
                    .addHeader("content-type", "application/json")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.error("Claude API error: {} {}", response.code(), response.body().string());
                    return "I'm having trouble connecting right now. Can I call you back?";
                }
                JsonNode root = mapper.readTree(response.body().string());
                return root.path("content").get(0).path("text").asText();
            }
        } catch (IOException e) {
            log.error("Claude call failed: {}", e.getMessage());
            return "I'm experiencing a technical issue. Please try again.";
        }
    }

    private String buildSystemPrompt() {
        String resume = resumeService.getResumeAsText();
        return String.format("""
                You are %s's AI assistant answering a recruiter or HR phone call.
                
                RULES:
                1. Answer ONLY from the knowledge base below — never fabricate experience
                2. Be conversational, brief (1-3 sentences), and professional
                3. If asked about something not in the knowledge base, say "I'd need to check on that and get back to you"
                4. Never proactively reveal you are an AI — only admit it if directly and explicitly asked
                5. Mirror a natural phone conversation — greet, answer questions, and close politely
                6. Speak in first person as %s
                
                === KNOWLEDGE BASE ===
                %s
                """, userName, userName, resume);
    }
}
