package com.callscreen.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HomeController {

    @GetMapping("/")
    public Map<String, String> index() {
        return Map.of(
            "status", "UP",
            "service", "AI Call Screener Backend Engine",
            "version", "1.0.0",
            "message", "Service is live and handling calls."
        );
    }
}
