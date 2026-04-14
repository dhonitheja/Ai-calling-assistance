package com.callscreen.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;

/**
 * ResumeService — loads ALL resume files and merges them into one rich
 * plain-text block for the Claude system prompt.
 *
 * Resume priority order:
 *   1. Runtime-uploaded files in RESUME_DIR (or next to JAR) — user can add
 *      new resumes from the dashboard without redeploying
 *   2. Classpath resources bundled in the JAR (resume.json, resume_fullstack.json,
 *      resume_backend.json)
 *
 * All loaded resumes are merged: the AI gets every detail from every variant,
 * so it can answer accurately whether the question is about AI/LLM work,
 * full stack experience, or pure backend Java depth.
 *
 * Why merge rather than pick one?
 * Each resume variant emphasizes different aspects of the same real work.
 * Merging gives Claude the widest context — it can answer "tell me about your
 * Kafka experience" with backend depth AND "tell me about your AI work" with
 * AI depth, from the same conversation.
 */
@Slf4j
@Service
public class ResumeService {

    @Value("${resume.dir:}")
    private String resumeDir;

    private final ObjectMapper mapper = new ObjectMapper();
    private volatile String cachedResumeText = null;
    private volatile String cachedResumeJson = null;

    // Classpath resume files bundled with the JAR — always present
    private static final String[] CLASSPATH_RESUMES = {
        "resume.json",
        "resume_fullstack.json",
        "resume_backend.json"
    };

    public String getResumeAsText() {
        if (cachedResumeText != null) return cachedResumeText;
        synchronized (this) {
            if (cachedResumeText != null) return cachedResumeText;
            cachedResumeText = loadAndMergeAll();
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

    /** Force reload — called after any resume is uploaded or updated at runtime */
    public void invalidateCache() {
        cachedResumeText = null;
        cachedResumeJson = null;
        log.info("Resume cache invalidated — will reload on next request");
    }

    // ─── Loading ──────────────────────────────────────────────────────────────

    private String loadAndMergeAll() {
        List<JsonNode> resumes = new ArrayList<>();

        // 1. Runtime-uploaded resumes from RESUME_DIR (or next to JAR)
        loadRuntimeResumes(resumes);

        // 2. Classpath resumes bundled in JAR
        for (String filename : CLASSPATH_RESUMES) {
            try {
                ClassPathResource resource = new ClassPathResource(filename);
                if (resource.exists()) {
                    try (InputStream is = resource.getInputStream()) {
                        String json = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                        resumes.add(mapper.readTree(json));
                        log.info("Loaded classpath resume: {}", filename);
                    }
                }
            } catch (IOException e) {
                log.warn("Could not load classpath resume {}: {}", filename, e.getMessage());
            }
        }

        if (resumes.isEmpty()) {
            log.error("No resume files found — using empty context");
            return "Resume data unavailable.";
        }

        log.info("Merging {} resume file(s) into AI context", resumes.size());
        return buildMergedPromptText(resumes);
    }

    private void loadRuntimeResumes(List<JsonNode> out) {
        // Check RESUME_DIR env var first, then next to JAR
        List<Path> searchDirs = new ArrayList<>();

        if (resumeDir != null && !resumeDir.isBlank()) {
            searchDirs.add(Paths.get(resumeDir));
        }

        try {
            java.io.File jarFile = new java.io.File(ResumeService.class.getProtectionDomain()
                    .getCodeSource().getLocation().toURI());
            searchDirs.add(jarFile.toPath().getParent());
        } catch (Exception ignored) { /* ignore */ }

        for (Path dir : searchDirs) {
            if (!Files.exists(dir)) continue;
            try (var stream = Files.list(dir)) {
                stream.filter(p -> p.getFileName().toString().startsWith("resume") &&
                                   p.getFileName().toString().endsWith(".json"))
                      .sorted()
                      .forEach(p -> {
                          try {
                              String json = Files.readString(p, StandardCharsets.UTF_8);
                              out.add(mapper.readTree(json));
                              log.info("Loaded runtime resume: {}", p.getFileName());
                          } catch (IOException e) {
                              log.warn("Could not load runtime resume {}: {}", p, e.getMessage());
                          }
                      });
            } catch (IOException e) {
                log.warn("Could not list resume dir {}: {}", dir, e.getMessage());
            }
        }
    }

    // ─── Merging / formatting ─────────────────────────────────────────────────

    /**
     * Merges all resume files into one dense plain-text block.
     *
     * Strategy:
     * - Core identity (name, salary, visa, location) comes from resume.json
     * - Work experience highlights: merged from all variants — each variant
     *   may have different highlight angles (AI-focused vs backend-focused)
     * - Technical depth Q&A from backend/fullstack variants added as extra context
     * - Projects and education from primary resume only (no duplication)
     */
    private String buildMergedPromptText(List<JsonNode> resumes) {
        // Primary resume is always first (resume.json from classpath or runtime)
        JsonNode primary = resumes.get(0);
        StringBuilder sb = new StringBuilder();

        // ── Identity block (from primary) ────────────────────────────────────
        sb.append("NAME: ").append(text(primary, "name")).append("\n");
        sb.append("TITLE: ").append(text(primary, "title")).append("\n");
        sb.append("LOCATION: ").append(text(primary, "location")).append("\n");
        sb.append("VISA/WORK AUTH: ").append(text(primary, "workAuthorization")).append("\n");
        sb.append("AVAILABILITY: ").append(text(primary, "availability")).append("\n");
        sb.append("SALARY TARGET: ").append(text(primary, "expectedSalary")).append("\n");
        sb.append("NOTICE PERIOD: ").append(text(primary, "noticePeriod")).append("\n");
        sb.append("REMOTE PREFERENCE: ").append(text(primary, "remotePreference")).append("\n");
        sb.append("OPEN TO RELOCATION: ").append(text(primary, "openToRelocation")).append("\n");
        sb.append("YEARS OF EXPERIENCE: ").append(text(primary, "yearsOfExperience")).append("\n\n");

        // ── Professional summary (from primary) ──────────────────────────────
        sb.append("PROFESSIONAL SUMMARY:\n").append(text(primary, "summary")).append("\n\n");

        // ── Additional summaries from variants ───────────────────────────────
        for (int i = 1; i < resumes.size(); i++) {
            String variantSummary = text(resumes.get(i), "summary");
            if (!variantSummary.isBlank()) {
                String variant = text(resumes.get(i), "variant");
                sb.append("ADDITIONAL CONTEXT (").append(variant.isBlank() ? "variant " + i : variant)
                  .append(" focus):\n").append(variantSummary).append("\n\n");
            }
        }

        // ── Skills (from primary) ─────────────────────────────────────────────
        JsonNode skills = primary.path("skills");
        if (!skills.isMissingNode()) {
            sb.append("SKILLS:\n");
            skills.fields().forEachRemaining(entry -> {
                sb.append("  ").append(entry.getKey()).append(": ");
                sb.append(joinArray(entry.getValue())).append("\n");
            });
            sb.append("\n");
        }

        // ── Key strengths from each variant ──────────────────────────────────
        for (JsonNode resume : resumes) {
            JsonNode strengths = resume.path("keyStrengths");
            String variant = text(resume, "variant");
            if (strengths.isArray() && strengths.size() > 0) {
                sb.append("KEY STRENGTHS (").append(variant.isBlank() ? "general" : variant)
                  .append("):\n");
                for (JsonNode s : strengths) {
                    sb.append("  - ").append(s.asText()).append("\n");
                }
                sb.append("\n");
            }
        }

        // ── Work experience — merged highlights from all variants ─────────────
        sb.append("WORK EXPERIENCE:\n\n");
        appendExperience(sb, primary, "highlights");
        for (int i = 1; i < resumes.size(); i++) {
            JsonNode r = resumes.get(i);
            String variant = text(r, "variant");
            JsonNode exp = r.path("experience");
            if (exp.isArray()) {
                for (JsonNode job : exp) {
                    // Check for variant-specific highlight fields
                    String hlField = variant.isBlank() ? "highlights"
                            : variant + "Highlights"; // e.g. "fullstackHighlights", "backendHighlights"
                    JsonNode hl = job.path(hlField);
                    if (!hl.isArray() || hl.isEmpty()) hl = job.path("highlights");
                    if (hl.isArray() && hl.size() > 0) {
                        String company = text(job, "company");
                        sb.append("  Additional depth — ").append(company)
                          .append(" (").append(variant).append(" perspective):\n");
                        for (JsonNode h : hl) {
                            sb.append("    - ").append(h.asText()).append("\n");
                        }
                        sb.append("\n");
                    }
                }
            }
        }

        // ── Projects (from primary) ───────────────────────────────────────────
        JsonNode projects = primary.path("projects");
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

        // ── Education (from primary) ──────────────────────────────────────────
        JsonNode edu = primary.path("education");
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

        // ── Certifications (from primary) ─────────────────────────────────────
        JsonNode certs = primary.path("certifications");
        if (certs.isArray()) {
            sb.append("CERTIFICATIONS:\n");
            for (JsonNode c : certs) {
                sb.append("  - ").append(c.asText()).append("\n");
            }
            sb.append("\n");
        }

        // ── Technical depth Q&A from variants ────────────────────────────────
        // These give the AI real depth on backend/fullstack topics beyond ai_dna.txt
        for (JsonNode resume : resumes) {
            JsonNode qa = resume.path("technicalQA");
            if (!qa.isMissingNode() && qa.isObject()) {
                String variant = text(resume, "variant");
                sb.append("TECHNICAL DEPTH Q&A (").append(variant).append("):\n");
                qa.fields().forEachRemaining(entry -> {
                    sb.append("  Topic: ").append(entry.getKey()).append("\n");
                    sb.append("  Answer: ").append(entry.getValue().asText()).append("\n\n");
                });
            }
            JsonNode depth = resume.path("technicalDepth");
            if (!depth.isMissingNode() && depth.isObject()) {
                String variant = text(resume, "variant");
                sb.append("TECHNICAL DEPTH (").append(variant).append("):\n");
                depth.fields().forEachRemaining(entry -> {
                    sb.append("  ").append(entry.getKey()).append(": ")
                      .append(entry.getValue().asText()).append("\n\n");
                });
            }
        }

        // ── Pre-written interview answers (from primary) ──────────────────────
        JsonNode answers = primary.path("commonInterviewAnswers");
        if (!answers.isMissingNode() && answers.isObject()) {
            sb.append("PRE-WRITTEN ANSWERS FOR COMMON QUESTIONS:\n");
            answers.fields().forEachRemaining(entry -> {
                sb.append("  Q-").append(entry.getKey()).append(": ")
                  .append(entry.getValue().asText()).append("\n\n");
            });
        }

        return sb.toString();
    }

    private void appendExperience(StringBuilder sb, JsonNode resume, String hlField) {
        JsonNode exp = resume.path("experience");
        if (!exp.isArray()) return;
        for (JsonNode job : exp) {
            sb.append("  Company: ").append(text(job, "company")).append("\n");
            sb.append("  Title: ").append(text(job, "title")).append("\n");
            sb.append("  Duration: ").append(text(job, "duration")).append("\n");
            sb.append("  Location: ").append(text(job, "location")).append("\n");
            if (!job.path("description").isMissingNode()) {
                sb.append("  About: ").append(text(job, "description")).append("\n");
            }
            JsonNode highlights = job.path(hlField);
            if (!highlights.isArray() || highlights.isEmpty()) {
                highlights = job.path("highlights");
            }
            if (highlights.isArray()) {
                sb.append("  Key contributions:\n");
                for (JsonNode h : highlights) {
                    sb.append("    - ").append(h.asText()).append("\n");
                }
            }
            sb.append("\n");
        }
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
