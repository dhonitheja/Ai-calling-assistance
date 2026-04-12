"use client";
import { useState } from "react";

const PROJECT_DATA = {
  meta: {
    title: "Digital Deflection Platform",
    client: "Frontier Communications",
    location: "Allen, TX",
    duration: "Jan 2023 – Present",
    role: "Java Full Stack Developer",
    domain: "Telecom / Customer Experience Automation",
  },

  summary: "Built a multi-channel digital deflection platform that automates customer interactions across IVR, SMS, and Mobile — reducing inbound call volume, eliminating unnecessary field dispatches, and improving real-time communication for trouble tickets and service orders.",

  // Java Full Stack angle - technical depth
  fullstackChunks: [
    {
      tag: "Architecture & Framework",
      content: "Designed and configured Java application framework and implementation layers with proper class structure for Mobile App integration. Led architectural decisions across multi-channel platform connecting IVR, SMS, and Mobile touchpoints.",
      keywords: ["Java", "Spring Boot", "Microservices", "Mobile API", "Multi-channel", "Architecture"],
    },
    {
      tag: "NLP Integration",
      content: "Designed and integrated NLP with the Digital Deflection application for SMS communication — enabling natural language understanding for automated customer responses over SMS channel. Built portals exposing NLP capabilities to business users.",
      keywords: ["NLP", "Natural Language Processing", "SMS", "Spring Boot", "Integration", "REST API"],
    },
    {
      tag: "Systems Integration",
      content: "Coordinated with multiple systems of record to handle Customer and Ticket journeys — including trouble tickets, New Orders, and Change Orders. Integrated IVR, SMS, and Mobile channels into a unified deflection engine.",
      keywords: ["Systems Integration", "REST", "IVR", "Ticket Management", "Service Orders", "Java"],
    },
    {
      tag: "Real-time Communication",
      content: "Built digital communication flows that send customers real-time updates on repair appointments, technician arrival status, and ticket resolution status — reducing inbound WISMO (Where Is My Order) calls significantly.",
      keywords: ["Real-time", "WebSocket", "SMS notifications", "Customer Experience", "Event-driven"],
    },
    {
      tag: "Agile & Leadership",
      content: "Provided technical and architectural leadership across sprint planning, demonstration, and retrospectives. Conducted component-level work estimation and assisted in project plan development and change control.",
      keywords: ["Agile", "Scrum", "Tech Lead", "Sprint Planning", "Architecture", "Leadership"],
    },
    {
      tag: "Documentation & Production",
      content: "Provided System Design documentation and Architecture Support. Maintained production support for the digital deflection platform serving Frontier's telecom customer base.",
      keywords: ["System Design", "Documentation", "Production Support", "Architecture"],
    },
  ],

  // AI Engineer angle - reframe same experience
  aiChunks: [
    {
      tag: "NLP Pipeline Design",
      content: "Designed and deployed NLP-integrated SMS communication layer for Digital Deflection — enabling automated intent classification and response generation for customer messages. This is directly applicable to LLM pipeline and AI workflow experience.",
      keywords: ["NLP", "Intent Classification", "Automated Response", "AI Pipeline", "LLM-adjacent"],
    },
    {
      tag: "Intelligent Automation",
      content: "Built an intelligent automation system that deflects customer calls and messages by automatically resolving common issues — reducing human agent involvement. Core problem is identical to AI agent design: understand intent, take action, communicate result.",
      keywords: ["AI Automation", "Agent Design", "Intent Handling", "Process Automation"],
    },
    {
      tag: "Multi-channel AI Integration",
      content: "Integrated AI-driven deflection logic across IVR, SMS, and Mobile — each channel with different latency, format, and UX constraints. Designed adaptive response strategies per channel.",
      keywords: ["Multi-modal", "Channel Integration", "IVR", "SMS", "AI Integration"],
    },
    {
      tag: "Event-driven Architecture",
      content: "Built event-driven customer journey management for trouble tickets and service orders — handling state transitions, notifications, and status updates asynchronously. Foundation maps directly to Kafka/event-stream AI pipeline patterns.",
      keywords: ["Event-driven", "Kafka-adjacent", "State Machine", "Async Processing", "AI Pipeline"],
    },
  ],

  // Interview Q&A pairs — how Teja would answer
  qaPairs: [
    {
      q: "Tell me about a complex integration project you've worked on.",
      a: "At Frontier I built a digital deflection platform that connects IVR, SMS, and mobile channels to reduce call volume. The tricky part was coordinating across multiple systems of record — ticket management, service orders, field dispatch — all in real time. We integrated NLP into the SMS layer so customers could get automated responses that actually made sense, and the platform sends live status updates on repair appointments and technician arrivals.",
    },
    {
      q: "What's your experience with NLP or AI integrations?",
      a: "At Frontier I designed and integrated NLP into a customer-facing SMS communication system — so when customers text in, the system understands their intent and responds automatically. It reduced our manual handling significantly. On the side I've built full AI-powered SaaS products using Claude API and Spring Boot — RAG pipelines, LLM orchestration, real-time voice agents.",
    },
    {
      q: "What kind of systems have you built on Java/Spring Boot?",
      a: "My main production system at Frontier is a multi-channel deflection platform — Spring Boot microservices, NLP integration, IVR/SMS/Mobile channels, real-time ticket status updates. I also designed the application framework and class structure from scratch for the Mobile API layer. Outside of work I've built BharatCRM and a usage-based billing SaaS, both on Spring Boot 3.2 with Kubernetes on AWS EKS.",
    },
    {
      q: "Have you worked in Agile/Scrum environments?",
      a: "Yes, full Agile at Frontier — sprint planning, demos, retros, I was also doing component-level estimation and helping with the project plan. I was the technical and architectural lead on the deflection platform.",
    },
    {
      q: "What's the scale of the systems you've built?",
      a: "Frontier serves millions of customers across the US, so the deflection platform handles a significant volume of interactions across IVR, SMS, and mobile. The goal was specifically to reduce call center volume — so it had to be reliable and real-time. I can speak to both the architecture side and the production support side of running it.",
    },
  ],

  // Vector DB chunks — ready to embed
  vectorChunks: [
    "Teja built a digital deflection platform at Frontier Communications that reduces inbound calls by automating customer interactions across IVR, SMS, and Mobile channels.",
    "Teja integrated NLP into an SMS communication system at Frontier — enabling automated intent understanding and response generation for telecom customers.",
    "Teja designed the Java application framework and implementation layers for the Mobile API at Frontier Communications, providing architectural and technical leadership.",
    "Teja coordinated with multiple systems of record at Frontier — handling trouble tickets, new service orders, and change orders in a unified customer journey platform.",
    "Teja built real-time digital communication flows at Frontier that notify customers of repair appointments, technician arrival status, and ticket resolution status.",
    "Teja provided System Design documentation, Architecture Support, and Production Support for the Frontier Digital Deflection platform.",
    "Teja participated in Agile/Scrum at Frontier — sprint planning, demos, retrospectives — and conducted component-level estimation as technical lead.",
    "Teja's NLP integration work at Frontier directly maps to AI pipeline and LLM orchestration experience — building intent classification and automated response systems.",
    "Teja's digital deflection work involves event-driven architecture and async state management for customer journeys — a strong foundation for AI agent and Kafka pipeline roles.",
  ],
};

// const TABS = ["overview", "fullstack", "ai-engineer", "interview-qa", "vector-export"];

export default function ProjectKnowledgeCard() {
  const [tab, setTab] = useState("overview");
  const [copiedIdx, setCopiedIdx] = useState<number | string | null>(null);
  const [allCopied, setAllCopied] = useState(false);

  const copy = (text: string, idx: number | string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const copyAll = () => {
    const all = PROJECT_DATA.vectorChunks.join("\\n\\n---\\n\\n");
    navigator.clipboard.writeText(all);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f0e8", fontFamily: "'DM Mono', 'Courier New', monospace", color: "#1a1208" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #b8860b; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.35s ease forwards; }
        .chip { display:inline-block; font-size:9px; letter-spacing:1.5px; padding:3px 8px; border:1px solid #d4a843; color:#8b6914; margin:2px; background: rgba(212,168,67,0.08); }
        .tab-btn { background:none; border:none; cursor:pointer; font-family:inherit; font-size:10px; letter-spacing:2px; padding:10px 18px; transition:all 0.2s; border-bottom: 2px solid transparent; }
        .qa-card { border-left: 3px solid #d4a843; padding: 16px 20px; margin-bottom:20px; background: rgba(212,168,67,0.04); }
        .vector-chunk { background:#1a1208; color:#d4a843; padding:14px 18px; font-size:11px; line-height:1.8; margin-bottom:10px; position:relative; border-left:3px solid #d4a843; }
        .copy-btn { background:transparent; border:1px solid; cursor:pointer; font-family:inherit; font-size:9px; letter-spacing:1px; padding:4px 10px; transition:all 0.2s; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1a1208", padding: "28px 36px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "11px", color: "#8b6914", letterSpacing: "4px", marginBottom: "8px" }}>
            PROJECT KNOWLEDGE CARD
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", color: "#f5f0e8", fontWeight: 700, lineHeight: 1.2 }}>
            {PROJECT_DATA.meta.title}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "16px", color: "#d4a843", fontStyle: "italic", marginTop: "4px" }}>
            {PROJECT_DATA.meta.client} · {PROJECT_DATA.meta.location}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "#8b6914", letterSpacing: "2px", marginBottom: "4px" }}>{PROJECT_DATA.meta.duration}</div>
          <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px" }}>{PROJECT_DATA.meta.role}</div>
          <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px" }}>{PROJECT_DATA.meta.domain}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #ddd3c0", background: "#faf6ee", display: "flex", overflowX: "auto" }}>
        {[
          { id: "overview", label: "OVERVIEW" },
          { id: "fullstack", label: "JAVA FULL STACK" },
          { id: "ai-engineer", label: "AI ENGINEER" },
          { id: "interview-qa", label: "INTERVIEW Q&A" },
          { id: "vector-export", label: "VECTOR CHUNKS" },
        ].map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
            style={{ color: tab === t.id ? "#b8860b" : "#999", borderBottom: tab === t.id ? "2px solid #b8860b" : "2px solid transparent", fontWeight: tab === t.id ? 500 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "36px 24px" }}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="fade-up">
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", color: "#1a1208", marginBottom: "16px", fontWeight: 600 }}>
              What this project is about
            </div>
            <div style={{ fontSize: "13px", lineHeight: 2, color: "#3a2f1e", marginBottom: "32px", padding: "20px 24px", background: "#fff", borderLeft: "3px solid #d4a843" }}>
              {PROJECT_DATA.summary}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "32px" }}>
              {[
                { label: "CHANNELS", val: "IVR · SMS · Mobile" },
                { label: "IMPACT", val: "Call deflection + dispatch reduction" },
                { label: "STACK", val: "Java · Spring Boot · NLP · REST" },
                { label: "SYSTEMS", val: "Trouble Tickets · Service Orders" },
                { label: "REAL-TIME", val: "Tech arrival · Repair status" },
                { label: "ROLE", val: "Tech Lead + Architecture" },
              ].map(({ label, val }) => (
                <div key={label} style={{ border: "1px solid #ddd3c0", padding: "16px", background: "#fff" }}>
                  <div style={{ fontSize: "9px", color: "#b8860b", letterSpacing: "2px", marginBottom: "6px" }}>{label}</div>
                  <div style={{ fontSize: "12px", color: "#1a1208", lineHeight: 1.6 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#1a1208", padding: "20px 24px", borderRadius: "0" }}>
              <div style={{ fontSize: "9px", color: "#8b6914", letterSpacing: "3px", marginBottom: "12px" }}>HOW THIS DATA FEEDS YOUR VOICE AI</div>
              <div style={{ fontSize: "11px", color: "#d4a843", lineHeight: 2 }}>
                ▸ <strong style={{ color: "#f5f0e8" }}>Java Full Stack roles</strong> → highlights framework design, NLP integration, multi-channel systems, agile leadership<br />
                ▸ <strong style={{ color: "#f5f0e8" }}>AI Engineer roles</strong> → reframes NLP work as AI pipeline experience, deflection as agent design<br />
                ▸ <strong style={{ color: "#f5f0e8" }}>Vector DB</strong> → 9 pre-chunked embeddings ready to load into pgvector<br />
                ▸ <strong style={{ color: "#f5f0e8" }}>Interview Q&A</strong> → 5 realistic answers in your voice for screening calls
              </div>
            </div>
          </div>
        )}

        {/* FULL STACK */}
        {tab === "fullstack" && (
          <div className="fade-up">
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", marginBottom: "8px", fontWeight: 600 }}>Java Full Stack Angle</div>
            <div style={{ fontSize: "11px", color: "#999", marginBottom: "28px" }}>How your AI surfaces this project for Full Stack Developer roles</div>
            {PROJECT_DATA.fullstackChunks.map((c, i) => (
              <div key={i} style={{ marginBottom: "20px", background: "#fff", border: "1px solid #ddd3c0", padding: "20px 24px" }}>
                <div style={{ fontSize: "10px", color: "#b8860b", letterSpacing: "2px", marginBottom: "10px", fontWeight: 500 }}>{c.tag}</div>
                <div style={{ fontSize: "12px", color: "#3a2f1e", lineHeight: 1.9, marginBottom: "14px" }}>{c.content}</div>
                <div>{c.keywords.map(k => <span key={k} className="chip">{k}</span>)}</div>
              </div>
            ))}
          </div>
        )}

        {/* AI ENGINEER */}
        {tab === "ai-engineer" && (
          <div className="fade-up">
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", marginBottom: "8px", fontWeight: 600 }}>AI Engineer Angle</div>
            <div style={{ fontSize: "11px", color: "#999", marginBottom: "28px" }}>Same experience, reframed for AI/ML Engineer roles — your AI uses this when the caller is from an AI-focused company</div>
            <div style={{ background: "#fffbf0", border: "1px solid #d4a843", padding: "14px 20px", marginBottom: "24px", fontSize: "11px", color: "#8b6914", lineHeight: 1.8 }}>
              ⚡ Your NLP integration + event-driven design + intelligent automation work IS AI engineering experience. This angle surfaces that story correctly.
            </div>
            {PROJECT_DATA.aiChunks.map((c, i) => (
              <div key={i} style={{ marginBottom: "20px", background: "#fff", border: "1px solid #ddd3c0", borderLeft: "3px solid #d4a843", padding: "20px 24px" }}>
                <div style={{ fontSize: "10px", color: "#b8860b", letterSpacing: "2px", marginBottom: "10px", fontWeight: 500 }}>{c.tag}</div>
                <div style={{ fontSize: "12px", color: "#3a2f1e", lineHeight: 1.9, marginBottom: "14px" }}>{c.content}</div>
                <div>{c.keywords.map(k => <span key={k} className="chip">{k}</span>)}</div>
              </div>
            ))}
          </div>
        )}

        {/* INTERVIEW Q&A */}
        {tab === "interview-qa" && (
          <div className="fade-up">
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", marginBottom: "8px", fontWeight: 600 }}>Interview Q&A</div>
            <div style={{ fontSize: "11px", color: "#999", marginBottom: "28px" }}>Your Voice AI will answer these exactly as written — in your tone, with your specifics</div>
            {PROJECT_DATA.qaPairs.map((qa, i) => (
              <div key={i} className="qa-card">
                <div style={{ fontSize: "10px", color: "#b8860b", letterSpacing: "2px", marginBottom: "8px" }}>Q{i + 1}</div>
                <div style={{ fontSize: "13px", color: "#1a1208", fontWeight: 500, marginBottom: "12px", lineHeight: 1.6 }}>{qa.q}</div>
                <div style={{ fontSize: "12px", color: "#3a2f1e", lineHeight: 1.9, borderTop: "1px solid #ddd3c0", paddingTop: "12px" }}>
                  <span style={{ color: "#b8860b", fontSize: "10px", letterSpacing: "1px" }}>YOUR AI ANSWERS: </span><br />{qa.a}
                </div>
                <button className="copy-btn" onClick={() => copy(qa.a, i)}
                  style={{ marginTop: "12px", borderColor: copiedIdx === i ? "#b8860b" : "#ddd3c0", color: copiedIdx === i ? "#b8860b" : "#999" }}>
                  {copiedIdx === i ? "✓ COPIED" : "COPY ANSWER"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* VECTOR CHUNKS */}
        {tab === "vector-export" && (
          <div className="fade-up">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", fontWeight: 600, marginBottom: "4px" }}>Vector DB Chunks</div>
                <div style={{ fontSize: "11px", color: "#999" }}>9 pre-chunked texts — embed these into pgvector for RAG retrieval</div>
              </div>
              <button onClick={copyAll}
                style={{ background: allCopied ? "#1a1208" : "transparent", color: allCopied ? "#d4a843" : "#b8860b", border: "1px solid #b8860b", padding: "10px 20px", fontSize: "10px", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                {allCopied ? "✓ ALL COPIED" : "COPY ALL CHUNKS"}
              </button>
            </div>

            <div style={{ background: "#f0ece4", border: "1px solid #ddd3c0", padding: "14px 18px", marginBottom: "24px", fontSize: "11px", color: "#8b6914", lineHeight: 1.8 }}>
              <strong>How to use in Spring Boot + pgvector:</strong><br />
              1. Embed each chunk using OpenAI / Claude embeddings API<br />
              2. Store in pgvector with metadata: source=&quot;frontier&quot;, type=&quot;experience&quot;<br />
              3. At call time: embed recruiter question &rarr; cosine similarity search &rarr; inject top-3 chunks into Claude context
            </div>

            {PROJECT_DATA.vectorChunks.map((chunk, i) => (
              <div key={i} className="vector-chunk">
                <div style={{ fontSize: "9px", color: "#8b6914", letterSpacing: "2px", marginBottom: "8px" }}>CHUNK {String(i + 1).padStart(2, "0")}</div>
                {chunk}
                <button className="copy-btn" onClick={() => copy(chunk, `v${i}`)}
                  style={{ marginTop: "10px", display: "block", borderColor: copiedIdx === `v${i}` ? "#d4a843" : "#3a2f1e", color: copiedIdx === `v${i}` ? "#d4a843" : "#555" }}>
                  {copiedIdx === `v${i}` ? "✓ COPIED" : "COPY"}
                </button>
              </div>
            ))}

            <div style={{ background: "#1a1208", padding: "20px 24px", marginTop: "24px" }}>
              <div style={{ fontSize: "9px", color: "#8b6914", letterSpacing: "3px", marginBottom: "12px" }}>SPRING BOOT INGESTION CODE</div>
              <pre style={{ fontSize: "10px", color: "#d4a843", lineHeight: 1.9, overflowX: "auto", whiteSpace: "pre-wrap" }}>{`// Embed + store each chunk
List<String> chunks = loadFrontierChunks();

chunks.forEach(chunk -> {
  float[] vector = embeddingClient.embed(chunk);
  vectorRepo.save(new VectorMemory(
    UUID.randomUUID(),
    chunk,
    vector,
    Map.of(
      "source", "frontier",
      "type",   "experience",
      "angle",  "fullstack,ai-engineer"
    )
  ));
});

// At call time — RAG retrieval
float[] questionVec = embeddingClient.embed(recruiterQuestion);
List<VectorMemory> context = vectorRepo
  .findTopKByCosine(questionVec, 3);`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
