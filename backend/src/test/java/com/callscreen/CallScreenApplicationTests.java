package com.callscreen;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
    "ANTHROPIC_API_KEY=test",
    "DEEPGRAM_API_KEY=test",
    "ELEVENLABS_API_KEY=test",
    "TWILIO_ACCOUNT_SID=test",
    "TWILIO_AUTH_TOKEN=test"
})
class CallScreenApplicationTests {

    @Test
    void contextLoads() {
        // Verifies Spring context loads without errors
    }
}
