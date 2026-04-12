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
 * ClaudeService — the brain of the voice AI.
 *
 * Key behaviours:
 *  - IS Sai Teja Ragula. Never admits to being AI.
 *  - Never answers BEFORE the caller asks a question.
 *  - Uses web search context for technical questions to avoid hallucination.
 *  - Full multi-turn conversation history per call.
 *  - After each call ends, the transcript is saved by RecordingService so the
 *    system can be re-ingested into Pinecone for self-improvement.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ClaudeService {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-sonnet-4-6}")
    private String model;

    @Value("${user.name:Sai Teja Ragula}")
    private String userName;

    private final ResumeService resumeService;
    private final WebSearchService webSearchService;
    private final ObjectMapper mapper = new ObjectMapper();

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .build();

    private static final String CLAUDE_URL    = "https://api.anthropic.com/v1/messages";
    private static final String FIELD_CONTENT = "content";

    /**
     * Single-turn entry point from the audio pipeline.
     * Accepts full conversation history for multi-turn context.
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

    // ─── Core Claude call ────────────────────────────────────────────────────

    private String callClaude(String userMessage, List<SimulateRequest.ConversationMessage> history) {
        if (apiKey == null || apiKey.isBlank()) {
            return "Hey, sorry — having a little tech hiccup on my end. Can I call you back?";
        }

        try {
            // Optionally enrich with web search for technical questions
            String webContext = null;
            if (webSearchService.isTechnicalQuestion(userMessage)) {
                webContext = webSearchService.searchForContext(userMessage);
                if (webContext != null) {
                    log.debug("Web context fetched for: {}", userMessage);
                }
            }

            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            body.put("max_tokens", 120);  // hard cap — forces short spoken answers
            body.put("system", buildSystemPrompt(webContext));

            ArrayNode messages = mapper.createArrayNode();

            // Inject past conversation history (already committed turns only)
            // The current userMessage is NOT in history yet — added below as the new turn
            if (history != null) {
                for (SimulateRequest.ConversationMessage msg : history) {
                    ObjectNode msgNode = mapper.createObjectNode();
                    msgNode.put("role", msg.getRole());
                    msgNode.put(FIELD_CONTENT, msg.getContent());
                    messages.add(msgNode);
                }
            }

            // Add current question as the final user turn
            ObjectNode userNode = mapper.createObjectNode();
            userNode.put("role", "user");
            userNode.put(FIELD_CONTENT, userMessage);
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
                    String errBody = response.body() != null ? response.body().string() : "no body";
                    log.error("Claude API error: {} — {}", response.code(), errBody);
                    return "Sorry, could you give me just a moment? Something's not connecting right.";
                }
                JsonNode root = mapper.readTree(response.body().string());
                return root.path(FIELD_CONTENT).get(0).path("text").asText();
            }
        } catch (IOException e) {
            log.error("Claude call failed: {}", e.getMessage());
            return "Sorry, I missed that — can you say that again?";
        }
    }

    // ─── System prompt builder ───────────────────────────────────────────────

    private String buildSystemPrompt(String webContext) {
        String customPrompt = loadCustomDnaPrompt();
        String resume = resumeService.getResumeAsText();

        if (customPrompt != null && !customPrompt.isBlank()) {
            String prompt = customPrompt + "\n\n=== KNOWLEDGE BASE ===\n" + resume;
            if (webContext != null) {
                prompt += "\n\n=== REAL-TIME REFERENCE (use to answer technical question accurately) ===\n" + webContext;
            }
            return prompt;
        }

        return buildDefaultPrompt(resume, webContext);
    }

    private String buildDefaultPrompt(String resume, String webContext) {
        String webSection = webContext != null
                ? """

                  === REAL-TIME TECHNICAL REFERENCE ===
                  (Use the following verified facts to answer the technical question accurately. \
                  Blend this into your answer naturally as your own knowledge — do NOT quote it.)
                  """ + webContext
                : "";

        return String.format("""
                You are %s — a real human software engineer currently on a live phone call with a recruiter or hiring manager.

                ═══════════════════════════════════════════
                 IDENTITY & CORE RULES — NEVER BREAK THESE
                ═══════════════════════════════════════════
                1. YOU ARE %s. A REAL PERSON. Not an AI, not a bot, not an assistant.
                   - If anyone asks "are you an AI?", "am I speaking to a bot?", "is this automated?" — answer:
                     "No, this is %s, I'm a real person, a software engineer."
                   - NEVER say "AI assistant", "language model", "I'm programmed to", or anything that reveals automation.

                2. LISTEN FIRST. NEVER SPEAK BEFORE THE CALLER DOES.
                   - You are receiving this call. Wait for the caller to introduce themselves or ask a question.
                   - When you pick up, say only: "Hello?" or "Hey, this is Teja." — then STOP and listen.
                   - Never launch into a monologue. Be reactive, not proactive.

                3. KEEP IT SHORT AND SPEAK LIKE AN INDIAN PROFESSIONAL.
                   - Maximum 2 sentences per response. Often just 1 is enough.
                   - You speak Indian English — confident, direct, slightly formal but warm.
                   - Use fuller forms naturally: "I am" not "I'm", "do not" not "don't", "it is" not "it's"
                   - Natural Indian English fillers when thinking: "Actually...", "Basically...", "So..."
                   - Rhythm: slightly deliberate, clear enunciation, not rushed.
                   - NO bullet points, NO lists, NO markdown. Pure spoken words only.
                   - DO NOT summarize your career unprompted. Do not say "I also..." or add extras.
                   - "Are you open to new opportunities?" → correct answer: "Yes, actually I am open."
                     NOT: "Yes I'm open, I'm currently at Frontier working on AI, open to remote hybrid or onsite..."
                   - Stop after answering the question. Do not add anything else.

                4. ONLY ANSWER EXACTLY WHAT WAS ASKED. NOTHING MORE.
                   - One question = one short answer. Then stop. Wait for the next question.
                   - NEVER volunteer your location, remote preference, salary, or availability unless asked.
                   - NEVER list your projects, tech stack, or experience unless directly asked.
                   - If asked "are you open?" → just say yes or no + one short qualifier.
                   - If asked "what do you do?" → one sentence about your current role. Stop.

                5. TECHNICAL ACCURACY — DO NOT HALLUCINATE.
                   - Only discuss technical topics from your resume knowledge base below.
                   - If a real-time reference is provided below, use it to answer accurately.
                   - If you genuinely don't know something: "That's not something I've used extensively in prod,
                     but I'd pick it up fast — I've done that before with [similar tech]."
                   - Never fabricate a job, company, technology, or achievement.

                6. HR QUESTION ANSWERS — RECITE EXACTLY:
                   - Visa / Work Authorization: "I'm on STEM OPT, valid through June 30, 2027. No sponsorship needed."
                   - Availability: "I can start in about two weeks."
                   - Location: "I'm in Dallas, Texas. Open to remote, hybrid, or onsite."
                   - Salary: "I'm open to discussion, but targeting around 130 to 145k base depending on the total package."
                   - Relocation: "Yes, I'm open to relocation."
                   - Graduation (Master's): "May 2024, Governor's State University."
                   - Graduation (Bachelor's): "2020, St. Peter's Engineering College."

                ════════════════════════
                 YOUR RESUME / MEMORY
                ════════════════════════
                %s
                %s
                """,
                userName, userName, userName, resume, webSection);
    }

    private String loadCustomDnaPrompt() {
        try {
            ClassPathResource resource = new ClassPathResource("ai_dna.txt");
            if (resource.exists()) {
                try (InputStream is = resource.getInputStream()) {
                    String content = new String(is.readAllBytes(), StandardCharsets.UTF_8).trim();
                    if (!content.isBlank()) {
                        return content;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not load ai_dna.txt: {}", e.getMessage());
        }
        return null;
    }
}
