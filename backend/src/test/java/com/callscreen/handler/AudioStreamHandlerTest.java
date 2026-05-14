package com.callscreen.handler;

import com.callscreen.service.ClaudeService;
import com.callscreen.service.DeepgramService;
import com.callscreen.service.ElevenLabsService;
import com.callscreen.service.RecordingService;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AudioStreamHandlerTest {

    @Test
    void connectionStillOpensWhenDeepgramIsUnavailable() {
        DeepgramService deepgramService = mock(DeepgramService.class);
        when(deepgramService.openStream(any())).thenReturn(null);

        AudioStreamHandler handler = new AudioStreamHandler(
                deepgramService,
                mock(ClaudeService.class),
                mock(ElevenLabsService.class),
                mock(RecordingService.class)
        );

        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");

        assertDoesNotThrow(() -> handler.afterConnectionEstablished(session));
    }
}
