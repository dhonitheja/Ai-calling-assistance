package com.callscreen.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * RagService — retrieves past call Q/A context from Pinecone via the
 * voice-ai-agent Next.js /api/query endpoint.
 *
 * Before every Claude call, we ask Pinecone: "what did Teja say when asked
 * something similar before?" and inject those exact answers into the prompt.
 * This is what makes the AI improve with every call — it learns from its own
 * past responses and converges on consistent, accurate answers over time.
 *
 * If Pinecone is unreachable or returns nothing, ClaudeService falls back
 * to the static resume + ai_dna.txt — no degradation in call quality.
 */
@Slf4j
@Service
public class RagService {

    @Value("${self.training.ingest-url:http://localhost:3000/api/ingest}")
    private String ingestUrl;

    private final ObjectMapper mapper = new ObjectMapper();

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            // Short timeouts — RAG is a best-effort enrichment, not blocking
            .connectTimeout(3, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build();

    /**
     * Query Pinecone for past Q/A pairs most similar to the current question.
     *
     * @param question  the caller's current question
     * @param topK      max number of past answers to retrieve (default 3)
     * @return formatted string of past Q/A context, or null if unavailable
     */
    public String retrieveContext(String question, int topK) {
        String queryUrl = ingestUrl.replace("/api/ingest", "/api/query");

        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("question", question);
            body.put("topK", topK);

            Request request = new Request.Builder()
                    .url(queryUrl)
                    .post(RequestBody.create(mapper.writeValueAsBytes(body),
                            MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) return null;
                ResponseBody rb = response.body();
                if (rb == null) return null;

                JsonNode root = mapper.readTree(rb.string());
                JsonNode chunks = root.path("chunks");
                if (!chunks.isArray() || chunks.isEmpty()) return null;

                List<String> results = new ArrayList<>();
                for (JsonNode chunk : chunks) {
                    String text = chunk.asText("").trim();
                    if (!text.isBlank()) results.add(text);
                }

                if (results.isEmpty()) return null;

                log.info("RAG: retrieved {} past Q/A chunks for: [{}]", results.size(), question);
                return String.join("\n\n---\n\n", results);
            }
        } catch (Exception e) {
            // RAG failure is non-fatal — log at debug so it doesn't spam INFO logs on every call
            log.debug("RAG query failed (non-fatal): {}", e.getMessage());
            return null;
        }
    }
}
