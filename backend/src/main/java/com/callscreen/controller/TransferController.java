package com.callscreen.controller;

import com.callscreen.service.CallSessionService;
import com.callscreen.service.CallSessionService.Mode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.Credentials;
import okhttp3.FormBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * TransferController — dashboard-triggered live call transfers.
 *
 * POST /api/transfer/to-ai    → redirect active call from your phone to the AI
 * POST /api/transfer/to-me    → redirect active call from AI back to your phone
 * GET  /api/transfer/status   → list of active calls + current mode
 *
 * Uses Twilio REST API to modify a live call mid-stream (no hangup needed).
 * The recruiter stays connected throughout — they just hear "one moment"
 * for ~1 second while the leg switches.
 */
@Slf4j
@RestController
@RequestMapping("/api/transfer")
@RequiredArgsConstructor
public class TransferController {

    private final CallSessionService sessionService;

    @Value("${twilio.account-sid:}")
    private String accountSid;

    @Value("${twilio.auth-token:}")
    private String authToken;

    @Value("${server.base-url:http://localhost:8080}")
    private String serverBaseUrl;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build();

    // ─── You → AI (dashboard button) ─────────────────────────────────────────

    /**
     * Redirect the current human call leg to the AI stream.
     * Equivalent to pressing * on your keypad, but triggered from the browser.
     */
    @PostMapping("/to-ai")
    public ResponseEntity<Map<String, Object>> transferToAI(
            @org.springframework.web.bind.annotation.RequestBody(required = false) Map<String, String> body) {

        String callSid = resolveCallSid(body);
        if (callSid == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "No active call found", "success", false));
        }

        try {
            redirectCallToTwiml(callSid, buildStreamTwiML(callSid));
            sessionService.updateMode(callSid, Mode.AI);

            log.info("✅ Transfer You→AI success: {}", callSid);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "callSid", callSid,
                    "mode", "AI",
                    "message", "Call transferred to AI. Recruiter stays connected."
            ));
        } catch (IOException e) {
            log.error("Transfer to AI failed: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ─── AI → You (dashboard button) ─────────────────────────────────────────

    /**
     * Redirect the AI-handled call back to your real phone.
     * AI drops off, your phone rings, recruiter waits on hold for ~2s.
     */
    @PostMapping("/to-me")
    public ResponseEntity<Map<String, Object>> transferToMe(
            @org.springframework.web.bind.annotation.RequestBody(required = false) Map<String, String> body) {

        String callSid = resolveCallSid(body);
        if (callSid == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "No active call found", "success", false));
        }

        try {
            String takebackTwimlUrl = serverBaseUrl + "/api/calls/takeback-twiml";
            redirectCall(callSid, takebackTwimlUrl);
            sessionService.updateMode(callSid, Mode.HUMAN);

            log.info("✅ Transfer AI→You success: {}", callSid);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "callSid", callSid,
                    "mode", "HUMAN",
                    "message", "Your phone is ringing. Pick up to take the call."
            ));
        } catch (IOException e) {
            log.error("Transfer to me failed: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ─── Active call status ───────────────────────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        var sessions = sessionService.getAll();
        List<Map<String, Object>> calls = new ArrayList<>();

        sessions.forEach((sid, s) -> calls.add(Map.of(
                "callSid", s.callSid(),
                "from", s.from() != null ? s.from() : "unknown",
                "mode", s.mode().name(),
                "durationSec", (System.currentTimeMillis() - s.startedAt()) / 1000
        )));

        return ResponseEntity.ok(Map.of(
                "activeCalls", calls.size(),
                "calls", calls
        ));
    }

    // ─── Twilio REST API call redirect ───────────────────────────────────────

    /**
     * Uses Twilio REST API to update a live call's TwiML URL mid-stream.
     * This is how we switch legs without hanging up.
     */
    private void redirectCall(String callSid, String twimlUrl) throws IOException {
        if (accountSid == null || accountSid.isBlank() || authToken == null || authToken.isBlank()) {
            throw new IOException("Twilio credentials not configured");
        }

        String url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Calls/" + callSid + ".json";

        FormBody formBody = new FormBody.Builder()
                .add("Url", twimlUrl)
                .add("Method", "POST")
                .build();

        String credential = Credentials.basic(accountSid, authToken);

        Request request = new Request.Builder()
                .url(url)
                .post(formBody)
                .addHeader("Authorization", credential)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            String respBody = response.body() != null ? response.body().string() : "";
            if (!response.isSuccessful()) {
                throw new IOException("Twilio redirect failed " + response.code() + ": " + respBody);
            }
            log.debug("Twilio redirect {} → {} : {}", callSid, twimlUrl, response.code());
        }
    }

    private void redirectCallToTwiml(String callSid, String twiml) throws IOException {
        if (accountSid == null || accountSid.isBlank() || authToken == null || authToken.isBlank()) {
            throw new IOException("Twilio credentials not configured");
        }

        String url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Calls/" + callSid + ".json";

        FormBody formBody = new FormBody.Builder()
                .add("Twiml", twiml)
                .build();

        Request request = new Request.Builder()
                .url(url)
                .post(formBody)
                .addHeader("Authorization", Credentials.basic(accountSid, authToken))
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            String respBody = response.body() != null ? response.body().string() : "";
            if (!response.isSuccessful()) {
                throw new IOException("Twilio redirect failed " + response.code() + ": " + respBody);
            }
            log.debug("Twilio redirected {} to inline AI stream TwiML: {}", callSid, response.code());
        }
    }

    private String buildStreamTwiML(String callSid) {
        String wsUrl = serverBaseUrl
                .replace("https://", "wss://")
                .replace("http://", "ws://") + "/api/calls/stream";
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Connect>
                        <Stream url="%s">
                            <Parameter name="callSid" value="%s"/>
                        </Stream>
                    </Connect>
                </Response>
                """.formatted(wsUrl, callSid);
    }

    private String resolveCallSid(Map<String, String> body) {
        // 1. Explicit callSid from request body
        if (body != null && body.containsKey("callSid") && !body.get("callSid").isBlank()) {
            return body.get("callSid");
        }
        // 2. Most recent active call
        return sessionService.getLatestCallSid();
    }
}
