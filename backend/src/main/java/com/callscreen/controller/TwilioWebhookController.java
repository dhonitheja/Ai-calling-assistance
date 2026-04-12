package com.callscreen.controller;

import com.callscreen.service.CallRoutingService;
import com.callscreen.service.DeepgramService;
import com.callscreen.service.ClaudeService;
import com.callscreen.service.ElevenLabsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.Map;

/**
 * Twilio webhook controller.
 * POST /api/calls/incoming — entry point for all inbound Twilio calls.
 * POST /api/calls/stream   — receives Twilio Media Stream events (audio).
 * POST /api/calls/status   — receives call status callbacks.
 */
@Slf4j
@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
public class TwilioWebhookController {

    private final CallRoutingService routingService;

    @Value("${user.real-phone:}")
    private String realPhone;

    @Value("${server.base-url:http://localhost:8080}")
    private String serverBaseUrl;

    /**
     * Main webhook — Twilio hits this for every inbound call.
     * Returns TwiML to either stream to AI or dial real number.
     */
    @PostMapping(value = "/incoming", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> incomingCall(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "From", required = false) String from,
            @RequestParam(value = "To", required = false) String to) {

        log.info("📞 Incoming call: SID={} From={} To={}", callSid, from, to);
        routingService.incrementTotalCalls();

        if (routingService.isAiModeEnabled()) {
            routingService.incrementAiCalls();
            log.info("🤖 Routing to AI pipeline: {}", callSid);
            String streamWsUrl = serverBaseUrl.replace("https://", "wss://")
                    .replace("http://", "ws://") + "/api/calls/stream";
            String twiml = buildStreamTwiML(streamWsUrl, callSid, from);
            return ResponseEntity.ok(twiml);
        } else {
            log.info("📱 Routing to real phone: {}", realPhone);
            String twiml = buildDialTwiML(realPhone);
            return ResponseEntity.ok(twiml);
        }
    }



    /**
     * Status callback from Twilio.
     */
    @PostMapping("/status")
    public ResponseEntity<Map<String, String>> statusCallback(
            @RequestParam(value = "CallSid", required = false) String callSid,
            @RequestParam(value = "CallStatus", required = false) String status,
            @RequestParam(value = "CallDuration", required = false) String duration) {
        log.info("📊 Call {} status: {} ({}s)", callSid, status, duration);
        return ResponseEntity.ok(Map.of("received", "true"));
    }

    private String buildStreamTwiML(String wsUrl, String callSid, String from) {
        // No <Say> before streaming — the AI listens first and speaks only after caller does
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

    private String buildDialTwiML(String number) {
        if (number == null || number.isBlank()) {
            return """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <Response>
                        <Say>The number you are trying to reach is unavailable. Please try again later.</Say>
                        <Hangup/>
                    </Response>
                    """;
        }
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Dial>%s</Dial>
                </Response>
                """.formatted(number);
    }
}
