package com.callscreen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Loads and serves the resume JSON as the AI knowledge base.
 * The resume.json lives in src/main/resources/.
 */
@Slf4j
@Service
public class ResumeService {

    private final ObjectMapper mapper = new ObjectMapper();
    private String cachedResumeText = null;

    public String getResumeAsText() {
        if (cachedResumeText != null) {
            return cachedResumeText;
        }
        try {
            ClassPathResource resource = new ClassPathResource("resume.json");
            try (InputStream is = resource.getInputStream()) {
                String json = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                Map<String, Object> resumeMap = mapper.readValue(json, Map.class);
                cachedResumeText = formatResumeForPrompt(json, resumeMap);
                return cachedResumeText;
            }
        } catch (IOException e) {
            log.error("Could not load resume.json: {}", e.getMessage());
            return "Resume data unavailable.";
        }
    }

    @SuppressWarnings("unchecked")
    private String formatResumeForPrompt(String raw, Map<String, Object> resume) {
        StringBuilder sb = new StringBuilder();
        sb.append("NAME: ").append(resume.getOrDefault("name", "Unknown")).append("\n");
        sb.append("TITLE: ").append(resume.getOrDefault("title", "")).append("\n");
        sb.append("LOCATION: ").append(resume.getOrDefault("location", "")).append("\n");
        sb.append("OPEN_TO_RELOCATION: ").append(resume.getOrDefault("openToRelocation", "false")).append("\n");
        sb.append("REMOTE_PREFERENCE: ").append(resume.getOrDefault("remotePreference", "")).append("\n");
        sb.append("NOTICE_PERIOD: ").append(resume.getOrDefault("noticePeriod", "2 weeks")).append("\n");
        sb.append("EXPECTED_SALARY: ").append(resume.getOrDefault("expectedSalary", "open to discussion")).append("\n");
        sb.append("\n--- SUMMARY ---\n").append(resume.getOrDefault("summary", "")).append("\n");
        sb.append("\n--- SKILLS ---\n").append(resume.getOrDefault("skills", "")).append("\n");
        sb.append("\n--- EXPERIENCE ---\n").append(resume.getOrDefault("experience", "")).append("\n");
        sb.append("\n--- EDUCATION ---\n").append(resume.getOrDefault("education", "")).append("\n");
        sb.append("\n--- PROJECTS ---\n").append(resume.getOrDefault("projects", "")).append("\n");
        return sb.toString();
    }

    /**
     * Returns raw resume JSON for the Knowledge Base tab.
     */
    public String getResumeJson() {
        try {
            ClassPathResource resource = new ClassPathResource("resume.json");
            try (InputStream is = resource.getInputStream()) {
                return new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            return "{}";
        }
    }
}
