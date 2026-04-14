package com.callscreen.config;

import org.apache.coyote.http11.Http11NioProtocol;
import org.apache.coyote.http2.Http2Protocol;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * TomcatConfig — wires HTTP/2 cleartext (h2c) into embedded Tomcat.
 *
 * WHY THIS IS NEEDED:
 * Cloud Run with --use-http2 sends h2c (HTTP/2 cleartext, no TLS) to the container.
 * Spring Boot's application.yml `server.http2.enabled=true` enables h2 over TLS,
 * but NOT h2c over plain TCP. For h2c you must explicitly add Http2Protocol to Tomcat's
 * HTTP connector. Without this, Cloud Run gets connection resets → 503 on every request.
 *
 * WebSocket over h2c:
 * HTTP/2 carries WebSocket via the Extended CONNECT method (RFC 8441).
 * Once h2c is enabled, Twilio's wss:// connections work through Cloud Run's GFE proxy.
 */
@Configuration
public class TomcatConfig {

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> tomcatCustomizer() {
        return factory -> factory.addConnectorCustomizers(connector -> {
            // Add HTTP/2 cleartext upgrade protocol to the HTTP connector
            Http2Protocol http2Protocol = new Http2Protocol();
            // Keep WebSocket streams alive for up to 1 hour
            http2Protocol.setKeepAliveTimeout(3600000);
            connector.addUpgradeProtocol(http2Protocol);

            if (connector.getProtocolHandler() instanceof Http11NioProtocol protocol) {
                // Large header buffer for Twilio's WebSocket upgrade headers
                protocol.setMaxHttpRequestHeaderSize(65536);
                protocol.setMaxHttpResponseHeaderSize(65536);
                // Keep HTTP/1.1 connections alive too (fallback)
                protocol.setKeepAliveTimeout(3600000);
                protocol.setMaxKeepAliveRequests(1000);
            }
        });
    }
}
