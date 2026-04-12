package com.callscreen.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import java.util.*;

/**
 * CallHistoryController — serves past call data to the dashboard.
 *
 * GET /api/calls/history          — list of all calls (newest first)
 * GET /api/calls/history/{id}     — full transcript + summary for one call
 *
 * Each call in the list contains:
 *   - id          : directory name (timestamp_caller)
 *   - caller      : phone number
 *   - timestamp   : when the call happened
 *   - turns       : number of conversation turns
 *   - summary     : AI-generated plain English summary
 *   - hasSummary  : whether summary.txt exists
 */
@Slf4j
@RestController
@RequestMapping("/api/calls")
public class CallHistoryController {

    @Value("${recordings.dir:./recordings}")
    private String recordingsDir;

    private final ObjectMapper mapper = new ObjectMapper();

    // ─── List all calls ──────────────────────────────────────────────────────

    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory() {
        Path baseDir = Paths.get(recordingsDir);
        if (!Files.exists(baseDir)) {
            return ResponseEntity.ok(List.of());
        }

        List<Map<String, Object>> calls = new ArrayList<>();

        try (var dirs = Files.list(baseDir)) {
            dirs.filter(Files::isDirectory)
                .sorted(Comparator.comparing(Path::getFileName).reversed()) // newest first
                .forEach(dir -> {
                    try {
                        Map<String, Object> entry = buildCallEntry(dir, false);
                        if (entry != null) calls.add(entry);
                    } catch (Exception e) {
                        log.warn("Could not read call dir {}: {}", dir, e.getMessage());
                    }
                });
        } catch (IOException e) {
            log.error("Failed to list recordings: {}", e.getMessage());
        }

        return ResponseEntity.ok(calls);
    }

    // ─── Single call detail ──────────────────────────────────────────────────

    @GetMapping("/history/{id}")
    public ResponseEntity<Map<String, Object>> getCallDetail(@PathVariable String id) {
        Path callDir = Paths.get(recordingsDir, id);
        if (!Files.exists(callDir) || !Files.isDirectory(callDir)) {
            return ResponseEntity.notFound().build();
        }

        try {
            Map<String, Object> entry = buildCallEntry(callDir, true);
            if (entry == null) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(entry);
        } catch (Exception e) {
            log.error("Failed to read call {}: {}", id, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    // ─── Audio download ──────────────────────────────────────────────────────

    @GetMapping("/audio/{id}")
    public ResponseEntity<Resource> getAudio(@PathVariable String id) {
        Path audioPath = Paths.get(recordingsDir, id, "audio.wav");
        if (!Files.exists(audioPath)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + id + ".wav\"")
                .header(HttpHeaders.CONTENT_TYPE, "audio/wav")
                .body(new FileSystemResource(audioPath));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Map<String, Object> buildCallEntry(Path dir, boolean includeFullTranscript) throws IOException {
        Path transcriptPath = dir.resolve("transcript.json");
        if (!Files.exists(transcriptPath)) return null;

        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("id", dir.getFileName().toString());

        // Parse transcript.json
        String transcriptJson = Files.readString(transcriptPath, StandardCharsets.UTF_8);
        try {
            ObjectNode transcript = (ObjectNode) mapper.readTree(transcriptJson);
            entry.put("caller",    transcript.path("caller").asText("unknown"));
            entry.put("timestamp", transcript.path("timestamp").asText(""));
            entry.put("callId",    transcript.path("callId").asText(""));
            entry.put("turns",     transcript.path("turns").asInt(0));

            if (includeFullTranscript) {
                entry.put("transcript", transcript.path("transcript"));
            }
        } catch (Exception e) {
            entry.put("caller", "unknown");
            entry.put("timestamp", dir.getFileName().toString().substring(0, 19).replace("_", " "));
            entry.put("turns", 0);
        }

        // Read summary if exists
        Path summaryPath = dir.resolve("summary.txt");
        if (Files.exists(summaryPath)) {
            String summary = Files.readString(summaryPath, StandardCharsets.UTF_8).trim();
            entry.put("summary", summary);
            entry.put("hasSummary", true);
        } else {
            entry.put("summary", "Summary not yet generated.");
            entry.put("hasSummary", false);
        }

        // Check if audio exists
        entry.put("hasAudio", Files.exists(dir.resolve("audio.wav")));

        return entry;
    }
}
