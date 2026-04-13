package com.callscreen.controller;

import com.callscreen.service.ResumeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/resume")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;

    /** Returns current resume JSON — used by the Knowledge Base tab. */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getResume() {
        return ResponseEntity.ok(resumeService.getResumeJson());
    }

    /**
     * Returns resume as the formatted plain-text block the AI actually uses.
     * Useful for debugging what the AI sees in its system prompt.
     */
    @GetMapping(value = "/formatted", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getResumeFormatted() {
        return ResponseEntity.ok(resumeService.getResumeAsText());
    }

    /** Force-clears the in-memory resume cache. Next call will reload from disk. */
    @PostMapping("/reload")
    public ResponseEntity<Map<String, String>> reload() {
        resumeService.invalidateCache();
        log.info("Resume cache invalidated — will reload on next AI call");
        return ResponseEntity.ok(Map.of("status", "reloaded"));
    }
}
