package com.callscreen.controller;

import com.callscreen.service.ResumeService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/resume")
@RequiredArgsConstructor
public class ResumeController {

    private static final String KEY_STATUS   = "status";
    private static final String KEY_FILENAME = "filename";
    private static final String KEY_ERROR    = "error";

    private final ResumeService resumeService;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${resume.dir:}")
    private String resumeDir;

    /** Returns current resume JSON — used by the Knowledge Base tab. */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getResume() {
        return ResponseEntity.ok(resumeService.getResumeJson());
    }

    /**
     * Returns resume as the formatted plain-text block the AI actually uses.
     * Useful for debugging exactly what context Claude sees in its system prompt.
     */
    @GetMapping(value = "/formatted", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getResumeFormatted() {
        return ResponseEntity.ok(resumeService.getResumeAsText());
    }

    /**
     * List all runtime-uploaded resume files.
     * GET /api/resume/list
     */
    @GetMapping("/list")
    public ResponseEntity<List<Map<String, String>>> listResumes() {
        List<Map<String, String>> files = new ArrayList<>();
        Path dir = resolveResumeDir();
        if (dir == null || !Files.exists(dir)) return ResponseEntity.ok(files);

        try (var stream = Files.list(dir)) {
            stream.filter(p -> p.getFileName().toString().endsWith(".json"))
                  .sorted()
                  .forEach(p -> files.add(Map.of(
                      KEY_FILENAME, p.getFileName().toString(),
                      "size", String.valueOf(p.toFile().length())
                  )));
        } catch (Exception e) {
            log.warn("Could not list resume dir: {}", e.getMessage());
        }
        return ResponseEntity.ok(files);
    }

    /**
     * Upload a new resume JSON file.
     * POST /api/resume/upload  (multipart form: file=<resume.json>)
     *
     * The file must be valid JSON. It is saved to the resume directory and
     * the cache is invalidated so the AI picks it up on the next call.
     * No redeploy needed.
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadResume(@RequestParam("file") MultipartFile file) {
        String originalName = file.getOriginalFilename();
        if (originalName == null || !originalName.endsWith(".json")) {
            return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "File must be a .json file"));
        }
        if (file.getSize() > 500_000) { // 500KB limit — resume should never be this large
            return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "File too large (max 500KB)"));
        }

        try {
            byte[] bytes = file.getBytes();
            String content = new String(bytes, StandardCharsets.UTF_8);
            JsonNode parsed = parseJson(content);
            if (parsed == null) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Invalid JSON content"));
            }

            // Sanitize filename — only alphanumeric, underscore, hyphen
            String safeName = originalName.replaceAll("[^a-zA-Z0-9_\\-.]", "_");
            if (!safeName.startsWith("resume")) {
                safeName = "resume_" + safeName;
            }

            Path dir = resolveResumeDir();
            if (dir == null) {
                return ResponseEntity.internalServerError()
                        .body(Map.of(KEY_ERROR, "Resume directory not configured. Set RESUME_DIR env var."));
            }
            Files.createDirectories(dir);
            Path dest = dir.resolve(safeName);
            Files.writeString(dest, content, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            resumeService.invalidateCache();
            log.info("Resume uploaded: {} ({} bytes, {} fields)", safeName, bytes.length, parsed.size());

            return ResponseEntity.ok(Map.of(
                KEY_STATUS, "uploaded",
                KEY_FILENAME, safeName,
                "fields", String.valueOf(parsed.size())
            ));
        } catch (Exception e) {
            log.error("Resume upload failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(KEY_ERROR, e.getMessage()));
        }
    }

    /**
     * Delete a runtime-uploaded resume file.
     * DELETE /api/resume/{filename}
     * Only deletes files in the runtime resume dir — cannot delete classpath bundled resumes.
     */
    @DeleteMapping("/{filename}")
    public ResponseEntity<Map<String, String>> deleteResume(@PathVariable String filename) {
        // Prevent path traversal
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Invalid filename"));
        }
        Path dir = resolveResumeDir();
        if (dir == null) return ResponseEntity.notFound().build();

        Path target = dir.resolve(filename);
        if (!Files.exists(target)) return ResponseEntity.notFound().build();

        try {
            Files.delete(target);
            resumeService.invalidateCache();
            log.info("Resume deleted: {}", filename);
            return ResponseEntity.ok(Map.of(KEY_STATUS, "deleted", KEY_FILENAME, filename));
        } catch (Exception e) {
            log.error("Resume delete failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(KEY_ERROR, e.getMessage()));
        }
    }

    /** Force-clears the in-memory resume cache. Next AI call will reload all files. */
    @PostMapping("/reload")
    public ResponseEntity<Map<String, String>> reload() {
        resumeService.invalidateCache();
        log.info("Resume cache invalidated — will reload on next AI call");
        return ResponseEntity.ok(Map.of(KEY_STATUS, "reloaded"));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Returns parsed JsonNode or null if content is not valid JSON. */
    private JsonNode parseJson(String content) {
        try {
            return mapper.readTree(content);
        } catch (Exception e) {
            log.warn("JSON parse failed: {}", e.getMessage());
            return null;
        }
    }

    private Path resolveResumeDir() {
        if (resumeDir != null && !resumeDir.isBlank()) {
            return Paths.get(resumeDir);
        }
        // Default: next to the running JAR
        try {
            File jarFile = new File(ResumeController.class.getProtectionDomain()
                    .getCodeSource().getLocation().toURI());
            return jarFile.toPath().getParent();
        } catch (Exception e) {
            return null;
        }
    }
}
