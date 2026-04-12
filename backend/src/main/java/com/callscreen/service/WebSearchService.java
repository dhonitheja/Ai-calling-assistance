package com.callscreen.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * WebSearchService — fetches real-time answers for technical questions.
 *
 * Uses Brave Search API (free tier: 2000 queries/month).
 * Fallback: returns null so ClaudeService uses resume-only context.
 *
 * Configure via: BRAVE_SEARCH_API_KEY env variable.
 */
@Slf4j
@Service
public class WebSearchService {

    @Value("${brave.search.api-key:}")
    private String braveApiKey;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Searches the web for a technical query and returns a concise snippet.
     * Returns null if search is disabled or fails.
     */
    public String searchForContext(String query) {
        if (braveApiKey == null || braveApiKey.isBlank()) {
            return null;
        }

        try {
            String encodedQuery = java.net.URLEncoder.encode(query, "UTF-8");
            String url = "https://api.search.brave.com/res/v1/web/search?q=" + encodedQuery + "&count=3&text_decorations=false";

            Request request = new Request.Builder()
                    .url(url)
                    .addHeader("Accept", "application/json")
                    .addHeader("Accept-Encoding", "gzip")
                    .addHeader("X-Subscription-Token", braveApiKey)
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.warn("Brave Search returned {}: {}", response.code(), response.message());
                    return null;
                }

                String body = response.body().string();
                JsonNode root = mapper.readTree(body);
                JsonNode results = root.path("web").path("results");

                if (!results.isArray() || results.isEmpty()) {
                    return null;
                }

                StringBuilder sb = new StringBuilder();
                int count = 0;
                for (JsonNode result : results) {
                    String title = result.path("title").asText("");
                    String snippet = result.path("description").asText("");
                    if (!snippet.isBlank()) {
                        sb.append("• ").append(title).append(": ").append(snippet).append("\n");
                        if (++count >= 3) break;
                    }
                }

                String context = sb.toString().trim();
                log.debug("Web search context for '{}': {} chars", query, context.length());
                return context.isBlank() ? null : context;
            }

        } catch (Exception e) {
            log.warn("Web search failed for '{}': {}", query, e.getMessage());
            return null;
        }
    }

    /**
     * Determines if a question likely needs real-time/technical web context.
     * Avoids burning search quota on simple HR questions.
     */
    public boolean isTechnicalQuestion(String question) {
        if (question == null) return false;
        String q = question.toLowerCase();
        return q.contains("how") || q.contains("what is") || q.contains("explain") ||
               q.contains("difference between") || q.contains("vs ") ||
               q.contains("why") || q.contains("when to use") ||
               q.contains("architecture") || q.contains("design") ||
               q.contains("algorithm") || q.contains("complexity") ||
               q.contains("java") || q.contains("spring") || q.contains("kafka") ||
               q.contains("kubernetes") || q.contains("docker") ||
               q.contains("react") || q.contains("typescript") ||
               q.contains("python") || q.contains("llm") || q.contains("rag") ||
               q.contains("vector") || q.contains("embedding") ||
               q.contains("microservice") || q.contains("api") ||
               q.contains("database") || q.contains("sql") || q.contains("nosql") ||
               q.contains("cloud") || q.contains("aws") || q.contains("gcp") ||
               q.contains("redis") || q.contains("postgres") || q.contains("mongodb");
    }
}
