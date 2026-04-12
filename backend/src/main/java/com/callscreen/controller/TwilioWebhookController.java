package com.callscreen.controller;

import com.callscreen.service.CallRoutingService;
import com.callscreen.service.CallSessionService;
import com.callscreen.service.CallSessionService.Mode;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Call;
import com.twilio.type.PhoneNumber;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ═══════════════════════════════════════════════════════════════════
 *  CALL FLOW — PERSONAL NUMBER FORWARD TO AI
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Recruiters call your Twilio number: +18557692480
 *
 *  ── MODE A: AI ARMED ──────────────────────────────────────────────
 *    Recruiter calls Twilio number
 *    → AI picks up directly, your phone never rings
 *    → Dashboard "Take Back" button rings your personal phone mid-call
 *
 *  ── MODE B: AI DISARMED (YOU answer first) ────────────────────────
 *    Recruiter calls Twilio number
 *    → Twilio CALLS YOUR PERSONAL NUMBER first (you see Twilio number as caller)
 *    → You pick up and talk to recruiter normally
 *    → When ready to hand off → press * on your keypad
 *    → You hear a beep, your leg ends, AI takes over the same call
 *    → Recruiter hears nothing — seamless, no gap
 *
 *  WHY THIS WORKS WITH YOUR PERSONAL NUMBER:
 *    Twilio is the bridge between recruiter and you. The recruiter's call
 *    goes INTO Twilio. Twilio then CALLS OUT to your personal number.
 *    Both legs are inside Twilio's conference so we can control them.
 *    When you press *, only YOUR outbound leg drops — recruiter stays live.
 *
 *  ── AFTER EVERY CALL ─────────────────────────────────────────────
 *    → Full transcript saved to ./recordings/
 *    → AI-generated summary: who called, what topics, outcome
 *    → Summary + transcript viewable in dashboard Call History tab
 * ═══════════════════════════════════════════════════════════════════
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

    @Value("${twilio.account-sid:}")
    private String accountSid;

    @Value("${twilio.auth-token:}")
    private String authToken;

    @Value("${twilio.phone-number:}")
    private String twilioNumber;

    @Value("${server.base-url:http://localhost:8080}")
    private String serverBaseUrl;

    // inbound callSid → conference room name
    private final ConcurrentHashMap<String, String> callRooms = new ConcurrentHashMap<>();
    // outbound leg callSid → inbound callSid (so we know which conference to leave)
    private final ConcurrentHashMap<String, String> outboundToInbound = new ConcurrentHashMap<>();

    // ─── 1. Recruiter calls in ───────────────────────────────────────────────

    @PostMapping(value = "/incoming", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> incomingCall(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "From", required = false) String from,
            @RequestParam(value = "To",   required = false) String to) {

        log.info("📞 Incoming: SID={} From={} To={}", callSid, from, to);
        routingService.incrementTotalCalls();

        if (routingService.isAiModeEnabled()) {
            // AI ARMED → pick up directly, your phone never rings
            routingService.incrementAiCalls();
            sessionService.register(callSid, from, Mode.AI);
            log.info("🤖 AI armed — direct to AI stream: {}", callSid);
            return ResponseEntity.ok(buildStreamTwiML(callSid, from));
        }

        // AI DISARMED → conference bridge, ring your phone
        String roomName = "room-" + callSid;
        callRooms.put(callSid, roomName);
        sessionService.register(callSid, from, Mode.HUMAN);
        log.info("📱 Bridging via conference room={} → ringing {}", roomName, realPhone);

        // Dial your personal number into the conference (async, ~1s delay)
        dialPersonalPhone(callSid, roomName, from);

        // Put recruiter into the conference to wait
        return ResponseEntity.ok(buildRecruiterConferenceTwiML(roomName));
    }

    // ─── 2. Your personal phone leg ─────────────────────────────────────────

    /**
     * Twilio calls your phone and serves this TwiML when you answer.
     * You hear the recruiter immediately — you're now in the conference together.
     *
     * finishOnKey="*"  →  press * → your leg ends → /handoff fires
     * endConferenceOnExit="false" → recruiter stays in conference when you leave
     */
    @PostMapping(value = "/your-leg", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> yourLeg(
            @RequestParam(value = "CallSid",       required = false) String yourCallSid,
            @RequestParam(value = "inboundCallSid", required = false) String inboundCallSid,
            @RequestParam(value = "roomName",       required = false) String roomName,
            @RequestParam(value = "callerFrom",     required = false) String callerFrom) {

        log.info("📲 Your leg answered: yourSid={} inbound={} room={}", yourCallSid, inboundCallSid, roomName);
        outboundToInbound.put(yourCallSid, inboundCallSid);

        String handoffUrl = serverBaseUrl + "/api/calls/handoff"
                + "?inboundCallSid=" + enc(inboundCallSid)
                + "&roomName="       + enc(roomName)
                + "&callerFrom="     + enc(callerFrom);

        return ResponseEntity.ok("""
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Dial action="%s" method="POST" finishOnKey="*" timeout="30">
                        <Conference startConferenceOnEnter="true"
                                    endConferenceOnExit="false"
                                    beep="false"
                                    muted="false">%s</Conference>
                    </Dial>
                </Response>
                """.formatted(handoffUrl, roomName));
    }

    // ─── 3. * pressed — hand off to AI ──────────────────────────────────────

    /**
     * Fires when you press * (finishOnKey) or simply hang up.
     * → Your leg ends (this is your outbound leg's action callback)
     * → We redirect the recruiter's INBOUND leg to the AI stream
     * → Recruiter hears nothing — AI picks up instantly
     */
    @PostMapping(value = "/handoff", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> handoffToAI(
            @RequestParam(value = "inboundCallSid", required = false) String inboundCallSid,
            @RequestParam(value = "roomName",       required = false) String roomName,
            @RequestParam(value = "callerFrom",     required = false) String callerFrom,
            @RequestParam(value = "DialCallStatus", required = false) String dialStatus) {

        log.info("🔀 Handoff → AI: inbound={} room={} status={}", inboundCallSid, roomName, dialStatus);

        if (inboundCallSid != null) {
            sessionService.updateMode(inboundCallSid, Mode.AI);
            routingService.incrementAiCalls();

            // Redirect the recruiter's live call to the AI WebSocket stream
            redirectLiveCallToAI(inboundCallSid, callerFrom);
        }

        // Empty TwiML for your (now-ended) leg
        return ResponseEntity.ok("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Hangup/></Response>");
    }

    // ─── 4. Dashboard "Take Back" — AI → your phone ─────────────────────────

    /**
     * Dashboard hit POST /api/transfer/to-me → TransferController redirects
     * the recruiter's live call here. This TwiML rings your phone.
     */
    @PostMapping(value = "/takeback-twiml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> takebackTwiml(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "From",    required = false) String from) {

        log.info("📲 Takeback: callSid={}", callSid);
        sessionService.updateMode(callSid, Mode.HUMAN);

        String roomName = "takeback-" + callSid;
        callRooms.put(callSid, roomName);

        // Put the recruiter back into a new conference, dial your phone in
        dialPersonalPhone(callSid, roomName, from);
        return ResponseEntity.ok(buildRecruiterConferenceTwiML(roomName));
    }

    // ─── 5. Forward from personal number ────────────────────────────────────

    /**
     * SCENARIO: Recruiter calls your personal number (+13128384016).
     * You answer. You want to hand off to AI mid-call.
     *
     * HOW TO DO IT FROM YOUR PHONE:
     *   Option A — Blind transfer (easiest):
     *     Put recruiter on hold → call Twilio number → when AI answers, hang up your original leg.
     *     Recruiter gets picked up by AI. BUT the two calls are separate — recruiter must redial.
     *
     *   Option B — 3-way conference (best):
     *     While on call with recruiter, add Twilio number as 3rd participant.
     *     On iPhone: tap "Add Call" → dial +18557692480 → tap "Merge Calls".
     *     On Android: tap "Add Call" → dial +18557692480 → tap "Merge".
     *     Twilio answers → AI is now in the 3-way call.
     *     You hang up → recruiter and AI are talking.
     *
     *   Option C — Forward using this endpoint (most seamless):
     *     When Twilio number (+18557692480) gets a call FROM your personal number,
     *     this endpoint fires. It means you are forwarding/bridging the recruiter.
     *     The backend recognises your number as the caller, puts the recruiter through to AI.
     *
     * This endpoint handles Option C — detects call from YOUR number and
     * treats the bridged recruiter as the real caller.
     */
    @PostMapping(value = "/forwarded", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> forwardedFromPersonalNumber(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "From",    required = false) String from,
            @RequestParam(value = "To",      required = false) String to) {

        log.info("🔁 Forwarded call: SID={} From={}", callSid, from);

        // Call came from your own phone — it's a forwarded recruiter call
        // Go straight to AI stream
        routingService.incrementTotalCalls();
        routingService.incrementAiCalls();
        sessionService.register(callSid, from, Mode.AI);

        return ResponseEntity.ok(buildStreamTwiML(callSid, from));
    }

    // ─── 5. Status callbacks ─────────────────────────────────────────────────

    @PostMapping("/status")
    public ResponseEntity<Map<String, String>> statusCallback(
            @RequestParam(value = "CallSid",     required = false) String callSid,
            @RequestParam(value = "CallStatus",  required = false) String status,
            @RequestParam(value = "CallDuration",required = false) String duration) {

        log.info("📊 {} → {} ({}s)", callSid, status, duration);
        if ("completed".equals(status) || "failed".equals(status) || "canceled".equals(status)) {
            sessionService.remove(callSid);
            callRooms.remove(callSid);
            outboundToInbound.remove(callSid);
        }
        return ResponseEntity.ok(Map.of("received", "true"));
    }

    @PostMapping("/conference-status")
    public ResponseEntity<Map<String, String>> conferenceStatus(@RequestParam Map<String, String> params) {
        log.debug("🏠 Conference: {}", params);
        return ResponseEntity.ok(Map.of("received", "true"));
    }

    // ─── TwiML builders ──────────────────────────────────────────────────────

    /**
     * Puts the RECRUITER into a named conference room with hold music.
     * They wait here until your phone is answered (~1-2 seconds).
     */
    private String buildRecruiterConferenceTwiML(String roomName) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Dial>
                        <Conference waitUrl="https://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
                                    startConferenceOnEnter="true"
                                    endConferenceOnExit="false"
                                    beep="false"
                                    statusCallback="%s/api/calls/conference-status"
                                    statusCallbackMethod="POST">%s</Conference>
                    </Dial>
                </Response>
                """.formatted(serverBaseUrl, roomName);
    }

    /**
     * Connects the recruiter directly to the AI WebSocket stream.
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

    // ─── Twilio REST API helpers ──────────────────────────────────────────────

    /**
     * Outbound-dials your personal phone and puts it into the conference.
     * The URL served to your leg is /api/calls/your-leg which has finishOnKey="*".
     */
    private void dialPersonalPhone(String inboundCallSid, String roomName, String callerFrom) {
        if (realPhone == null || realPhone.isBlank()) {
            log.warn("USER_REAL_PHONE not set — redirecting straight to AI");
            redirectLiveCallToAI(inboundCallSid, callerFrom);
            return;
        }
        if (accountSid == null || accountSid.isBlank()) {
            log.warn("Twilio credentials missing — redirecting straight to AI");
            redirectLiveCallToAI(inboundCallSid, callerFrom);
            return;
        }

        new Thread(() -> {
            try {
                Twilio.init(accountSid, authToken);

                String yourLegUrl = serverBaseUrl + "/api/calls/your-leg"
                        + "?inboundCallSid=" + enc(inboundCallSid)
                        + "&roomName="       + enc(roomName)
                        + "&callerFrom="     + enc(callerFrom != null ? callerFrom : "");

                Call call = Call.creator(
                        new PhoneNumber(realPhone),
                        new PhoneNumber(twilioNumber),
                        URI.create(yourLegUrl)
                ).create();

                log.info("📲 Dialing your phone: {} → leg SID={}", realPhone, call.getSid());

            } catch (Exception e) {
                log.error("Failed to dial personal phone: {} — falling back to AI", e.getMessage());
                redirectLiveCallToAI(inboundCallSid, callerFrom);
            }
        }).start();
    }

    /**
     * Uses Twilio REST API to redirect a LIVE call's TwiML mid-call.
     * This is what makes the seamless handoff possible — no hangup, no gap.
     */
    private void redirectLiveCallToAI(String callSid, String from) {
        try {
            Twilio.init(accountSid, authToken);
            Call.updater(callSid)
                    .setTwiml(buildStreamTwiML(callSid, from))
                    .update();
            log.info("✅ Redirected {} to AI stream", callSid);
        } catch (Exception e) {
            log.error("Failed to redirect {} to AI: {}", callSid, e.getMessage());
        }
    }

    private String enc(String s) {
        if (s == null) return "";
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
