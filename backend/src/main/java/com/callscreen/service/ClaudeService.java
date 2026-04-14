package com.callscreen.service;

import com.callscreen.model.SimulateRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import okhttp3.ResponseBody;
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
 *  - IS the user. Never admits to being AI.
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
    private final RagService ragService;
    private final ObjectMapper mapper = new ObjectMapper();

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .build();

    private static final String CLAUDE_URL     = "https://api.anthropic.com/v1/messages";
    private static final String FIELD_CONTENT  = "content";
    private static final String FALLBACK_RETRY = "Sorry, I missed that — can you say that again?";

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
            // Run web search and RAG retrieval in parallel (both are best-effort, non-blocking)
            String webContext = null;
            if (webSearchService.isTechnicalQuestion(userMessage)) {
                webContext = webSearchService.searchForContext(userMessage);
                if (webContext != null) log.debug("Web context fetched for: {}", userMessage);
            }

            // RAG: retrieve past call Q/A pairs most similar to this question.
            // These are answers Teja (the AI) gave in previous calls — injecting them makes
            // the AI consistent: it converges on the same answer to the same question over time.
            String ragContext = ragService.retrieveContext(userMessage, 3);

            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            // 160 tokens: enough for a full technical answer in 2-3 spoken sentences,
            // but still short enough to prevent rambling monologues.
            // Phone speech at normal pace = ~130 words/min = 160 tokens ≈ 10-12 seconds.
            body.put("max_tokens", 160);
            body.put("system", buildSystemPrompt(webContext, ragContext)); // NOSONAR S1874 — Jackson put(String,String) is fine; SonarLint false positive

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
                ResponseBody responseBody = response.body();
                if (!response.isSuccessful()) {
                    String errBody = responseBody != null ? responseBody.string() : "no body";
                    log.error("Claude API error: {} — {}", response.code(), errBody);
                    return "Sorry, could you give me just a moment? Something is not connecting right.";
                }
                if (responseBody == null) {
                    log.error("Claude returned null response body");
                    return FALLBACK_RETRY;
                }
                JsonNode root = mapper.readTree(responseBody.string());
                JsonNode content = root.path(FIELD_CONTENT);
                if (!content.isArray() || content.isEmpty()) {
                    log.error("Claude response has no content: {}", root);
                    return FALLBACK_RETRY;
                }
                return content.get(0).path("text").asText();
            }
        } catch (IOException e) {
            log.error("Claude call failed: {}", e.getMessage());
            return FALLBACK_RETRY;
        }
    }

    // ─── System prompt builder ───────────────────────────────────────────────

    private String buildSystemPrompt(String webContext, String ragContext) {
        String customPrompt = loadCustomDnaPrompt();
        String resume = resumeService.getResumeAsText();

        StringBuilder prompt = new StringBuilder();

        if (customPrompt != null && !customPrompt.isBlank()) {
            prompt.append(customPrompt).append("\n\n=== KNOWLEDGE BASE ===\n").append(resume);
        } else {
            prompt.append(buildDefaultPrompt(resume, webContext));
        }

        // RAG: inject the most relevant past-call answers so the AI stays consistent.
        // These are exact Q/A pairs from previous calls — the AI learns its own best answers.
        if (ragContext != null && !ragContext.isBlank()) {
            prompt.append("""

                    \n\n=== PAST CALL MEMORY (how you answered similar questions before) ===
                    These are your own previous answers. Be consistent with them.
                    Do NOT copy them word for word — use them as reference for tone and content.
                    """);
            prompt.append(ragContext);
        }

        if (webContext != null && !webContext.isBlank() && customPrompt != null && !customPrompt.isBlank()) {
            prompt.append("\n\n=== REAL-TIME REFERENCE (use to answer technical question accurately) ===\n")
                  .append(webContext);
        }

        return prompt.toString();
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
                   - When you pick up, say only: "Hello?" or "Hey, this is %s." — then STOP and listen.
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
                   - Visa / Work Authorization: "I'm on a valid work visa. No sponsorship needed at this time."
                   - Availability: "I can start in about two weeks."
                   - Location: "I am open to remote, hybrid, or onsite opportunities."
                   - Salary / rate: "I am looking for a market-competitive rate."
                   - Relocation: "Yes, I'm open to relocation."
                   - Graduation: "I have a Master's degree in Computer Science."

                ════════════════════════
                 YOUR RESUME / MEMORY
                ════════════════════════
                %s
                %s
                """,
                userName, userName, userName, userName, resume, webSection);
    }

    /**
     * Loads the AI DNA prompt. Priority order:
     * 1. AI_DNA_PATH env var (production override written by AIDNAController)
     * 2. Next to the running JAR (written by AIDNAController at runtime)
     * 3. Classpath resource (bundled in the JAR at build time — the default)
     *
     * This mirrors AIDNAController.resolveDnaPath() so writes and reads use the same path.
     */
    private String loadCustomDnaPrompt() {
        // 1. Env-var override
        String envPath = System.getenv("AI_DNA_PATH");
        if (envPath != null && !envPath.isBlank()) {
            try {
                java.nio.file.Path p = java.nio.file.Paths.get(envPath);
                if (java.nio.file.Files.exists(p)) {
                    String content = java.nio.file.Files.readString(p, StandardCharsets.UTF_8).trim();
                    if (!content.isBlank()) return content;
                }
            } catch (Exception e) {
                log.warn("Could not read AI_DNA_PATH {}: {}", envPath, e.getMessage());
            }
        }

        // 2. Next to the JAR (written at runtime by AIDNAController)
        try {
            java.io.File jarFile = new java.io.File(ClaudeService.class.getProtectionDomain()
                    .getCodeSource().getLocation().toURI());
            java.nio.file.Path jarDnaPath = jarFile.toPath().getParent().resolve("ai_dna.txt");
            if (java.nio.file.Files.exists(jarDnaPath)) {
                String content = java.nio.file.Files.readString(jarDnaPath, StandardCharsets.UTF_8).trim();
                if (!content.isBlank()) return content;
            }
        } catch (Exception ignored) {}

        // 3. Classpath fallback (bundled default)
        try {
            ClassPathResource resource = new ClassPathResource("ai_dna.txt");
            if (resource.exists()) {
                try (InputStream is = resource.getInputStream()) {
                    String content = new String(is.readAllBytes(), StandardCharsets.UTF_8).trim();
                    if (!content.isBlank()) return content;
                }
            }
        } catch (Exception e) {
            log.warn("Could not load ai_dna.txt from classpath: {}", e.getMessage());
        }
        return null;
    }
}
