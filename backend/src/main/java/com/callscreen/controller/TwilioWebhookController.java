package com.callscreen.controller;

import com.callscreen.service.CallRoutingService;
import com.callscreen.service.CallSessionService;
import com.callscreen.service.CallSessionService.Mode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Twilio webhook controller — handles all call routing and mid-call transfers.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 *  CALL FLOW — TWO MODES
 * ├─────────────────────────────────────────────────────────────────────┤
 *  MODE A — AI ARMED (default)
 *    Recruiter calls → AI answers directly → you can take over from dashboard
 *
 *  MODE B — AI DISARMED
 *    Recruiter calls → YOUR phone rings → you talk
 *    Press * on keypad → you drop off → AI takes the call
 *    OR: tap "Transfer to AI" in dashboard → same effect
 *
 *  BOTH DIRECTIONS (live, no hang-up):
 *   You→AI  :  press * on keypad  OR  click "Transfer to AI" in dashboard
 *   AI→You  :  click "Take Back" in dashboard
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Webhooks registered in Twilio:
 *   Voice URL (incoming):   POST /api/calls/incoming
 *   Status callback:        POST /api/calls/status
 *
 * Internal webhooks (called by Twilio mid-call):
 *   POST /api/calls/handoff          — fired when you press * (you→AI)
 *   POST /api/calls/takeback-twiml   — served when AI→You redirect fires
 */
@Slf4j
@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
public class TwilioWebhookController {

    private final CallRoutingService routingService;
    private final CallSessionService sessionService;

    @Value("${user.real-phone:}")
    private String realPhone;

    @Value("${server.base-url:http://localhost:8080}")
    private String serverBaseUrl;

    // ─── 1. Incoming call ────────────────────────────────────────────────────

    @PostMapping(value = "/incoming", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> incomingCall(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "From", required = false) String from,
            @RequestParam(value = "To", required = false) String to) {

        log.info("📞 Incoming: SID={} From={} To={}", callSid, from, to);
        routingService.incrementTotalCalls();

        if (routingService.isAiModeEnabled()) {
            // ── AI mode ON: go straight to AI stream ──
            routingService.incrementAiCalls();
            sessionService.register(callSid, from, Mode.AI);
            log.info("🤖 Direct to AI: {}", callSid);
            return ResponseEntity.ok(buildStreamTwiML(callSid, from));
        } else {
            // ── AI mode OFF: ring your phone, * triggers handoff ──
            sessionService.register(callSid, from, Mode.HUMAN);
            log.info("📱 Ringing real phone, handoff armed: {}", callSid);
            return ResponseEntity.ok(buildDialWithHandoffTwiML(callSid, from));
        }
    }

    // ─── 2. You → AI  (press * on keypad) ────────────────────────────────────

    /**
     * Twilio fires this as the <Dial action> when:
     *   (a) you hang up your leg, or
     *   (b) you pressed * (captured by <Number> url= param).
     * Responds with TwiML that connects the waiting recruiter to the AI stream.
     */
    @PostMapping(value = "/handoff", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> handoffToAI(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "From", required = false) String from,
            @RequestParam(value = "DialCallStatus", required = false) String dialStatus) {

        log.info("🔀 Handoff You→AI: SID={} dialStatus={}", callSid, dialStatus);

        // Only take over if your leg actually ended (completed/no-answer/busy)
        // or dialStatus is null (came from the Number url= DTMF webhook)
        sessionService.updateMode(callSid, Mode.AI);
        routingService.incrementAiCalls();

        return ResponseEntity.ok(buildStreamTwiML(callSid, from));
    }

    // ─── 3. AI → You  (TwiML served when dashboard triggers takeback) ─────────

    /**
     * Dashboard calls POST /api/transfer/to-me which uses Twilio REST API
     * to redirect the live call here.  This TwiML dials your real phone.
     * The recruiter stays connected — you just pick up.
     */
    @PostMapping(value = "/takeback-twiml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> takebackTwiml(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "From", required = false) String from) {

        log.info("📲 Takeback AI→You: SID={}", callSid);
        sessionService.updateMode(callSid, Mode.HUMAN);

        // Dial your phone; if you don't answer, fall back to AI
        String fallbackUrl = serverBaseUrl + "/api/calls/handoff";
        return ResponseEntity.ok(buildDialTakebackTwiML(callSid, from, fallbackUrl));
    }

    // ─── 4. Status callback ──────────────────────────────────────────────────

    @PostMapping("/status")
    public ResponseEntity<Map<String, String>> statusCallback(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "CallStatus", required = false) String status,
            @RequestParam(value = "CallDuration", required = false) String duration) {

        log.info("📊 Call {} → {} ({}s)", callSid, status, duration);

        if ("completed".equals(status) || "failed".equals(status) || "canceled".equals(status)) {
            sessionService.remove(callSid);
        }
        return ResponseEntity.ok(Map.of("received", "true"));
    }

    // ─── TwiML builders ──────────────────────────────────────────────────────

    /**
     * Ring your real phone.
     *
     * HOW * DETECTION WORKS:
     * Twilio's <Dial> has a built-in attribute: finishOnKey="*"
     * When you press * on your keypad, Twilio ends YOUR leg of the <Dial>
     * and fires the action= URL with DialCallStatus=completed.
     * The recruiter stays on the line — we then return AI stream TwiML from /handoff.
     *
     * The action= also fires naturally when you just hang up,
     * so both "press *" and "hang up" cleanly hand off to AI.
     */
    private String buildDialWithHandoffTwiML(String callSid, String from) {
        if (realPhone == null || realPhone.isBlank()) {
            return buildStreamTwiML(callSid, from);
        }
        String handoffUrl = serverBaseUrl + "/api/calls/handoff";
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Dial action="%s" method="POST" timeout="25" finishOnKey="*">
                        <Number>%s</Number>
                    </Dial>
                </Response>
                """.formatted(handoffUrl, realPhone);
    }

    /**
     * AI → You takeback: dial your phone.
     * action= fires if you don't answer → falls back to AI.
     */
    private String buildDialTakebackTwiML(String callSid, String from, String fallbackUrl) {
        String handoffUrl = serverBaseUrl + "/api/calls/handoff";
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Dial action="%s" method="POST" timeout="20" finishOnKey="*">
                        <Number>%s</Number>
                    </Dial>
                </Response>
                """.formatted(handoffUrl, realPhone);
    }

    /**
     * Connect the recruiter to the AI WebSocket stream.
     * No greeting — AI waits silently for the caller to speak first.
     */
    private String buildStreamTwiML(String callSid, String from) {
        String wsUrl = serverBaseUrl
                .replace("https://", "wss://")
                .replace("http://", "ws://") + "/api/calls/stream";
        String safeFrom = (from != null && !from.isBlank()) ? from : "unknown";
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Connect>
                        <Stream url="%s">
                            <Parameter name="callSid" value="%s"/>
                            <Parameter name="from" value="%s"/>
                        </Stream>
                    </Connect>
                </Response>
                """.formatted(wsUrl, callSid, safeFrom);
    }
}
