package com.callscreen.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class CallRoutingService {

    private volatile boolean aiMode = false;
    private volatile String armedAt = null;
    private volatile String disarmedAt = null;
    
    private final AtomicInteger totalCalls = new AtomicInteger(0);
    private final AtomicInteger aiCalls = new AtomicInteger(0);

    public boolean isAiModeEnabled() {
        return aiMode;
    }

    public void arm() {
        aiMode = true;
        armedAt = Instant.now().toString();
        log.info("🤖 AI Agent ARMED at {}", Instant.now());
    }

    public void disarm() {
        aiMode = false;
        disarmedAt = Instant.now().toString();
        log.info("📴 AI Agent DISARMED at {}", Instant.now());
    }

    public String getArmedAt() {
        return armedAt;
    }

    public String getDisarmedAt() {
        return disarmedAt;
    }

    public void incrementTotalCalls() {
        totalCalls.incrementAndGet();
    }

    public void incrementAiCalls() {
        aiCalls.incrementAndGet();
    }

    public int getTotalCallsToday() {
        return totalCalls.get();
    }

    public int getAiCallsToday() {
        return aiCalls.get();
    }
}
