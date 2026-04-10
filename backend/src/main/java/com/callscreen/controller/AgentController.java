package com.callscreen.controller;

import com.callscreen.model.AgentStatus;
import com.callscreen.service.CallRoutingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentController {

    private final CallRoutingService routingService;

    @GetMapping("/status")
    public ResponseEntity<AgentStatus> getStatus() {
        AgentStatus status = AgentStatus.builder()
                .armed(routingService.isAiModeEnabled())
                .activeCalls(0)
                .totalCallsToday(routingService.getTotalCallsToday())
                .aiHandledToday(routingService.getAiCallsToday())
                .lastArmedAt(parseInstant(routingService.getArmedAt()))
                .lastDisarmedAt(parseInstant(routingService.getDisarmedAt()))
                .recentCalls(List.of())
                .build();
        return ResponseEntity.ok(status);
    }

    @PostMapping("/arm")
    public ResponseEntity<Map<String, Object>> arm() {
        routingService.arm();
        log.info("Agent ARMED via API");
        return ResponseEntity.ok(Map.of(
                "armed", true,
                "message", "AI agent is now active. All incoming calls will be screened.",
                "timestamp", Instant.now().toString()
        ));
    }

    @PostMapping("/disarm")
    public ResponseEntity<Map<String, Object>> disarm() {
        routingService.disarm();
        log.info("Agent DISARMED via API");
        return ResponseEntity.ok(Map.of(
                "armed", false,
                "message", "AI agent disarmed. Calls will forward to your real number.",
                "timestamp", Instant.now().toString()
        ));
    }

    @PostMapping("/toggle")
    public ResponseEntity<Map<String, Object>> toggle() {
        if (routingService.isAiModeEnabled()) {
            routingService.disarm();
            return ResponseEntity.ok(Map.of("armed", false, "message", "Disarmed"));
        } else {
            routingService.arm();
            return ResponseEntity.ok(Map.of("armed", true, "message", "Armed"));
        }
    }

    private Instant parseInstant(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Instant.parse(s); } catch (Exception e) { return null; }
    }
}
