package com.callscreen.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CallEvent {
    private String callSid;
    private String from;
    private String to;
    private String status;          // initiated, ringing, in-progress, completed, routed-to-ai, routed-to-human
    private boolean aiHandled;
    private int durationSeconds;
    private Instant timestamp;
    private String summary;
}
