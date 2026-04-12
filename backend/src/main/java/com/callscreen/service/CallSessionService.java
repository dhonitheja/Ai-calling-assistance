package com.callscreen.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks every live call so we can redirect them mid-stream via Twilio REST API.
 *
 * Stored per CallSid:
 *   - from        : caller's phone number
 *   - mode        : "ai" | "human"  (who is currently on the call)
 *   - startedAt   : epoch millis
 */
@Slf4j
@Service
public class CallSessionService {

    public enum Mode { AI, HUMAN }

    public record CallSession(String callSid, String from, Mode mode, long startedAt) {}

    private final ConcurrentHashMap<String, CallSession> sessions = new ConcurrentHashMap<>();

    public void register(String callSid, String from, Mode mode) {
        sessions.put(callSid, new CallSession(callSid, from, mode, Instant.now().toEpochMilli()));
        log.info("📋 Call registered: {} from={} mode={}", callSid, from, mode);
    }

    public void updateMode(String callSid, Mode mode) {
        sessions.computeIfPresent(callSid, (k, s) ->
                new CallSession(s.callSid(), s.from(), mode, s.startedAt()));
        log.info("🔄 Call {} mode → {}", callSid, mode);
    }

    public void remove(String callSid) {
        sessions.remove(callSid);
        log.info("🗑️ Call session removed: {}", callSid);
    }

    public CallSession get(String callSid) {
        return sessions.get(callSid);
    }

    /** Returns the most recently registered active call SID, or null. */
    public String getLatestCallSid() {
        return sessions.values().stream()
                .max(java.util.Comparator.comparingLong(CallSession::startedAt))
                .map(CallSession::callSid)
                .orElse(null);
    }

    public Map<String, CallSession> getAll() {
        return Collections.unmodifiableMap(sessions);
    }

    public boolean hasActiveCalls() {
        return !sessions.isEmpty();
    }
}
