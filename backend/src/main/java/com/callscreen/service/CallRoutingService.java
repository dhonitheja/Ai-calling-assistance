package com.callscreen.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class CallRoutingService {

    private static final String AI_MODE_KEY = "ai_mode";
    private static final String ARMED_AT_KEY = "ai_armed_at";
    private static final String DISARMED_AT_KEY = "ai_disarmed_at";
    private static final String CALL_COUNT_KEY = "calls:today:total";
    private static final String AI_CALL_COUNT_KEY = "calls:today:ai";

    private final StringRedisTemplate redis;

    public boolean isAiModeEnabled() {
        try {
            String value = redis.opsForValue().get(AI_MODE_KEY);
            return "true".equals(value);
        } catch (Exception e) {
            log.warn("Redis unavailable, defaulting to AI OFF: {}", e.getMessage());
            return false;
        }
    }

    public void arm() {
        redis.opsForValue().set(AI_MODE_KEY, "true");
        redis.opsForValue().set(ARMED_AT_KEY, Instant.now().toString());
        log.info("🤖 AI Agent ARMED at {}", Instant.now());
    }

    public void disarm() {
        redis.opsForValue().set(AI_MODE_KEY, "false");
        redis.opsForValue().set(DISARMED_AT_KEY, Instant.now().toString());
        log.info("📴 AI Agent DISARMED at {}", Instant.now());
    }

    public String getArmedAt() {
        return redis.opsForValue().get(ARMED_AT_KEY);
    }

    public String getDisarmedAt() {
        return redis.opsForValue().get(DISARMED_AT_KEY);
    }

    public void incrementTotalCalls() {
        redis.opsForValue().increment(CALL_COUNT_KEY);
    }

    public void incrementAiCalls() {
        redis.opsForValue().increment(AI_CALL_COUNT_KEY);
    }

    public int getTotalCallsToday() {
        String val = redis.opsForValue().get(CALL_COUNT_KEY);
        return val != null ? Integer.parseInt(val) : 0;
    }

    public int getAiCallsToday() {
        String val = redis.opsForValue().get(AI_CALL_COUNT_KEY);
        return val != null ? Integer.parseInt(val) : 0;
    }
}
