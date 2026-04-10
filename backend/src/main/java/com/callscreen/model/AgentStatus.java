package com.callscreen.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentStatus {
    private boolean armed;
    private int activeCalls;
    private int totalCallsToday;
    private int aiHandledToday;
    private Instant lastArmedAt;
    private Instant lastDisarmedAt;
    private List<CallEvent> recentCalls;
}
