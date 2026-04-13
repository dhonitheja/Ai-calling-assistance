package com.callscreen.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * ResumeService — loads resume.json and converts it to a dense plain-text
 * block that gets injected into the Claude system prompt.
 *
 * Why plain text instead of JSON?
 * LLMs parse prose more reliably than raw JSON in a system prompt.
 * Structured JSON wastes tokens on brackets and keys the model doesn't need.
 */
@Slf4j
@Service
public class ResumeService {

    private final ObjectMapper mapper = new ObjectMapper();
    private volatile String cachedResumeText = null;
    private volatile String cachedResumeJson = null;

    public String getResumeAsText() {
        if (cachedResumeText != null) return cachedResumeText;
        synchronized (this) {
            if (cachedResumeText != null) return cachedResumeText;
            cachedResumeText = loadAndFormat();
        }
        return cachedResumeText;
    }

    public String getResumeJson() {
        if (cachedResumeJson != null) return cachedResumeJson;
        synchronized (this) {
            if (cachedResumeJson != null) return cachedResumeJson;
            try {
                ClassPathResource resource = new ClassPathResource("resume.json");
                try (InputStream is = resource.getInputStream()) {
                    cachedResumeJson = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                }
            } catch (IOException e) {
                log.error("Could not load resume.json: {}", e.getMessage());
                cachedResumeJson = "{}";
            }
        }
        return cachedResumeJson;
    }

    /** Force reload — called after resume is updated at runtime */
    public void invalidateCache() {
        cachedResumeText = null;
        cachedResumeJson = null;
    }

    // ─── Private formatting ───────────────────────────────────────────────────

    private String loadAndFormat() {
        try {
            ClassPathResource resource = new ClassPathResource("resume.json");
            try (InputStream is = resource.getInputStream()) {
                String json = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                JsonNode root = mapper.readTree(json);
                return buildPromptText(root);
            }
        } catch (IOException e) {
            log.error("Could not load resume.json: {}", e.getMessage());
            return "Resume data unavailable.";
        }
    }

    private String buildPromptText(JsonNode r) {
        StringBuilder sb = new StringBuilder();

        // Identity
        sb.append("NAME: ").append(text(r, "name")).append("\n");
        sb.append("TITLE: ").append(text(r, "title")).append("\n");
        sb.append("LOCATION: ").append(text(r, "location")).append("\n");
        sb.append("VISA/WORK AUTH: ").append(text(r, "workAuthorization")).append("\n");
        sb.append("AVAILABILITY: ").append(text(r, "availability")).append("\n");
        sb.append("SALARY TARGET: ").append(text(r, "expectedSalary")).append("\n");
        sb.append("NOTICE PERIOD: ").append(text(r, "noticePeriod")).append("\n");
        sb.append("REMOTE PREFERENCE: ").append(text(r, "remotePreference")).append("\n");
        sb.append("OPEN TO RELOCATION: ").append(text(r, "openToRelocation")).append("\n");
        sb.append("YEARS OF EXPERIENCE: ").append(text(r, "yearsOfExperience")).append("\n\n");

        // Summary
        sb.append("PROFESSIONAL SUMMARY:\n").append(text(r, "summary")).append("\n\n");

        // Skills
        JsonNode skills = r.path("skills");
        if (!skills.isMissingNode()) {
            sb.append("SKILLS:\n");
            skills.fields().forEachRemaining(entry -> {
                sb.append("  ").append(entry.getKey()).append(": ");
                sb.append(joinArray(entry.getValue())).append("\n");
            });
            sb.append("\n");
        }

        // Experience
        JsonNode exp = r.path("experience");
        if (exp.isArray()) {
            sb.append("WORK EXPERIENCE:\n");
            for (JsonNode job : exp) {
                sb.append("  Company: ").append(text(job, "company")).append("\n");
                sb.append("  Title: ").append(text(job, "title")).append("\n");
                sb.append("  Duration: ").append(text(job, "duration")).append("\n");
                sb.append("  Location: ").append(text(job, "location")).append("\n");
                if (!job.path("description").isMissingNode()) {
                    sb.append("  About: ").append(text(job, "description")).append("\n");
                }
                JsonNode highlights = job.path("highlights");
                if (highlights.isArray()) {
                    sb.append("  Key contributions:\n");
                    for (JsonNode h : highlights) {
                        sb.append("    - ").append(h.asText()).append("\n");
                    }
                }
                sb.append("\n");
            }
        }

        // Projects
        JsonNode projects = r.path("projects");
        if (projects.isArray()) {
            sb.append("PROJECTS:\n");
            for (JsonNode p : projects) {
                sb.append("  Project: ").append(text(p, "name")).append("\n");
                sb.append("  Description: ").append(text(p, "description")).append("\n");
                sb.append("  Tech: ").append(joinArray(p.path("tech"))).append("\n");
                JsonNode hl = p.path("highlights");
                if (hl.isArray()) {
                    sb.append("  Key points:\n");
                    for (JsonNode h : hl) {
                        sb.append("    - ").append(h.asText()).append("\n");
                    }
                }
                sb.append("\n");
            }
        }

        // Education
        JsonNode edu = r.path("education");
        if (edu.isArray()) {
            sb.append("EDUCATION:\n");
            for (JsonNode e : edu) {
                sb.append("  ").append(text(e, "degree"))
                  .append(" — ").append(text(e, "school"))
                  .append(", ").append(text(e, "location"));
                if (!e.path("graduated").isMissingNode()) {
                    sb.append(" (graduated ").append(text(e, "graduated")).append(")");
                }
                sb.append("\n");
            }
            sb.append("\n");
        }

        // Certifications
        JsonNode certs = r.path("certifications");
        if (certs.isArray()) {
            sb.append("CERTIFICATIONS:\n");
            for (JsonNode c : certs) {
                sb.append("  - ").append(c.asText()).append("\n");
            }
            sb.append("\n");
        }

        // Pre-written interview answers (bonus context for the AI)
        JsonNode answers = r.path("commonInterviewAnswers");
        if (!answers.isMissingNode()) {
            sb.append("PRE-WRITTEN ANSWERS FOR COMMON QUESTIONS:\n");
            answers.fields().forEachRemaining(entry -> {
                sb.append("  Q-").append(entry.getKey()).append(": ")
                  .append(entry.getValue().asText()).append("\n\n");
            });
        }

        return sb.toString();
    }

    private String text(JsonNode node, String field) {
        JsonNode n = node.path(field);
        if (n.isMissingNode() || n.isNull()) return "";
        return n.asText("");
    }

    private String joinArray(JsonNode array) {
        if (!array.isArray()) return array.asText("");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < array.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(array.get(i).asText());
        }
        return sb.toString();
    }
}
