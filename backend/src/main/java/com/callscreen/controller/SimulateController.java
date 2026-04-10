package com.callscreen.controller;

import com.callscreen.model.SimulateRequest;
import com.callscreen.service.ClaudeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SimulateController {

    private final ClaudeService claudeService;

    /**
     * SIMULATE tab proxy — sends message to Claude with resume context.
     * Keeps conversation history for multi-turn dialog.
     */
    @PostMapping("/simulate")
    public ResponseEntity<Map<String, String>> simulate(@RequestBody SimulateRequest request) {
        log.info("Simulate request: {}", request.getMessage());
        String response = claudeService.simulate(request);
        return ResponseEntity.ok(Map.of("response", response));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "AI Call Screener"));
    }
}
