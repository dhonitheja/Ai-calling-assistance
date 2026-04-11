"use client";

import { useState, useRef, useEffect } from "react";

const TEJA_CONTEXT = `
Name: Sai Teja Ragula | Role: Java Full Stack Developer & AI Engineer
Current: Frontier Communications — Digital Deflection Platform (IVR, SMS, Mobile, NLP)
Previous: Wipro (Spring Boot, DevSecOps, AWS EKS), Intellative India (Fintech, Kafka, OAuth2)
Projects: BharatCRM (India SaaS CRM), Meterai (billing SaaS), Wealthix (AI fintech)
Stack: Java, Spring Boot 3.2, Next.js 14, React, AWS EKS, Kubernetes, Kafka, Redis, Claude API, Pinecone
Education: MS Computer Science, Governors State University
Location: McKinney TX | Auth: US work authorized | Notice: 2 weeks
`;

const QUESTION_BANKS = {
  "hiring-manager": {
    label: "Hiring Manager",
    icon: "👔",
    color: "#6366f1",
    accent: "#818cf8",
    categories: {
      "Leadership & Ownership": [
        { id: "hm1", q: "Tell me about a time you took ownership of a problem that wasn't technically yours.", defaultA: "Yeah, there was a situation at Frontier where our SMS delivery was failing for a segment of customers — it was technically the third-party gateway's issue. But the customer complaints were hitting our team. I just dug in, traced the failure patterns, built a retry logic layer on our end, and set up CloudWatch alerts so we'd catch it before customers did. Didn't wait for someone else to own it — just fixed what I could fix." },
        { id: "hm2", q: "How do you handle a situation where you disagree with your manager's technical decision?", defaultA: "I always voice it once, clearly, with data. At Wipro I disagreed with using a monolith approach for a feature that I knew would need to scale. I laid out the tradeoffs — scalability, deployment complexity, team velocity — and proposed microservices instead. Manager heard me out, we went with a hybrid. The key is you make your case professionally, then commit to whatever direction is chosen." },
        { id: "hm3", q: "Describe a project where you led a team through a technical challenge.", defaultA: "At Frontier I was the tech lead on the Digital Deflection platform. The challenge was integrating three completely different channels — IVR, SMS, Mobile — with a unified backend. I designed the architecture, split the work across the team, and ran weekly design reviews. The trickiest part was the NLP layer for SMS — I personally built that integration. We shipped on time and it actually reduced call volume which was the whole goal." },
        { id: "hm4", q: "What's the most impactful thing you've shipped in the last year?", defaultA: "The NLP-integrated SMS layer at Frontier. It lets customers text in about their service issue and get automated, intelligent responses — reducing the need for live agents. The impact was measurable — fewer dispatches, lower call volume, better CSAT. On the side I shipped BharatCRM to beta — a full SaaS CRM for Indian SMBs with WhatsApp and UPI integration, which I built solo from scratch." },
        { id: "hm5", q: "How do you prioritize when you have multiple high-priority tasks?", defaultA: "I use a simple mental model — impact vs effort, plus who's blocked by me. At Frontier I'd often have production issues and feature work competing for time. I always triage prod first, then look at what's blocking teammates, then planned work. I'm also pretty direct with my manager when the plate is genuinely full — I'd rather have that conversation early than miss a deadline silently." },
      ],
      "Culture & Collaboration": [
        { id: "hm6", q: "Tell me about a time you had conflict with a teammate. How did you resolve it?", defaultA: "At Intellative I had a disagreement with a colleague over API design — they wanted to version everything upfront, I thought it was premature complexity. We actually just sat down, whiteboarded both approaches, and stress-tested them against our actual use cases. His approach held up better for our specific client requirements so I went with it. No ego, just the best solution." },
        { id: "hm7", q: "How do you mentor junior developers?", defaultA: "I try to give them real problems, not toy problems. At Frontier I'd pair with juniors on actual feature work — explain the why behind architectural decisions, not just the how. Code reviews are where I invest most — I'd rather write a detailed comment than just approve. I also share resources and don't make people feel bad for not knowing things yet." },
        { id: "hm8", q: "Why do you want to work here specifically?", defaultA: "I research every company before an interview — I want to understand what you're actually building and why it matters. For this role specifically, [the AI-driven product work / scale of the engineering challenge / the fintech domain] aligns with where I've been heading — building intelligent systems that solve real problems, not just CRUD apps." },
        { id: "hm9", q: "Where do you see yourself in 3 years?", defaultA: "Technically, I want to be deep in AI-native system design — building systems where LLMs aren't bolted on but are core to the architecture. Leadership-wise I enjoy the tech lead role — guiding architecture and mentoring while still being hands-on. And honestly I'm building a SaaS product on the side, so entrepreneurship is always in the mix for me." },
      ],
      "Technical Depth": [
        { id: "hm10", q: "Walk me through a system design decision you made that you're proud of.", defaultA: "The architecture I designed for Frontier's Digital Deflection platform. We had IVR, SMS, and mobile all needing to interact with the same backend systems of record — tickets, orders, customer data. I designed a unified event-driven layer so each channel just publishes and subscribes to events — no tight coupling. That meant we could add a new channel later without touching existing code. Clean, scalable, and it actually held up in production." },
        { id: "hm11", q: "How do you ensure code quality in your team?", defaultA: "Three things: meaningful code reviews, automated tests that actually test behavior not just coverage, and agreed-upon patterns. At Intellative we enforced 90% code coverage with JUnit and Mockito. At Wipro I set up the CI/CD pipeline so tests had to pass before anything merged. And I try to lead by example — if I write clean, well-commented code, the standard sets itself." },
        { id: "hm12", q: "Tell me about your experience with cloud architecture.", defaultA: "AWS is my primary cloud. At Frontier and in my own projects I run Spring Boot microservices on AWS EKS — Kubernetes, ECR for container registry, RDS for Postgres, Redis on ElastiCache, CloudWatch for observability. BharatCRM runs on EKS in the Mumbai region specifically for data residency reasons. I've also worked with GCP Vertex AI for ML workloads and Azure for some enterprise client work at Wipro." },
      ],
    },
  },
  "ai-screening": {
    label: "AI Screening",
    icon: "🤖",
    color: "#0891b2",
    accent: "#22d3ee",
    categories: {
      "One-Way Video / HireVue Style": [
        { id: "ai1", q: "In 90 seconds, tell me about yourself and why you're a good fit for this role.", defaultA: "Sure — I'm Sai Teja, a full stack and AI engineer with about 5 years of experience. I'm currently at Frontier Communications where I built a multi-channel platform that automates customer interactions using NLP, Java, and Spring Boot. Before that I was at Wipro and Intellative building microservices for enterprise and fintech clients. On the side I've shipped three SaaS products — BharatCRM, Meterai, and Wealthix — all production-grade, all solo. I'm at my best when I'm building systems that actually solve hard problems, and this role looks like it fits that exactly." },
        { id: "ai2", q: "What's your greatest professional achievement?", defaultA: "Honestly, shipping BharatCRM as a solo founder. It's a full SaaS CRM for Indian SMBs — Spring Boot backend, Next.js frontend, deployed on AWS EKS Mumbai, with WhatsApp Business API and UPI payments integrated. Passed a security audit, onboarded beta customers. Doing that alone from architecture to production gave me more confidence than any team project has." },
        { id: "ai3", q: "Describe a challenge you faced and how you overcame it.", defaultA: "At Frontier we had a tight deadline to integrate our SMS channel with an NLP engine that had inconsistent API behavior — it'd timeout under load. I built an async retry layer with exponential backoff and a fallback response system so customers always got something useful even when the NLP call failed. Got it done in time, and it actually made the whole system more resilient than originally planned." },
        { id: "ai4", q: "Why are you leaving your current role?", defaultA: "I've genuinely loved building at Frontier — the scale and the technical complexity. I'm looking for a role where AI is central to the product, not just a layer on top. I've been building AI-native systems on the side and I want that to be my main focus. It's just time to move toward that." },
        { id: "ai5", q: "What's your experience working in an Agile environment?", defaultA: "All three of my roles have been full Agile. At Frontier I was the tech lead — running sprint planning, doing estimation, facilitating design reviews. At Wipro and Intellative it was standard Scrum with Jira. I actually like the structure — sprint cadence keeps the team honest and retrospectives are where real improvement happens if you take them seriously." },
      ],
      "Technical Screening (Phone/Chat)": [
        { id: "ai6", q: "What's the difference between REST and GraphQL and when would you use each?", defaultA: "REST is simpler — fixed endpoints, great for most CRUD APIs and public-facing services. GraphQL shines when clients have very different data needs or you're dealing with nested relational data — you let the client specify exactly what it needs. I use REST by default — at Frontier, Wipro, Intellative. I'd reach for GraphQL if I had a complex frontend with lots of different views hitting the same backend, like a BFF pattern." },
        { id: "ai7", q: "Explain microservices vs monolith — when would you choose each?", defaultA: "Monolith first, microservices when you feel the pain. I've seen too many teams start with microservices too early and spend all their time on infra instead of product. At Intellative we started modular-monolith, then split services as team and scale demanded. Microservices make sense when you need independent deployability, different scaling profiles per service, or team autonomy. I've run both — Spring Boot monoliths and Spring Cloud microservices on EKS." },
        { id: "ai8", q: "How does Spring Security handle authentication and authorization?", defaultA: "Spring Security sits as a filter chain before your controllers. For authentication it supports form login, HTTP Basic, OAuth2, and JWT out of the box. At Intellative I implemented OAuth2/JWT — the client gets a token, Spring validates it on every request via a OncePerRequestFilter, and then method-level @PreAuthorize handles authorization based on roles. Pretty clean once you've set it up once." },
        { id: "ai9", q: "What is your approach to API design?", defaultA: "Contract-first, versioned from day one, and RESTful unless there's a reason not to be. I use OpenAPI/Swagger to define the spec before writing code — it forces clarity on the interface. At Frontier I designed the APIs for all three channel integrations — IVR, SMS, mobile — keeping them consistent so downstream teams could onboard easily. I also care about error responses being as useful as success responses." },
        { id: "ai10", q: "How do you handle database migrations in production?", defaultA: "Flyway or Liquibase — always. No manual schema changes in prod, ever. At Frontier and in BharatCRM I use Flyway with versioned migration scripts that run automatically on deployment. The key discipline is: migrations are additive, never destructive — add columns, don't drop them until you're sure old code isn't using them. Blue-green deployments make this even safer." },
      ],
      "Behavioral / Competency": [
        { id: "ai11", q: "Tell me about a time you had to learn a new technology quickly.", defaultA: "When I started building BharatCRM I hadn't used the WhatsApp Business API before. I had about two weeks to integrate it before my first beta customer demo. I just went deep — read the docs end to end, built a test harness, hit every edge case I could think of. Got it working in 10 days. The key for me is building something real with the tech immediately — tutorials only get you so far." },
        { id: "ai12", q: "Describe a situation where you had to work with ambiguous requirements.", defaultA: "Most of my work at Frontier had some ambiguity — business stakeholders know what they want but not always how to spec it. For the Digital Deflection platform the original requirement was just 'reduce calls.' I sat with the business team, mapped out the actual customer journeys, and translated that into clear technical requirements. I find ambiguity is usually just a communication gap — getting the right people in a room usually resolves it." },
        { id: "ai13", q: "What do you do when you're stuck on a problem for too long?", defaultA: "I give myself a hard time limit — maybe 45 minutes of real focused effort. If I'm still stuck I do one of three things: rubber duck it out loud, take a walk and let it background process, or ask someone. No ego about asking. At Wipro I'd ping a senior colleague if I was genuinely stuck — usually they'd ask one question that unlocked it. Fresh eyes matter." },
        { id: "ai14", q: "How do you stay current with technology?", defaultA: "Honestly, building things. Reading about tech only sticks for me when I'm also using it. I built Wealthix to learn Plaid and AI financial tools, BharatCRM to learn WhatsApp and UPI APIs, the voice AI agent to learn Twilio and Deepgram and ElevenLabs. Beyond that — system design newsletters, occasional conference talks, and I contribute to open source when time allows." },
      ],
    },
  },
};

export default function InterviewTrainingStudio() {
  const [activeBank, setActiveBank] = useState("hiring-manager");
  const [activeCategory, setActiveCategory] = useState(null);
  const [answers, setAnswers] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [generating, setGenerating] = useState({});
  const [ingesting, setIngesting] = useState(false);
  const [ingestDone, setIngestDone] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testQ, setTestQ] = useState(null);
  const [testResponse, setTestResponse] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [tab, setTab] = useState("train");

  const bank = QUESTION_BANKS[activeBank];

  // Initialize answers with defaults
  useEffect(() => {
    const init = {};
    Object.values(QUESTION_BANKS).forEach(b =>
      Object.values(b.categories).forEach(qs =>
        qs.forEach(q => { init[q.id] = q.defaultA; })
      )
    );
    setAnswers(init);
  }, []);

  useEffect(() => {
    const filled = Object.values(answers).filter(a => a?.trim().length > 20).length;
    setCompletedCount(filled);
  }, [answers]);

  const allQuestions = Object.values(QUESTION_BANKS).flatMap(b =>
    Object.values(b.categories).flatMap(qs => qs)
  );
  const totalQ = allQuestions.length;

  const improveWithAI = async (qId, question) => {
    setGenerating(p => ({ ...p, [qId]: true }));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: \`You are helping Sai Teja Ragula prepare interview answers. 
Improve his answer to sound more natural, conversational, and specific.
Keep the STAR structure for behavioral questions but make it sound like real speech.
Use contractions. Keep it concise — 3-5 sentences max for technical, brief story for behavioral.
Reference his actual experience: \${TEJA_CONTEXT}
Return ONLY the improved answer, no preamble.\`,
          messages: [{ role: "user", content: \`Question: \${question}\\n\\nCurrent answer: \${answers[qId] || ""}\` }],
        }),
      });
      const data = await res.json();
      const improved = data.content?.[0]?.text;
      if (improved) setAnswers(p => ({ ...p, [qId]: improved }));
    } catch (e) { console.error(e); }
    setGenerating(p => ({ ...p, [qId]: false }));
  };

  const testAnswer = async (question, answer) => {
    setTestMode(true);
    setTestQ(question);
    setTestResponse("");
    setTestLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: \`You are a hiring manager or AI screening system. 
The candidate just answered your question. 
Give brief feedback (2-3 sentences): What was strong? What could be tighter?
Then rate it: Strong / Solid / Needs Work
Be direct, not fluffy.\`,
          messages: [{ role: "user", content: \`Question: \${question}\\n\\nCandidate answered: \${answer}\` }],
        }),
      });
      const data = await res.json();
      setTestResponse(data.content?.[0]?.text || "");
    } catch (e) { setTestResponse("Error — try again."); }
    setTestLoading(false);
  };

  const buildVectorChunks = () => {
    const chunks = [];
    Object.entries(QUESTION_BANKS).forEach(([bankId, bank]) => {
      Object.entries(bank.categories).forEach(([cat, qs]) => {
        qs.forEach(q => {
          const answer = answers[q.id] || q.defaultA;
          if (answer?.trim().length > 20) {
            chunks.push({
              text: \`Interview Q&A — \${bank.label} (\${cat})\\nQ: \${q.q}\\nA: \${answer}\`,
              metadata: {
                source: "interview_training",
                bank: bankId,
                category: cat,
                type: "qa_pair",
              },
            });
          }
        });
      });
    });
    return chunks;
  };

  const ingestToPinecone = async () => {
    setIngesting(true);
    const chunks = buildVectorChunks();
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunks: chunks.map(c => c.text),
          metadata: { source: "interview_training", type: "qa_pair" },
        }),
      });
      const data = await res.json();
      if (data.success) setIngestDone(true);
    } catch (e) {
      alert("Make sure your Next.js /api/ingest route is running");
    }
    setIngesting(false);
  };

  const currentCategories = bank.categories;
  const activeCat = activeCategory || Object.keys(currentCategories)[0];
  const currentQs = currentCategories[activeCat] || [];

  return (
    <div style={{ minHeight: "100vh", background: "#08080a", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{\`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#1e293b}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%,100%{opacity:0.5}50%{opacity:1}}
        .fade-up{animation:fadeUp 0.3s ease forwards}
        .shimmer{animation:shimmer 1.2s ease-in-out infinite}
        textarea{resize:vertical}
        textarea:focus,input:focus{outline:none}
        .btn{border:none;cursor:pointer;font-family:inherit;letter-spacing:1px;transition:all 0.2s}
      \`}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #0f172a", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#08080a", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "1px" }}>
            INTERVIEW TRAINING
          </div>
          <div style={{ fontSize: "9px", color: "#334155", letterSpacing: "3px", marginTop: "2px" }}>HIRING MANAGER + AI SCREENING · PINECONE RAG</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "10px", color: "#334155" }}>
            <span style={{ color: "#22d3ee" }}>{completedCount}</span>/{totalQ} answers ready
          </div>
          <div style={{ background: "#0f172a", height: "6px", width: "120px", borderRadius: "0" }}>
            <div style={{ height: "100%", width: \`\${(completedCount / totalQ) * 100}%\`, background: "#22d3ee", transition: "width 0.3s" }} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: "1px solid #0f172a", display: "flex", background: "#08080a" }}>
        {[["train", "TRAIN ANSWERS"], ["export", "EXPORT TO PINECONE"]].map(([id, label]) => (
          <button key={id} className="btn" onClick={() => setTab(id)}
            style={{ padding: "10px 20px", fontSize: "10px", letterSpacing: "2px", color: tab === id ? "#22d3ee" : "#334155", borderBottom: tab === id ? "2px solid #22d3ee" : "2px solid transparent", background: "transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {/* TRAIN TAB */}
      {tab === "train" && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", height: "calc(100vh - 90px)" }}>

          {/* Sidebar */}
          <div style={{ borderRight: "1px solid #0f172a", overflowY: "auto", background: "#050508" }}>
            {/* Bank switcher */}
            <div style={{ padding: "12px" }}>
              {Object.entries(QUESTION_BANKS).map(([id, b]) => (
                <button key={id} className="btn" onClick={() => { setActiveBank(id); setActiveCategory(Object.keys(b.categories)[0]); }}
                  style={{ width: "100%", padding: "10px 12px", marginBottom: "6px", background: activeBank === id ? \`\${b.color}22\` : "transparent", border: \`1px solid \${activeBank === id ? b.color : "#0f172a"}\`, color: activeBank === id ? b.accent : "#475569", fontSize: "11px", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{b.icon}</span>
                  <div>
                    <div style={{ fontWeight: activeBank === id ? 600 : 400 }}>{b.label}</div>
                    <div style={{ fontSize: "9px", color: "#334155", marginTop: "2px" }}>
                      {Object.values(b.categories).flat().length} questions
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #0f172a", padding: "12px" }}>
              <div style={{ fontSize: "9px", color: "#334155", letterSpacing: "2px", marginBottom: "8px" }}>CATEGORIES</div>
              {Object.keys(bank.categories).map(cat => {
                const qs = bank.categories[cat];
                const done = qs.filter(q => answers[q.id]?.trim().length > 20).length;
                return (
                  <button key={cat} className="btn" onClick={() => setActiveCategory(cat)}
                    style={{ width: "100%", padding: "9px 12px", marginBottom: "4px", background: activeCat === cat ? "#0f172a" : "transparent", border: \`1px solid \${activeCat === cat ? bank.color : "transparent"}\`, color: activeCat === cat ? bank.accent : "#475569", fontSize: "10px", textAlign: "left", lineHeight: 1.4 }}>
                    <div>{cat}</div>
                    <div style={{ fontSize: "9px", color: "#334155", marginTop: "2px" }}>{done}/{qs.length} done</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main content */}
          <div style={{ overflowY: "auto", padding: "24px 28px" }}>
            <div style={{ fontSize: "9px", color: "#334155", letterSpacing: "3px", marginBottom: "20px" }}>
              {bank.icon} {bank.label.toUpperCase()} · {activeCat?.toUpperCase()}
            </div>

            {currentQs.map((item, i) => {
              const ans = answers[item.id] || "";
              const isEditing = editingId === item.id;
              const isDone = ans.trim().length > 20;

              return (
                <div key={item.id} className="fade-up" style={{ marginBottom: "24px", border: \`1px solid \${isDone ? "#0f2a1a" : "#0f172a"}\`, borderLeft: \`3px solid \${isDone ? "#22c55e" : bank.color}\`, background: "#050508" }}>
                  {/* Question */}
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #0f172a", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flex: 1 }}>
                      <span style={{ fontSize: "9px", color: bank.accent, letterSpacing: "1px", minWidth: "24px", marginTop: "2px" }}>Q{i + 1}</span>
                      <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.7 }}>{item.q}</div>
                    </div>
                    <div style={{ fontSize: "9px", color: isDone ? "#22c55e" : "#334155", flexShrink: 0 }}>
                      {isDone ? "✓ READY" : "EMPTY"}
                    </div>
                  </div>

                  {/* Answer */}
                  <div style={{ padding: "16px 20px" }}>
                    {isEditing ? (
                      <textarea value={ans} onChange={e => setAnswers(p => ({ ...p, [item.id]: e.target.value }))}
                        rows={5} style={{ width: "100%", background: "#0a0a10", border: \`1px solid \${bank.color}\`, color: "#94a3b8", fontFamily: "inherit", fontSize: "12px", padding: "12px", lineHeight: 1.8 }} />
                    ) : (
                      <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.9, fontStyle: ans ? "normal" : "italic" }}>
                        {ans || "Click Edit to add your answer..."}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
                      <button className="btn" onClick={() => setEditingId(isEditing ? null : item.id)}
                        style={{ background: isEditing ? bank.color : "transparent", color: isEditing ? "#08080a" : bank.accent, border: \`1px solid \${bank.color}\`, padding: "6px 14px", fontSize: "9px" }}>
                        {isEditing ? "✓ SAVE" : "EDIT"}
                      </button>
                      <button className="btn" onClick={() => improveWithAI(item.id, item.q)}
                        disabled={generating[item.id]}
                        style={{ background: "transparent", color: generating[item.id] ? "#334155" : "#a78bfa", border: \`1px solid \${generating[item.id] ? "#1e293b" : "#a78bfa"}\`, padding: "6px 14px", fontSize: "9px" }}
                        className={generating[item.id] ? "shimmer" : ""}>
                        {generating[item.id] ? "IMPROVING..." : "✨ AI IMPROVE"}
                      </button>
                      <button className="btn" onClick={() => testAnswer(item.q, ans)}
                        disabled={!ans}
                        style={{ background: "transparent", color: ans ? "#fbbf24" : "#334155", border: \`1px solid \${ans ? "#fbbf24" : "#1e293b"}\`, padding: "6px 14px", fontSize: "9px" }}>
                        ▶ TEST
                      </button>
                      <button className="btn" onClick={() => setAnswers(p => ({ ...p, [item.id]: item.defaultA }))}
                        style={{ background: "transparent", color: "#334155", border: "1px solid #0f172a", padding: "6px 14px", fontSize: "9px" }}>
                        RESET
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EXPORT TAB */}
      {tab === "export" && (
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "36px 24px" }} className="fade-up">
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>Export to Pinecone</div>
          <div style={{ fontSize: "11px", color: "#475569", marginBottom: "32px" }}>
            Embed all {buildVectorChunks().length} Q&A pairs into your Pinecone vector DB — your voice AI will pull these during live calls.
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "28px" }}>
            {Object.entries(QUESTION_BANKS).map(([id, b]) => {
              const qs = Object.values(b.categories).flat();
              const done = qs.filter(q => answers[q.id]?.trim().length > 20).length;
              return (
                <div key={id} style={{ border: \`1px solid \${b.color}33\`, padding: "16px", background: \`\${b.color}08\` }}>
                  <div style={{ fontSize: "9px", color: b.accent, letterSpacing: "2px", marginBottom: "8px" }}>{b.icon} {b.label.toUpperCase()}</div>
                  <div style={{ fontSize: "20px", fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#e2e8f0" }}>{done}</div>
                  <div style={{ fontSize: "9px", color: "#334155" }}>of {qs.length} ready</div>
                </div>
              );
            })}
          </div>

          {/* Vector chunks preview */}
          <div style={{ border: "1px solid #0f172a", marginBottom: "24px" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #0f172a", fontSize: "9px", color: "#334155", letterSpacing: "3px" }}>
              CHUNK PREVIEW ({buildVectorChunks().length} TOTAL)
            </div>
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {buildVectorChunks().slice(0, 5).map((chunk, i) => (
                <div key={i} style={{ padding: "14px 18px", borderBottom: "1px solid #0a0a10", fontSize: "10px", color: "#475569", lineHeight: 1.8 }}>
                  <div style={{ fontSize: "9px", color: "#22d3ee", marginBottom: "6px", letterSpacing: "1px" }}>
                    CHUNK {i + 1} · {chunk.metadata.bank.toUpperCase()} · {chunk.metadata.category}
                  </div>
                  {chunk.text.slice(0, 200)}...
                </div>
              ))}
              <div style={{ padding: "12px 18px", fontSize: "10px", color: "#334155", textAlign: "center" }}>
                + {Math.max(0, buildVectorChunks().length - 5)} more chunks
              </div>
            </div>
          </div>

          {/* Ingest button */}
          <button className="btn" onClick={ingestToPinecone} disabled={ingesting || ingestDone}
            style={{ width: "100%", padding: "18px", background: ingestDone ? "#0f2a1a" : ingesting ? "#0f172a" : "#22d3ee", color: ingestDone ? "#22c55e" : ingesting ? "#334155" : "#08080a", fontSize: "12px", fontWeight: 700, letterSpacing: "2px", marginBottom: "16px" }}
            className={ingesting ? "shimmer btn" : "btn"}>
            {ingestDone ? "✓ INGESTED INTO PINECONE" : ingesting ? "EMBEDDING + STORING..." : \`⚡ INGEST \${buildVectorChunks().length} CHUNKS INTO PINECONE\`}
          </button>

          {ingestDone && (
            <div style={{ background: "#0f2a1a", border: "1px solid #166534", padding: "16px 20px", fontSize: "11px", color: "#22c55e", lineHeight: 1.8 }}>
              ✓ All Q&A pairs are now in Pinecone.<br />
              Your voice AI will automatically retrieve the most relevant answer when a recruiter asks a question during a live call.<br />
              <span style={{ color: "#15803d" }}>Next call will be smarter — the learning loop is active.</span>
            </div>
          )}

          {/* Manual curl fallback */}
          <div style={{ border: "1px solid #0f172a", padding: "20px", marginTop: "20px" }}>
            <div style={{ fontSize: "9px", color: "#334155", letterSpacing: "3px", marginBottom: "14px" }}>MANUAL CURL (if button fails)</div>
            <pre style={{ fontSize: "10px", color: "#475569", lineHeight: 1.8, overflowX: "auto", whiteSpace: "pre-wrap" }}>{\`curl -X POST http://localhost:3001/api/ingest \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "chunks": \${JSON.stringify(buildVectorChunks().slice(0, 2).map(c => c.text), null, 2)},
    "metadata": {
      "source": "interview_training",
      "type": "qa_pair"
    }
  }'\`}</pre>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {testMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#0d0d12", border: "1px solid #1e293b", padding: "32px", maxWidth: "580px", width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontSize: "9px", color: "#334155", letterSpacing: "3px", marginBottom: "16px" }}>HIRING MANAGER FEEDBACK</div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "20px", lineHeight: 1.7, borderLeft: "2px solid #22d3ee", paddingLeft: "14px" }}>
              {testQ}
            </div>
            {testLoading ? (
              <div style={{ fontSize: "12px", color: "#334155" }} className="shimmer">Evaluating your answer...</div>
            ) : (
              <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.9 }}>{testResponse}</div>
            )}
            <button className="btn" onClick={() => setTestMode(false)}
              style={{ marginTop: "24px", background: "transparent", border: "1px solid #1e293b", color: "#475569", padding: "10px 20px", fontSize: "10px", letterSpacing: "2px" }}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
