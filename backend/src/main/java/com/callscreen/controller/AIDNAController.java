package com.callscreen.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.net.URL;
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
        String systemPrompt = (String) payload.get("systemPrompt");
        if (systemPrompt == null || systemPrompt.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "systemPrompt is required"));
        }

        try {
            Path dnaPath = resolveDnaPath();
            Files.writeString(dnaPath, systemPrompt, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            log.info("AI DNA deployed → {} ({} chars)", dnaPath, systemPrompt.length());
            return ResponseEntity.ok(Map.of(
                    "status", "deployed",
                    "path", dnaPath.toString(),
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
        // 1. Check for env override (useful in production)
        String envPath = System.getenv("AI_DNA_PATH");
        if (envPath != null && !envPath.isBlank()) {
            Path p = Paths.get(envPath);
            Files.createDirectories(p.getParent());
            return p;
        }

        // 2. Try classpath resource location (works during local dev with Maven)
        try {
            ClassPathResource res = new ClassPathResource("ai_dna.txt");
            if (res.exists()) {
                URL url = res.getURL();
                return Paths.get(url.toURI());
            }
        } catch (Exception ignored) {}

        // 3. Fallback: write next to the JAR
        String jarDir = new File(AIDNAController.class.getProtectionDomain()
                .getCodeSource().getLocation().toURI()).getParent();
        Path fallback = Paths.get(jarDir, "ai_dna.txt");
        log.info("AI DNA path resolved to fallback: {}", fallback);
        return fallback;
    }
}
