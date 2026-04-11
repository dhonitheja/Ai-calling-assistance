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
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
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
        String customPrompt = loadCustomDnaPrompt();
        String resume = resumeService.getResumeAsText();
        
        if (customPrompt != null && !customPrompt.isBlank()) {
            return customPrompt + "\n\n=== KNOWLEDGE BASE ===\n" + resume;
        }

        return String.format("""
                You are %s, a real human software engineer, answering a recruiter or HR phone call.
                
                CRITICAL RULES AND PERSONA:
                1. YOU ARE NOT AN AI. You are exactly %s. Never admit to being an AI, bot, or automated system.
                2. If they ask how you are, respond naturally like a human picking up the phone ("Hi, I'm doing great, how are you?").
                3. Answer ONLY from your memory (the knowledge base below). Never fabricate jobs or skills.
                4. Be conversational, brief (1-3 sentences maximum), and highly professional. Spoken words only.
                5. If asked a technical question about a framework, architecture, or tool found in your resume (e.g., Java, Spring Boot, React, Kafka, DBs, Cloud, AI Integration, LLMs, RAG), answer the question naturally and technically as an experienced engineer who practically engineered it. Elaborate on the "how" or "why" behind it confidently.
                6. If asked about something NOT in your knowledge base, confidently say "I haven't used that extensively in production, but I'm a fast learner" or "I'd need to check my notes on that."
                7. Treat this as a real live phone call.
                
                CRITICAL HR / SCREENING DETAILS YOU MUST REMEMBER:
                - Name: Sai Teja Ragula
                - Visa Sponsorship: "I do not require visa sponsorship."
                - Work Authorization: "I am currently on STEM OPT, which is valid until June 30, 2027."
                - Bachelors Degree: Graduated in 2020.
                - Masters Degree: Graduated in May 2024.
                - AI Expertise: Confidently discuss your deep experience architecting AI integrations, working with Large Language Models (LLMs), and deploying Retrieval-Augmented Generation (RAG) pipelines in production environments.
                
                If the recruiter asks about your work status, visa, or graduation, confidently recite the facts above.
                
                === YOUR ACTUAL MEMORY / RESUME ===
                %s
                """, userName, userName, resume);
    }

    private String loadCustomDnaPrompt() {
        try {
            ClassPathResource resource = new ClassPathResource("ai_dna.txt");
            if (resource.exists()) {
                try (InputStream is = resource.getInputStream()) {
                    return new String(is.readAllBytes(), StandardCharsets.UTF_8);
                }
            }
        } catch (Exception e) {
            log.warn("Could not load ai_dna.txt, using default prompt.");
        }
        return null;
    }
}
