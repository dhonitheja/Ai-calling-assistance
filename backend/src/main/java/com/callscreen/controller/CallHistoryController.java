package com.callscreen.controller;

import com.callscreen.service.GcsStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.*;

/**
 * CallHistoryController — serves past call data from GCS to the dashboard.
 *
 * GET /api/calls/history          — list of all calls (newest first, max 48h old)
 * GET /api/calls/history/{id}     — full transcript + summary for one call
 * GET /api/calls/audio/{id}       — download audio.wav for a call
 *
 * GCS bucket has a 2-day lifecycle policy so only calls within 48 hours are returned.
 */
@Slf4j
@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
public class CallHistoryController {

    private static final String KEY_CALLER    = "caller";
    private static final String KEY_TIMESTAMP = "timestamp";
    private static final String KEY_TURNS     = "turns";

    private final GcsStorageService gcs;
    private final ObjectMapper mapper = new ObjectMapper();

    // ─── List all calls ──────────────────────────────────────────────────────

    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory() {
        List<String> dirs = gcs.listCallDirs();
        List<Map<String, Object>> calls = new ArrayList<>();

        for (String dir : dirs) {
            try {
                Map<String, Object> entry = buildCallEntry(dir, false);
                if (!entry.isEmpty()) calls.add(entry);
            } catch (IOException e) {
                log.warn("Could not read GCS call dir {}: {}", dir, e.getMessage());
            }
        }
        return ResponseEntity.ok(calls);
    }

    // ─── Single call detail ──────────────────────────────────────────────────

    @GetMapping("/history/{id}")
    public ResponseEntity<Map<String, Object>> getCallDetail(@PathVariable String id) {
        // Sanitize: directory names only contain word chars, +, -, _
        if (!id.matches("[\\w+\\-]+")) return ResponseEntity.badRequest().build();

        String transcript = gcs.readString(id, "transcript.json");
        if (transcript == null) return ResponseEntity.notFound().build();

        try {
            Map<String, Object> entry = buildCallEntry(id, true);
            if (entry.isEmpty()) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(entry);
        } catch (IOException e) {
            log.error("Failed to read GCS call {}: {}", id, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    // ─── Audio download ──────────────────────────────────────────────────────

    @GetMapping("/audio/{id}")
    public ResponseEntity<byte[]> getAudio(@PathVariable String id) {
        if (!id.matches("[\\w+\\-]+")) return ResponseEntity.badRequest().build();

        byte[] audio = gcs.readAudioOrNull(id);
        if (audio == null) return ResponseEntity.notFound().build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + id + ".wav\"")
                .contentType(MediaType.parseMediaType("audio/wav"))
                .body(audio);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Map<String, Object> buildCallEntry(String dir, boolean includeFullTranscript) throws IOException {
        String transcriptJson = gcs.readString(dir, "transcript.json");
        if (transcriptJson == null) return Collections.emptyMap();

        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("id", dir);

        try {
            ObjectNode transcript = (ObjectNode) mapper.readTree(transcriptJson);
            entry.put(KEY_CALLER,    transcript.path(KEY_CALLER).asText("unknown"));
            entry.put(KEY_TIMESTAMP, transcript.path(KEY_TIMESTAMP).asText(""));
            entry.put("callId",      transcript.path("callId").asText(""));
            entry.put(KEY_TURNS,     transcript.path(KEY_TURNS).asInt(0));

            if (includeFullTranscript) {
                entry.put("transcript", transcript.path("transcript"));
            }
        } catch (IOException e) {
            entry.put(KEY_CALLER,    "unknown");
            entry.put(KEY_TIMESTAMP, dir.length() >= 19 ? dir.substring(0, 19).replace("_", " ") : dir);
            entry.put(KEY_TURNS,     0);
        }

        String summary = gcs.readString(dir, "summary.txt");
        if (summary != null && !summary.isBlank()) {
            entry.put("summary",    summary.trim());
            entry.put("hasSummary", true);
        } else {
            entry.put("summary",    "Summary not yet generated.");
            entry.put("hasSummary", false);
        }

        entry.put("hasAudio", gcs.exists(dir, "audio.wav"));
        return entry;
    }
}
