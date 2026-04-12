"use client";

import { useState, useRef, useEffect } from "react";

const INTAKE_FIELDS = [
  {
    id: "resume",
    label: "Resume / Work History",
    icon: "📄",
    placeholder: `Paste your full resume here — job titles, companies, dates, responsibilities, achievements, tech stack used at each role...

Example:
Senior Data Engineer @ Frontier Communications (2022–Present)
- Built Kafka pipelines processing 2M events/day
- Led migration from on-prem to AWS EKS
- Reduced ETL latency by 40% using Redis caching`,
    rows: 10,
  },
  {
    id: "linkedin",
    label: "LinkedIn Bio / About Section",
    icon: "🔗",
    placeholder: `Paste your LinkedIn "About" section or any personal bio...

Example:
I'm a software engineer with 5+ years building scalable systems across telecom, banking, and healthcare. I love building products that actually solve real problems. Currently exploring AI-native SaaS and open to senior engineering roles in fintech or AI/ML companies.`,
    rows: 6,
  },
  {
    id: "projects",
    label: "Projects & Side Builds",
    icon: "🚀",
    placeholder: `Describe your projects — what you built, why, tech used, outcomes...

Example:
BharatCRM — India-focused CRM for SMBs
Stack: Spring Boot 3.2, Next.js 14, PostgreSQL, Redis, AWS EKS (Mumbai)
Why I built it: Indian SMBs have no affordable CRM with WhatsApp + UPI integration
Status: Passed security audit, in beta with 3 pilot customers`,
    rows: 8,
  },
];

const STYLE_PROMPTS = [
  { id: "greet", q: "How do you typically open a call with a recruiter?", placeholder: 'e.g. "Hey! Yeah this is Teja, thanks for reaching out..."' },
  { id: "strengths", q: "How do you describe your biggest strength? (in your own words)", placeholder: 'e.g. "Honestly I think my superpower is picking up new tech fast and shipping things that actually work in prod..."' },
  { id: "salary", q: "How do you handle salary questions?", placeholder: 'e.g. "I\'m flexible but I\'m targeting around 130-150k base depending on the total comp package..."' },
  { id: "whyme", q: "Why are you looking for a new role right now?", placeholder: 'e.g. "I\'ve been building some SaaS products on the side and I want a role where I can work on AI-adjacent problems full time..."' },
  { id: "passover", q: "How do you handle a question you don't know the answer to?", placeholder: 'e.g. "That\'s a good one — I\'d be honest and say I haven\'t used that specific thing but I can share how I\'d approach learning it..."' },
  { id: "personality", q: "Describe your communication style in 2-3 sentences:", placeholder: 'e.g. "I\'m pretty direct and casual, I don\'t talk in corporate jargon. I like to give context before jumping into answers..."' },
];

export default function AITrainingStudio() {
  const [stage, setStage] = useState("intake");
  const [intake, setIntake] = useState({
    resume: `Sai Teja Ragula - AI/Software Engineer
Email: Saitejaragula007@gmail.com | Phone: +1 (312) 838-4016 | LinkedIn: linkedin.com/in/sairagula
Location:Dallas,TX United States (Open to Relocation / Remote)

SUMMARY:
AI Engineer with 5+ years of software development experience and hands-on expertise building production AI applications with Large Language Models (LLMs). Skilled in LLM integration, multi-model orchestration, and prompt engineering using Gemini, Claude, and Vertex AI. Strong full stack foundation with Java/Spring Boot backend and React/TypeScript frontend.

EXPERIENCE:
Frontier Communications — AI/Software Engineer (Jan 2023 – Present)
- Integrate LLM capabilities into enterprise applications using Vertex AI and GCP
- Build multi-model orchestration systems to route requests based on task complexity
- Build full stack features using Java/Spring Boot backend and React/TypeScript frontend
- Achieve 90%+ code coverage through comprehensive testing

Wipro — Software Engineer (Jan 2022 – Jul 2022)
- Developed backend services using Java/Spring Boot for enterprise applications
- Built RESTful APIs and microservices with focus on scalability

Intellativ India — Software Engineer (Dec 2020 – Jan 2022)
- Built full stack applications using Java/Spring Boot and React/JavaScript

EDUCATION:
Master of Science in Computer Science, Governor's State University
B.Tech in Computer Science, St. Peter's Engineering College`,
    linkedin: `I am an AI Engineer with over 5 years of software development experience, specializing in LLM integration, multi-model orchestration, and prompt engineering. I enjoy building agentic AI workflows and intelligent automation. 

Top Skills:
- AI & LLMs: Google Vertex AI, Gemini 1.5, Claude, LangChain, RAG
- Languages: Python, Java, TypeScript
- Full Stack: Spring Boot, React.js, Next.js
- Cloud: GCP, AWS, Docker, Kubernetes

Certifications: IBM Prompt Engineering for Everyone, AWS Solutions Architect, Oracle AI Foundations.`,
    projects: `1. Wealthix – AI-Powered Financial Intelligence Platform
Stack: Next.js 14, Java 23, FastAPI, Gemini 1.5, Claude, PostgreSQL, AWS
Description: AI-powered MVP with multi-model orchestration. Implemented Hybrid Router pattern to dynamically select optimal LLM based on query complexity. Built RAG pipeline for context-aware responses.

2. AI Financial Co-Pilot – Automated Dispute Engine
Stack: Claude 3.5, Vertex AI, Next.js, TypeScript, PostgreSQL
Description: Agentic AI workflow for automated financial dispute resolution. Integrated Claude 3.5 for intelligent document analysis.

3. AI Call Screener
Stack: Spring Boot, Twilio, Deepgram, Claude API, ElevenLabs, Redis
Description: AI agent intercepting recruiter calls. Uses Twilio for phone layer, Deepgram for STT, Claude for reasoning, and ElevenLabs for TTS.`
  });
  const [style, setStyle] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<string[]>([]);
  interface AIDNA {
    systemPrompt: string;
    name: string;
    tone: string;
    topSkills: string[];
    styleNotes: string[];
    scenarioGuides: Record<string, string>;
  }

  const [aiDNA, setAiDNA] = useState<AIDNA | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const intakeComplete = INTAKE_FIELDS.some(f => intake[f.id]?.trim().length > 30);
  const styleComplete = Object.values(style).filter(v => v?.trim().length > 10).length >= 2;

  const generateDNA = async () => {
    setStage("generate");
    setGenerating(true);
    setGenProgress([]);

    const steps = [
      "Parsing resume & work history...",
      "Extracting technical skills & depth signals...",
      "Analyzing communication style samples...",
      "Mapping personality markers & tone...",
      "Synthesizing LinkedIn narrative...",
      "Compiling project context & motivations...",
      "Building answer patterns for common Q types...",
      "Generating your AI DNA profile...",
    ];

    for (let i = 0; i < steps.length - 1; i++) {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
      setGenProgress(p => [...p, steps[i]]);
    }

    const userDataSummary = `
RESUME & WORK HISTORY:
${intake.resume || "(not provided)"}

LINKEDIN / BIO:
${intake.linkedin || "(not provided)"}

PROJECTS & SIDE BUILDS:
${intake.projects || "(not provided)"}

COMMUNICATION STYLE SAMPLES:
${STYLE_PROMPTS.map(p => `Q: ${p.q}\nA: ${style[p.id] || "(not provided)"}`).join("\n\n")}
    `.trim();

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: `You are an expert at analyzing a person's professional data and communication style to create a rich AI persona prompt. 
You will receive raw data about a person — resume, bio, projects, and sample answers to style questions.
Generate a comprehensive system prompt (their "AI DNA") that an AI voice agent can use to answer phone screening calls EXACTLY as this person would — same knowledge, same tone, same personality, same way of handling tough questions.

The output must be:
1. A complete system prompt (start with "You are [Name]'s AI voice agent...")
2. Include their full professional context
3. Mirror their communication style precisely
4. Include specific instructions for common call scenarios (salary, availability, technical Qs, "tell me about yourself")
5. Include a "personality calibration" section with tone, pacing, and phrasing rules

Format your response as JSON with exactly these fields:
{
  "systemPrompt": "...",
  "name": "...",
  "tone": "...",
  "topSkills": ["...", "..."],
  "styleNotes": ["...", "..."],
  "scenarioGuides": { "salary": "...", "availability": "...", "intro": "...", "unknown": "..." }
}
Return ONLY valid JSON, no markdown, no extra text.`,
          messages: [{ role: "user", content: `Generate my AI DNA profile from this data:\n\n${userDataSummary}` }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setGenProgress(p => [...p, steps[steps.length - 1]]);
      await new Promise(r => setTimeout(r, 400));
      setAiDNA(parsed);
    } catch {
      setAiDNA({
        systemPrompt: "Error generating profile. Please check your data and try again.",
        name: "Unknown",
        tone: "N/A",
        topSkills: [],
        styleNotes: [],
        scenarioGuides: {},
      });
    }
    setGenerating(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || !aiDNA) return;
    const userMsg = { role: "user", content: chatInput };
    const next = [...messages, userMsg];
    setMessages(next);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: aiDNA.systemPrompt + "\n\nIMPORTANT: Keep answers to 2-4 sentences max, as if you're on a phone call. Be natural and conversational.",
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: "assistant", content: data.content?.[0]?.text || "Sorry, could you repeat that?" }]);
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Connection error — try again." }]);
    }
    setChatLoading(false);
  };

  const copyDNA = () => {
    navigator.clipboard.writeText(aiDNA?.systemPrompt || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deployDNA = async () => {
    if (!aiDNA?.systemPrompt || deploying) return;
    setDeploying(true);
    setDeployError(null);
    try {
      const res = await fetch("http://localhost:8080/api/ai-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: aiDNA.systemPrompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Deploy failed");
      }
      setDeployed(true);
      setTimeout(() => setDeployed(false), 4000);
    } catch (e: unknown) {
      setDeployError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const completedIntakeCount = INTAKE_FIELDS.filter(f => intake[f.id]?.trim().length > 30).length;
  const completedStyleCount = Object.values(style).filter(v => v?.trim().length > 10).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #c8a96e; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progressBar { from{width:0} to{width:100%} }
        .fade-up { animation: fadeUp 0.4s ease forwards; }
        .shimmer { animation: shimmer 1.5s ease-in-out infinite; }
        textarea { resize: vertical; }
        textarea:focus, input:focus { outline: none; }
      `}</style>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #2a2a2a", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0e0e0e", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 900, color: "#c8a96e", letterSpacing: "1px" }}>
            AI Training Studio
          </div>
          <div style={{ fontSize: "10px", color: "#555", letterSpacing: "3px", marginTop: "2px" }}>PERSONAL DNA BUILDER</div>
        </div>
        {/* Stage nav */}
        <div style={{ display: "flex", gap: "0", border: "1px solid #2a2a2a" }}>
          {[
            { id: "intake", label: "01 DATA", done: completedIntakeCount > 0 },
            { id: "style", label: "02 STYLE", done: completedStyleCount > 0 },
            { id: "generate", label: "03 GENERATE", done: !!aiDNA },
            { id: "test", label: "04 TEST", done: messages.length > 0 },
          ].map((s, i) => (
            <button key={s.id} onClick={() => { if (s.id === "test" && !aiDNA) return; if (s.id === "generate" && !intakeComplete && !styleComplete) return; setStage(s.id); }}
              style={{ background: stage === s.id ? "#c8a96e" : "transparent", color: stage === s.id ? "#0e0e0e" : s.done ? "#c8a96e" : "#444", border: "none", borderLeft: i > 0 ? "1px solid #2a2a2a" : "none", padding: "8px 16px", fontSize: "10px", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", fontWeight: s.done ? 600 : 400 }}>
              {s.done && stage !== s.id ? "✓ " : ""}{s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px" }}>

        {/* ─── STAGE 1: DATA INTAKE ─── */}
        {stage === "intake" && (
          <div className="fade-up">
            <div style={{ marginBottom: "40px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", color: "#e8e0d0", marginBottom: "12px" }}>
                Feed me your data.
              </div>
              <div style={{ fontSize: "13px", color: "#666", lineHeight: 1.8, maxWidth: "600px" }}>
                The more you give, the more accurately your AI will represent you.
                Paste whatever you have — rough is fine. The AI will structure it.
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                {INTAKE_FIELDS.map(f => (
                  <div key={f.id} style={{ fontSize: "10px", letterSpacing: "1px", padding: "4px 10px", border: `1px solid ${intake[f.id]?.trim().length > 30 ? "#c8a96e" : "#2a2a2a"}`, color: intake[f.id]?.trim().length > 30 ? "#c8a96e" : "#444" }}>
                    {intake[f.id]?.trim().length > 30 ? "✓" : "○"} {f.label.split(" ")[0].toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {INTAKE_FIELDS.map((f, i) => (
              <div key={f.id} style={{ marginBottom: "32px", animation: `fadeUp 0.4s ease ${i * 0.1}s forwards`, opacity: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "18px" }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#e8e0d0", letterSpacing: "1px" }}>{f.label}</div>
                    <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
                      {intake[f.id]?.trim().length > 0 ? `${intake[f.id].trim().length} chars` : "empty"}
                      {intake[f.id]?.trim().length > 30 ? " ✓" : ""}
                    </div>
                  </div>
                </div>
                <textarea
                  value={intake[f.id]}
                  onChange={e => setIntake(p => ({ ...p, [f.id]: e.target.value }))}
                  onFocus={() => setActiveField(f.id)}
                  onBlur={() => setActiveField(null)}
                  placeholder={f.placeholder}
                  rows={f.rows}
                  style={{ width: "100%", background: "#131313", border: `1px solid ${activeField === f.id ? "#c8a96e" : intake[f.id]?.trim().length > 30 ? "#3a3020" : "#222"}`, color: "#c8c0b0", fontFamily: "inherit", fontSize: "12px", padding: "16px", lineHeight: 1.8, transition: "border-color 0.2s", boxShadow: activeField === f.id ? "0 0 0 2px rgba(200,169,110,0.1)" : "none" }}
                />
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button onClick={() => setStage("style")} disabled={!intakeComplete}
                style={{ background: intakeComplete ? "#c8a96e" : "#1a1a1a", color: intakeComplete ? "#0e0e0e" : "#333", border: "none", padding: "14px 32px", fontSize: "12px", letterSpacing: "2px", cursor: intakeComplete ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 600, transition: "all 0.2s" }}>
                NEXT: STYLE CALIBRATION →
              </button>
            </div>
          </div>
        )}

        {/* ─── STAGE 2: STYLE ─── */}
        {stage === "style" && (
          <div className="fade-up">
            <div style={{ marginBottom: "40px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", color: "#e8e0d0", marginBottom: "12px" }}>
                Speak in your voice.
              </div>
              <div style={{ fontSize: "13px", color: "#666", lineHeight: 1.8, maxWidth: "600px" }}>
                Answer these as you actually would on a real call. Be casual. Be you.
                This is what makes your AI sound like <em>you</em> — not a generic bot.
              </div>
              <div style={{ fontSize: "10px", color: "#555", marginTop: "12px" }}>{completedStyleCount}/{STYLE_PROMPTS.length} answered</div>
            </div>

            {STYLE_PROMPTS.map((p, i) => (
              <div key={p.id} style={{ marginBottom: "28px", paddingBottom: "28px", borderBottom: i < STYLE_PROMPTS.length - 1 ? "1px solid #1a1a1a" : "none", animation: `fadeUp 0.4s ease ${i * 0.08}s forwards`, opacity: 0 }}>
                <div style={{ fontSize: "11px", color: "#888", marginBottom: "10px", lineHeight: 1.6 }}>
                  <span style={{ color: "#c8a96e", fontWeight: 600 }}>Q{i + 1}. </span>{p.q}
                </div>
                <textarea
                  value={style[p.id] || ""}
                  onChange={e => setStyle(prev => ({ ...prev, [p.id]: e.target.value }))}
                  onFocus={() => setActiveField(p.id)}
                  onBlur={() => setActiveField(null)}
                  placeholder={p.placeholder}
                  rows={3}
                  style={{ width: "100%", background: "#131313", border: `1px solid ${activeField === p.id ? "#c8a96e" : style[p.id]?.trim().length > 10 ? "#3a3020" : "#1e1e1e"}`, color: "#c8c0b0", fontFamily: "inherit", fontSize: "12px", padding: "14px", lineHeight: 1.8, transition: "all 0.2s" }}
                />
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
              <button onClick={() => setStage("intake")} style={{ background: "transparent", color: "#555", border: "1px solid #2a2a2a", padding: "14px 24px", fontSize: "11px", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit" }}>← BACK</button>
              <button onClick={generateDNA} disabled={!intakeComplete}
                style={{ background: "#c8a96e", color: "#0e0e0e", border: "none", padding: "14px 32px", fontSize: "12px", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, transition: "all 0.2s" }}>
                ⚡ GENERATE MY AI DNA
              </button>
            </div>
          </div>
        )}

        {/* ─── STAGE 3: GENERATE ─── */}
        {stage === "generate" && (
          <div className="fade-up">
            {generating ? (
              <div style={{ textAlign: "center", paddingTop: "60px" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", color: "#c8a96e", marginBottom: "40px" }}>Building your AI DNA...</div>
                <div style={{ maxWidth: "500px", margin: "0 auto", textAlign: "left" }}>
                  {genProgress.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", animation: "fadeUp 0.3s ease forwards" }}>
                      <div style={{ width: "8px", height: "8px", background: "#c8a96e", flexShrink: 0 }} />
                      <div style={{ fontSize: "12px", color: "#888" }}>{step}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }} className="shimmer">
                    <div style={{ width: "8px", height: "8px", border: "1px solid #c8a96e", flexShrink: 0 }} />
                    <div style={{ fontSize: "12px", color: "#555" }}>processing...</div>
                  </div>
                </div>
              </div>
            ) : aiDNA ? (
              <div>
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", color: "#c8a96e", marginBottom: "8px" }}>
                    Your AI DNA is ready.
                  </div>
                  <div style={{ fontSize: "12px", color: "#555" }}>Your voice AI will use this to answer calls exactly as you would.</div>
                </div>

                {/* Highlights */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
                  <div style={{ border: "1px solid #2a2a2a", padding: "20px", background: "#111" }}>
                    <div style={{ fontSize: "9px", color: "#555", letterSpacing: "3px", marginBottom: "12px" }}>IDENTITY</div>
                    <div style={{ fontSize: "14px", color: "#e8e0d0", fontFamily: "'Playfair Display', serif" }}>{aiDNA.name}</div>
                    <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>{aiDNA.tone}</div>
                  </div>
                  <div style={{ border: "1px solid #2a2a2a", padding: "20px", background: "#111" }}>
                    <div style={{ fontSize: "9px", color: "#555", letterSpacing: "3px", marginBottom: "12px" }}>TOP SKILLS MAPPED</div>
                    {(aiDNA.topSkills || []).slice(0, 4).map((s: string) => (
                      <div key={s} style={{ fontSize: "11px", color: "#c8a96e", marginBottom: "4px" }}>▸ {s}</div>
                    ))}
                  </div>
                  {aiDNA.styleNotes?.length > 0 && (
                    <div style={{ border: "1px solid #2a2a2a", padding: "20px", background: "#111", gridColumn: "1/-1" }}>
                      <div style={{ fontSize: "9px", color: "#555", letterSpacing: "3px", marginBottom: "12px" }}>PERSONALITY CALIBRATION</div>
                      {aiDNA.styleNotes.map((n: string, i: number) => (
                        <div key={i} style={{ fontSize: "11px", color: "#888", marginBottom: "8px", lineHeight: 1.6, paddingLeft: "12px", borderLeft: "2px solid #2a2a2a" }}>
                          {n}
                        </div>
                      ))}
                    </div>
                  )}
                  {aiDNA.scenarioGuides && (
                    <div style={{ border: "1px solid #2a2a2a", padding: "20px", background: "#111", gridColumn: "1/-1" }}>
                      <div style={{ fontSize: "9px", color: "#555", letterSpacing: "3px", marginBottom: "16px" }}>SCENARIO PLAYBOOK</div>
                      {Object.entries(aiDNA.scenarioGuides).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: "16px" }}>
                          <div style={{ fontSize: "10px", color: "#c8a96e", letterSpacing: "2px", marginBottom: "4px" }}>{k.toUpperCase()}</div>
                          <div style={{ fontSize: "11px", color: "#888", lineHeight: 1.7 }}>{v as React.ReactNode}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Full system prompt */}
                <div style={{ border: "1px solid #2a2a2a", marginBottom: "24px" }}>
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "9px", color: "#555", letterSpacing: "3px" }}>FULL SYSTEM PROMPT — COPY INTO YOUR VOICE AI</div>
                    <button onClick={copyDNA}
                      style={{ background: copied ? "#c8a96e" : "transparent", color: copied ? "#0e0e0e" : "#888", border: `1px solid ${copied ? "#c8a96e" : "#333"}`, padding: "6px 14px", fontSize: "10px", letterSpacing: "1px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                      {copied ? "✓ COPIED" : "COPY"}
                    </button>
                  </div>
                  <div style={{ padding: "20px", maxHeight: "300px", overflowY: "auto" }}>
                    <pre style={{ fontSize: "11px", color: "#888", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {aiDNA.systemPrompt}
                    </pre>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" }}>
                  {deployError && (
                    <div style={{ fontSize: "11px", color: "#e05555", alignSelf: "center" }}>{deployError}</div>
                  )}
                  <button onClick={deployDNA} disabled={deploying}
                    style={{ background: deployed ? "#4a9e6a" : deploying ? "#1a1a1a" : "transparent", color: deployed ? "#fff" : deploying ? "#555" : "#c8a96e", border: `1px solid ${deployed ? "#4a9e6a" : "#c8a96e"}`, padding: "14px 28px", fontSize: "12px", letterSpacing: "2px", cursor: deploying ? "default" : "pointer", fontFamily: "inherit", fontWeight: 600, transition: "all 0.2s" }}>
                    {deployed ? "✓ DEPLOYED" : deploying ? "DEPLOYING..." : "⚡ DEPLOY TO LIVE AI"}
                  </button>
                  <button onClick={() => { setMessages([]); setStage("test"); }}
                    style={{ background: "#c8a96e", color: "#0e0e0e", border: "none", padding: "14px 32px", fontSize: "12px", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    TEST YOUR AI →
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ─── STAGE 4: TEST ─── */}
        {stage === "test" && (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
            <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", color: "#e8e0d0", marginBottom: "6px" }}>
                  Talk to your AI.
                </div>
                <div style={{ fontSize: "11px", color: "#555" }}>Simulate a recruiter call — ask anything. The AI will respond as you would.</div>
              </div>
              <button onClick={() => setMessages([])} style={{ background: "transparent", color: "#444", border: "1px solid #2a2a2a", padding: "8px 16px", fontSize: "10px", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit" }}>CLEAR</button>
            </div>

            {/* Suggestion chips */}
            {messages.length === 0 && (
              <div style={{ marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {["Tell me about yourself.", "What's your expected salary?", "Are you open to relocation?", "Walk me through your most recent project.", "What tech stack are you strongest in?", "Why are you looking right now?"].map(q => (
                  <button key={q} onClick={() => { setChatInput(q); }}
                    style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#666", padding: "8px 14px", fontSize: "10px", letterSpacing: "1px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
                    onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#666"; }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #1a1a1a", padding: "20px", marginBottom: "16px", background: "#0a0a0a" }}>
              {messages.length === 0 && (
                <div style={{ color: "#2a2a2a", fontSize: "12px", textAlign: "center", marginTop: "60px" }}>
                  Your trained AI is ready. Ask a screening question above ↑
                </div>
              )}
              {messages.map((m, i: number) => (
                <div key={i} style={{ marginBottom: "20px", display: "flex", gap: "16px", flexDirection: m.role === "user" ? "row-reverse" : "row", animation: "fadeUp 0.3s ease forwards" }}>
                  <div style={{ fontSize: "9px", letterSpacing: "2px", color: m.role === "user" ? "#666" : "#c8a96e", minWidth: "60px", textAlign: m.role === "user" ? "right" : "left", paddingTop: "6px" }}>
                    {m.role === "user" ? "RECRUITER" : "YOUR AI"}
                  </div>
                  <div style={{ background: m.role === "user" ? "#131313" : "#0f0d09", border: `1px solid ${m.role === "user" ? "#1e1e1e" : "#2a2010"}`, padding: "14px 18px", maxWidth: "65%", fontSize: "13px", lineHeight: 1.8, color: m.role === "user" ? "#888" : "#d4c4a0" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#c8a96e", minWidth: "60px" }}>YOUR AI</div>
                  <div style={{ border: "1px solid #2a2010", padding: "14px 18px", fontSize: "13px", color: "#555" }} className="shimmer">thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: "0" }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder='Type a question a recruiter would ask...'
                style={{ flex: 1, background: "#131313", border: "1px solid #2a2a2a", borderRight: "none", color: "#c8c0b0", fontFamily: "inherit", fontSize: "13px", padding: "14px 18px" }} />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                style={{ background: chatInput.trim() ? "#c8a96e" : "#1a1a1a", color: chatInput.trim() ? "#0e0e0e" : "#333", border: "1px solid #2a2a2a", padding: "14px 28px", fontSize: "11px", letterSpacing: "2px", cursor: chatInput.trim() ? "pointer" : "default", fontFamily: "inherit", fontWeight: 700, transition: "all 0.2s" }}>
                SEND
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
