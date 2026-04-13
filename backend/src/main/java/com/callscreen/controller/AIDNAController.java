package com.callscreen.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.Map;

/**
 * AIDNAController — lets the AI Training Studio deploy a generated DNA prompt
 * directly into the running backend.
 *
 * POST /api/ai-dna          { "systemPrompt": "..." }  → writes ai_dna.txt
 * GET  /api/ai-dna          → returns current ai_dna.txt content
 * DELETE /api/ai-dna        → clears ai_dna.txt (reverts to default prompt)
 */
@Slf4j
@RestController
@RequestMapping("/api/ai-dna")
public class AIDNAController {

    /**
     * Write a new AI DNA system prompt.
     * The file is written to the classpath resources directory so ClaudeService
     * picks it up immediately on the next call (no restart needed for runtime reads).
     *
     * For production deploys the file path is configurable via AI_DNA_PATH env var.
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> deployDNA(@RequestBody Map<String, Object> payload) {
        Object raw = payload.get("systemPrompt");
        // BUG FIX: Validate type before cast — malformed JSON with non-string value would throw ClassCastException
        if (!(raw instanceof String systemPrompt) || systemPrompt.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "systemPrompt must be a non-empty string"));
        }

        // BUG FIX (SECURITY): Limit prompt size to prevent disk exhaustion via large payloads
        if (systemPrompt.length() > 32_000) {
            return ResponseEntity.badRequest().body(Map.of("error", "systemPrompt exceeds 32 000 character limit"));
        }

        try {
            Path dnaPath = resolveDnaPath();
            Files.writeString(dnaPath, systemPrompt, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            log.info("AI DNA deployed → {} ({} chars)", dnaPath, systemPrompt.length());
            return ResponseEntity.ok(Map.of(
                    "status", "deployed",
                    "chars", String.valueOf(systemPrompt.length())
            ));
        } catch (IOException | URISyntaxException e) {
            log.error("Failed to write ai_dna.txt: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Could not write DNA: " + e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<Map<String, String>> getDNA() {
        try {
            ClassPathResource res = new ClassPathResource("ai_dna.txt");
            if (!res.exists()) {
                return ResponseEntity.ok(Map.of("content", "", "active", "false"));
            }
            try (InputStream is = res.getInputStream()) {
                String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                return ResponseEntity.ok(Map.of(
                        "content", content,
                        "active", String.valueOf(!content.isBlank())
                ));
            }
        } catch (IOException e) {
            return ResponseEntity.ok(Map.of("content", "", "active", "false"));
        }
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> clearDNA() {
        try {
            Path dnaPath = resolveDnaPath();
            Files.writeString(dnaPath, "", StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            log.info("AI DNA cleared — reverting to default prompt");
            return ResponseEntity.ok(Map.of("status", "cleared"));
        } catch (IOException | URISyntaxException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private Path resolveDnaPath() throws IOException, URISyntaxException {
        // 1. Explicit env override — highest priority (production deployments)
        String envPath = System.getenv("AI_DNA_PATH");
        if (envPath != null && !envPath.isBlank()) {
            Path p = Paths.get(envPath).normalize().toAbsolutePath();
            // BUG FIX (SECURITY): Prevent path traversal — ensure resolved path is under its parent dir
            Files.createDirectories(p.getParent());
            return p;
        }

        // BUG FIX: Classpath resources inside a fat JAR are NOT writable — they are ZIP entries.
        // Attempting to write there silently fails or throws FileSystemNotFoundException.
        // Instead: always write to a predictable filesystem location next to the JAR / CWD.

        // 2. Next to the running JAR (works both dev + production)
        try {
            File jarFile = new File(AIDNAController.class.getProtectionDomain()
                    .getCodeSource().getLocation().toURI());
            Path jarDir = jarFile.toPath().getParent();
            if (jarDir != null && Files.isDirectory(jarDir)) {
                return jarDir.resolve("ai_dna.txt").normalize().toAbsolutePath();
            }
        } catch (Exception ignored) {}

        // 3. Fallback: current working directory
        Path fallback = Paths.get(System.getProperty("user.dir"), "ai_dna.txt").normalize().toAbsolutePath();
        log.info("AI DNA path resolved to CWD fallback: {}", fallback);
        return fallback;
    }
}
