package com.callscreen.service;

import com.callscreen.model.SimulateRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.*;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * SelfTrainingService — after each call, ingest the Q&A transcript into Pinecone
 * so the AI's RAG context improves with every conversation.
 *
 * Flow:
 *  1. After call ends → RecordingService saves audio + transcript
 *  2. SelfTrainingService receives transcript
 *  3. Converts Q&A pairs into text chunks
 *  4. POSTs to voice-ai-agent /api/ingest (Next.js) which embedds + upserts to Pinecone
 *
 * This makes the AI progressively better at answering questions it has been asked before.
 */
@Slf4j
@Service
public class SelfTrainingService {

    @Value("${self.training.enabled:true}")
    private boolean enabled;

    @Value("${self.training.ingest-url:http://localhost:3000/api/ingest}")
    private String ingestUrl;

    @Value("${recordings.dir:./recordings}")
    private String recordingsDir;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Ingest a completed call transcript into the RAG knowledge base.
     * Called asynchronously after a call ends so it never blocks the main pipeline.
     */
    public void ingestCallTranscript(String callId, String caller,
                                      List<SimulateRequest.ConversationMessage> history) {
        if (!enabled || history == null || history.isEmpty()) return;

        Thread.ofVirtual().start(() -> {
            try {
                // Build chunks: each Q/A pair becomes one knowledge chunk
                ArrayNode chunks = mapper.createArrayNode();
                String currentQuestion = null;

                for (SimulateRequest.ConversationMessage msg : history) {
                    if ("user".equals(msg.getRole())) {
                        currentQuestion = msg.getContent();
                    } else if ("assistant".equals(msg.getRole()) && currentQuestion != null) {
                        String chunk = "Q: " + currentQuestion + "\nA: " + msg.getContent();
                        chunks.add(chunk);
                        currentQuestion = null;
                    }
                }

                if (chunks.isEmpty()) return;

                ObjectNode metadata = mapper.createObjectNode();
                metadata.put("source", "call_transcript");
                metadata.put("callId", callId);
                metadata.put("caller", caller != null ? caller : "unknown");
                metadata.put("timestamp", java.time.Instant.now().toString());

                ObjectNode body = mapper.createObjectNode();
                body.set("chunks", chunks);
                body.set("metadata", metadata);

                Request request = new Request.Builder()
                        .url(ingestUrl)
                        .post(RequestBody.create(mapper.writeValueAsBytes(body),
                                MediaType.parse("application/json")))
                        .build();

                try (Response response = httpClient.newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        log.info("Self-training: ingested {} Q/A pairs from call {}", chunks.size(), callId);
                    } else {
                        log.warn("Self-training ingest failed {}: {}", response.code(),
                                response.body() != null ? response.body().string() : "");
                    }
                }
            } catch (Exception e) {
                log.warn("Self-training ingest error: {}", e.getMessage());
            }
        });
    }
}
