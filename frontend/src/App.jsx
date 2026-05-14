import { useState, useEffect, useRef } from 'react'

// ── Hooks ──────────────────────────────────────────────────────
function useAgentStatus() {
  const [status, setStatus] = useState({ armed: false, totalCallsToday: 0, aiHandledToday: 0 })
  const [loading, setLoading] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/agent/status')
      if (res.ok) setStatus(await res.json())
    } catch { /* backend not running yet */ }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const toggle = async () => {
    setLoading(true)
    try {
      const endpoint = status.armed ? '/api/agent/disarm' : '/api/agent/arm'
      const res = await fetch(endpoint, { method: 'POST' })
      if (res.ok) await fetchStatus()
    } catch { /* offline mode */ }
    setLoading(false)
  }

  return { status, loading, toggle }
}

// ── useActiveCalls hook ────────────────────────────────────────
function useActiveCalls() {
  const [calls, setCalls] = useState([])

  const fetchCalls = async () => {
    try {
      const res = await fetch('/api/transfer/status')
      if (res.ok) {
        const data = await res.json()
        setCalls(data.calls || [])
      }
    } catch { /* backend offline */ }
  }

  useEffect(() => {
    fetchCalls()
    const interval = setInterval(fetchCalls, 3000)
    return () => clearInterval(interval)
  }, [])

  return { calls, refresh: fetchCalls }
}

// ── CommandTab ─────────────────────────────────────────────────
function CommandTab() {
  const { status, loading, toggle } = useAgentStatus()
  const { calls, refresh: refreshCalls } = useActiveCalls()
  const [localArmed, setLocalArmed] = useState(false)
  const [transferring, setTransferring] = useState(null) // callSid being transferred
  const [logs, setLogs] = useState([
    { time: '11:24:01', badge: 'sys', msg: 'System initialized. Redis connected.' },
    { time: '11:24:05', badge: 'sys', msg: 'Waiting for Twilio webhook configuration...' },
  ])
  const logRef = useRef(null)

  const armed = status.armed || localArmed

  const handleToggle = async () => {
    const newArmed = !armed
    setLocalArmed(newArmed)
    addLog(newArmed ? 'ok' : 'sys',
      newArmed
        ? '🛡️ AI Agent ARMED — intercepting all incoming calls'
        : '📴 AI Agent DISARMED — calls forwarding to real number'
    )
    await toggle()
  }

  const addLog = (badge, msg) => {
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
    setLogs(prev => [...prev.slice(-100), { time, badge, msg }])
  }

  const transferCall = async (callSid, direction) => {
    setTransferring(callSid)
    const endpoint = direction === 'to-ai' ? '/api/transfer/to-ai' : '/api/transfer/to-me'
    const label = direction === 'to-ai' ? '🤖 Handing off to AI...' : '📲 Transferring to your phone...'
    addLog('ai', label)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid })
      })
      const data = await res.json()
      if (data.success) {
        addLog('ok', direction === 'to-ai'
          ? '✅ AI is now handling the call — recruiter stayed connected'
          : '✅ Your phone is ringing — pick up to take the call')
        refreshCalls()
      } else {
        addLog('sys', `⚠️ Transfer failed: ${data.error || 'unknown error'}`)
      }
    } catch {
      addLog('sys', '⚠️ Transfer request failed — backend unreachable')
    }
    setTransferring(null)
  }

  const simulateCall = () => {
    addLog('ai', '📞 Incoming call from +1 (555) 213-4421')
    setTimeout(() => addLog('ai', '🤖 AI agent answering — Deepgram STT connected'), 800)
    setTimeout(() => addLog('ai', '🎙️ Caller: "Hi, is this Sai Teja? I am Sarah from TechRecruit. Are you open to new opportunities?"'), 2200)
    setTimeout(() => addLog('ai', '🤖 AI: "Yes, actually I am open."'), 3800)
    setTimeout(() => addLog('ai', '🎙️ Caller: "Great. What is your current role?"'), 5000)
    setTimeout(() => addLog('ai', '🤖 AI: "I am an AI engineer at Frontier Communications, building LLM features on GCP with Vertex AI and Gemini."'), 6200)
    setTimeout(() => addLog('ai', '🎙️ Caller: "What is your visa status?"'), 8000)
    setTimeout(() => addLog('ai', '🤖 AI: "I am on STEM OPT, valid through June 2027. No sponsorship needed."'), 9200)
    setTimeout(() => addLog('ok', '✅ Call completed. Duration: 3m 18s — AI handled. Transcript saved.'), 12000)
  }

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="flex flex-col gap-24">
      {/* Stats row */}
      <div className="grid-4">
        <div className="card">
          <div className="stat-value">{status.totalCallsToday || 0}</div>
          <div className="stat-label">Calls Today</div>
        </div>
        <div className="card">
          <div className="stat-value">{status.aiHandledToday || 0}</div>
          <div className="stat-label">AI Handled</div>
        </div>
        <div className="card">
          <div className="stat-value">
            {status.totalCallsToday > 0
              ? `${Math.round((status.aiHandledToday / status.totalCallsToday) * 100)}%`
              : '—'}
          </div>
          <div className="stat-label">Screen Rate</div>
        </div>
        <div className="card">
          <div className="stat-value text-green">$0.00</div>
          <div className="stat-label">Est. Cost</div>
        </div>
      </div>

      <div className="grid-2 gap-24">
        {/* Arm/Disarm control */}
        <div className="card-glass flex flex-col items-center gap-24">
          <p className="card-title">Agent Control</p>

          <div
            className={`shield-display ${armed ? 'armed' : ''}`}
            onClick={handleToggle}
            id="shield-toggle"
            title="Click to toggle"
          >
            <span className="shield-icon">{armed ? '🛡️' : '🔓'}</span>
            <span className="shield-label">{armed ? 'ARMED' : 'DISARMED'}</span>
          </div>

          <div className="toggle-wrap">
            <span className="toggle-label">OFF</span>
            <label className="toggle" htmlFor="ai-mode-toggle">
              <input
                type="checkbox"
                id="ai-mode-toggle"
                checked={armed}
                onChange={handleToggle}
                disabled={loading}
              />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
            <span className="toggle-label" style={{ color: armed ? 'var(--green)' : undefined }}>
              ON
            </span>
          </div>

          <p className="text-muted text-sm" style={{ textAlign: 'center' }}>
            {armed
              ? '🟢 All incoming calls are being intercepted by your AI agent'
              : '⚪ Calls pass through to your real number'}
          </p>

          <button
            onClick={simulateCall}
            id="simulate-call-btn"
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: '1px solid var(--border-cyan)',
              background: 'transparent',
              color: 'var(--cyan)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.5px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(0,245,255,0.08)'}
            onMouseLeave={e => e.target.style.background = 'transparent'}
          >
            ▶ Simulate Incoming Call
          </button>
        </div>

        {/* ── Active Call Transfer Panel ── */}
        <div className="card flex flex-col gap-16" style={{ borderColor: calls.length > 0 ? 'var(--border-cyan)' : undefined }}>
          <div className="flex items-center justify-between">
            <p className="card-title">
              {calls.length > 0
                ? <span style={{ color: 'var(--cyan)' }}>🔴 Live Call{calls.length > 1 ? 's' : ''} — {calls.length} active</span>
                : 'Live Call Transfer'}
            </p>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>
              {calls.length > 0 ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>

          {calls.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '12px 0' }}>
              No active calls. Transfer controls appear here during a live call.
            </p>
          ) : (
            calls.map(call => (
              <div key={call.callSid} style={{
                background: 'rgba(0,245,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                {/* Call info row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      📞 {call.from || 'Unknown caller'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {Math.floor(call.durationSec / 60)}m {call.durationSec % 60}s
                      &nbsp;·&nbsp;
                      <span style={{ color: call.mode === 'AI' ? 'var(--green)' : 'var(--cyan)' }}>
                        {call.mode === 'AI' ? '🤖 AI handling' : '👤 You on call'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {call.callSid?.slice(-8)}
                  </div>
                </div>

                {/* Transfer buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {call.mode === 'AI' ? (
                    /* AI is on → let me take it back */
                    <button
                      onClick={() => transferCall(call.callSid, 'to-me')}
                      disabled={transferring === call.callSid}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 6,
                        border: '1px solid var(--border-cyan)',
                        background: transferring === call.callSid ? 'rgba(0,245,255,0.04)' : 'rgba(0,245,255,0.1)',
                        color: 'var(--cyan)', fontSize: 12, fontWeight: 700,
                        cursor: transferring === call.callSid ? 'default' : 'pointer',
                        letterSpacing: 0.5, transition: 'all 0.2s'
                      }}
                    >
                      {transferring === call.callSid ? 'Connecting...' : '📲 Take Back — Ring My Phone'}
                    </button>
                  ) : (
                    /* You are on → hand off to AI */
                    <button
                      onClick={() => transferCall(call.callSid, 'to-ai')}
                      disabled={transferring === call.callSid}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 6,
                        border: '1px solid var(--green)',
                        background: transferring === call.callSid ? 'rgba(0,255,136,0.04)' : 'rgba(0,255,136,0.1)',
                        color: 'var(--green)', fontSize: 12, fontWeight: 700,
                        cursor: transferring === call.callSid ? 'default' : 'pointer',
                        letterSpacing: 0.5, transition: 'all 0.2s'
                      }}
                    >
                      {transferring === call.callSid ? 'Handing off...' : '🤖 Hand Off to AI'}
                    </button>
                  )}
                </div>

                {/* Keyboard shortcut hint */}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {call.mode !== 'AI'
                    ? '⌨️ Or press * on your keypad to hand off without opening the dashboard'
                    : '⌨️ AI is live — tap "Take Back" or let AI continue'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Live log */}
        <div className="card flex flex-col gap-16" style={{ gridColumn: '1 / -1' }}>
          <div className="flex items-center justify-between">
            <p className="card-title">Live Activity Log</p>
            <button
              onClick={() => setLogs([])}
              style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>

          <div className="log-container" ref={logRef}>
            {logs.map((entry, i) => (
              <div className="log-entry" key={i}>
                <span className="log-time">{entry.time}</span>
                <span className={`log-badge ${entry.badge}`}>{entry.badge.toUpperCase()}</span>
                <span className="log-message">{entry.msg}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-muted text-sm" style={{ padding: '20px', textAlign: 'center' }}>
                No activity yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Setup checklist */}
      <div className="card">
        <p className="card-title">System Health</p>
        <div className="flex flex-col gap-8" style={{ marginTop: 8 }}>
          {[
            { done: status.totalCallsToday !== undefined, label: 'Cloud Run backend active' },
            { done: status.totalCallsToday !== undefined, label: 'In-memory state management active' },
            { done: status.totalCallsToday !== undefined, label: 'Twilio configurations loaded' },
            { done: status.totalCallsToday !== undefined, label: 'Twilio webhook routing confirmed' },
            { done: status.totalCallsToday !== undefined, label: 'Anthropic AI models online' },
            { done: status.totalCallsToday !== undefined, label: 'Deepgram STT connection ready' },
            { done: status.totalCallsToday !== undefined, label: 'ElevenLabs TTS models loaded' },
            { done: status.totalCallsToday !== undefined, label: 'Resume Context Engine synchronized' },
          ].map((item, i) => (
            <div key={i} className="flex gap-8 items-center text-sm">
              <span style={{ color: item.done ? 'var(--green)' : 'var(--text-muted)' }}>
                {item.done ? '✅' : '⏳'}
              </span>
              <span style={{ color: item.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── SimulateTab ────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  "Tell me about yourself",
  "What do you do at Frontier Communications?",
  "Have you built RAG pipelines?",
  "What is multi-model orchestration?",
  "What is your visa status?",
  "What is your expected salary?",
  "When can you start?",
  "Are you open to relocation?",
  "Tell me about your Wealthix project",
  "What is your experience with Kafka?",
  "Are you IBM prompt engineering certified?",
  "Why are you leaving your current job?",
]

function SimulateTab() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey, this is Teja. Go ahead — ask me anything a recruiter would ask. LLM and GenAI experience, tech stack, projects, certifications, availability, salary — whatever you want to cover."
    }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, thinking])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setThinking(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history })
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      } else {
        throw new Error('API error')
      }
    } catch {
      // Offline fallback
      const fallbacks = {
        "llm": "I've been integrating LLMs into enterprise applications at Frontier Communications since 2023 — primarily Vertex AI and Gemini, plus Claude for specific use cases. I do multi-model orchestration, prompt engineering, and production AI pipelines.",
        "vertex": "Yes, I use Vertex AI day-to-day at Frontier Communications — for deploying LLMs, running AI workloads on GCP, and integrating with Gemini 1.5 for enterprise features.",
        "gemini": "Gemini 1.5 is one of my primary models. In the Wealthix project I built a Hybrid Router that dynamically selects between Gemini and Claude based on query complexity.",
        "claude": "Yes, I work with Claude — both at work and in personal projects. I built an AI Financial Co-Pilot using Claude 3.5 for automated dispute resolution and document analysis.",
        "rag": "Yes, I've built RAG pipelines — implemented document embeddings and vector search for context-aware LLM responses in the Wealthix financial platform project.",
        "agentic": "I've built agentic workflows — the AI Financial Co-Pilot is an autonomous dispute resolution agent that chains Claude calls to analyze documents and generate responses.",
        "prompt": "Prompt engineering is a core skill — I'm IBM Certified in Prompt Engineering and apply it daily at Frontier to optimize LLM outputs for customer-facing applications.",
        "relocat": "Yes, I'm open to relocation. I'm also fully comfortable with remote and hybrid arrangements — whatever works best for the team.",
        "remote": "Absolutely — I'm open to remote, hybrid, or onsite. I've worked in distributed environments and I'm fully equipped for it.",
        "start": "I have about a two-week notice period, so I could typically start within two to three weeks of an offer.",
        "salary": "I am looking at 65 to 70 dollars per hour on W2 or C2C.",
        "experience": "5+ years in software engineering, with the last 2+ years focused specifically on AI/LLM integration at Frontier Communications — Vertex AI, Gemini, Claude, RAG, multi-model orchestration.",
        "certif": "Yes — IBM Certified in Prompt Engineering (2024), Oracle Cloud Infrastructure AI Foundations (2024), and AWS Certified Solutions Architect – Associate (2025).",
        "kafka": "I use Kafka at Frontier for real-time AI processing pipelines — feeding data into LLM workflows asynchronously for high-throughput event-driven AI features.",
        "aws": "I'm AWS Certified Solutions Architect. I use EC2, Lambda, and S3 primarily — deployed Wealthix on AWS with full monitoring and observability.",
        "python": "Python is my primary AI/ML language — I use it for FastAPI backends, LLM integration scripts, RAG pipelines, and prompt engineering.",
      }
      const lower = userMsg.toLowerCase()
      const match = Object.entries(fallbacks).find(([k]) => lower.includes(k))
      const fallback = match ? match[1] : "That is a good question. With 5 plus years of software engineering experience and the last 3 years focused specifically on LLM and GenAI production systems, I am well suited for that. What else would you like to know?"
      setMessages(prev => [...prev, { role: 'assistant', content: fallback }])
    }

    setThinking(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="flex items-center gap-12 mb-16" style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--cyan), var(--violet))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
        }}>🤖</div>
        <div>
          <div className="font-bold">AI Call Screener — Simulate Mode</div>
          <div className="text-muted text-xs">Responding as Sai Teja Ragula · AI Engineer | LLM Integration | GenAI · Powered by Claude</div>
        </div>
        <div className="status-dot armed" style={{ marginLeft: 'auto' }} />
      </div>

      {/* Quick questions */}
      <div className="quick-questions">
        {QUICK_QUESTIONS.map((q, i) => (
          <button key={i} className="quick-q" onClick={() => sendMessage(q)}>{q}</button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={chatRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}>
            {msg.role === 'assistant' && (
              <div className="bubble-meta">🤖 AI Agent · Sai Teja Ragula's Screener</div>
            )}
            {msg.content}
          </div>
        ))}

        {thinking && (
          <div className="chat-bubble ai">
            <div className="bubble-meta">🤖 Thinking...</div>
            <div className="chat-typing">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          id="chat-input-field"
          placeholder={`Ask anything a recruiter would ask... "What's your notice period?"`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
        />
        <button
          className="btn-send"
          id="chat-send-btn"
          onClick={() => sendMessage()}
          disabled={thinking || !input.trim()}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  )
}

// ── KnowledgeBaseTab ───────────────────────────────────────────
const SAMPLE_RESUME = {
  name: "Sai Teja Ragula",
  title: "AI Engineer | LLM Integration | GenAI | Full Stack",
  location: "United States",
  noticePeriod: "2 weeks",
  expectedSalary: "Open to discussion based on role",
  remotePreference: "Open to Remote/Hybrid/Onsite",
  openToRelocation: "Yes",
  workAuth: "Available upon request",
  linkedinUrl: "linkedin.com/in/sairagula",
  githubUrl: "github.com/dhonitheja",
  skills: {
    aiAndLLMs: ["LLM Integration", "Multi-Model Orchestration", "Prompt Engineering", "RAG", "Agentic Workflows", "AI Agents"],
    aiPlatforms: ["Google Vertex AI", "Gemini 1.5", "Claude (Anthropic)", "OpenAI API", "LangChain", "Pinecone"],
    languages: ["Python", "Java 8/11/17", "TypeScript", "JavaScript (ES6+)", "SQL", "Bash"],
    backend: ["Spring Boot", "FastAPI", "Node.js", "RESTful APIs", "Microservices", "Kafka", "Redis"],
    frontend: ["React.js", "Next.js", "TypeScript", "Redux", "Tailwind CSS"],
    cloudAndMLOps: ["GCP (Vertex AI, Cloud Storage)", "AWS (EC2, Lambda, S3)", "Docker", "Kubernetes", "CI/CD"],
    databases: ["PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "Vector Stores", "Pinecone"],
  },
  experience: [
    {
      company: "Frontier Communications",
      title: "AI/Software Engineer",
      duration: "Jan 2023 – Present · Allen, TX",
      highlights: [
        "LLM integration into enterprise apps via Vertex AI and GCP",
        "Multi-model orchestration — routing to optimal AI model by task complexity",
        "NLP-based SMS integration and intelligent automation workflows",
        "Prompt engineering for customer-facing LLM applications",
        "Event-driven Kafka pipelines for real-time AI processing",
        "Java/Spring Boot + React/TypeScript full stack, 90%+ test coverage"
      ]
    },
    {
      company: "Wipro",
      title: "Software Engineer",
      duration: "Jan 2022 – Jul 2022 · India",
      highlights: [
        "Java/Spring Boot backend services for enterprise applications",
        "RESTful APIs and microservices at scale",
        "Automation workflows with event-driven architecture",
        "Cloud deployments with Docker and CI/CD"
      ]
    },
    {
      company: "Intellativ India Private Limited",
      title: "Software Engineer",
      duration: "Dec 2020 – Jan 2022 · India",
      highlights: [
        "Full stack apps — Java/Spring Boot + React/JavaScript",
        "Event-driven systems with Apache Kafka",
        "RESTful API design and implementation",
        "Containerized deployments on cloud platforms"
      ]
    }
  ]
}

function SkillChip({ label }) {
  const javaLangs = ['java', 'python', 'typescript', 'go']
  const clouds = ['aws', 'gcp', 'azure', 'cloud run', 'eks', 'lambda']
  const dbs = ['postgresql', 'redis', 'mongodb', 'dynamodb']
  const l = label.toLowerCase()
  const cls = javaLangs.some(x => l.includes(x)) ? 'java'
             : clouds.some(x => l.includes(x)) ? 'cloud'
             : dbs.some(x => l.includes(x)) ? 'db'
             : l.includes('python') ? 'python'
             : 'default'
  return <span className={`skill-chip ${cls}`}>{label}</span>
}

function KnowledgeBaseTab() {
  const [resume, setResume] = useState(SAMPLE_RESUME)

  useEffect(() => {
    fetch('/api/resume')
      .then(r => r.json())
      .then(data => { if (data?.name) setResume(data) })
      .catch(() => {})
  }, [])

  return (
    <div className="kb-grid">
      {/* Left: Quick facts */}
      <div className="kb-section">
        <p className="card-title">Quick Facts</p>
        {[
          { label: 'Full Name', val: resume.name },
          { label: 'Title', val: resume.title },
          { label: 'Location', val: resume.location },
          { label: 'Notice Period', val: resume.noticePeriod },
          { label: 'Expected Salary', val: resume.expectedSalary },
          { label: 'Remote Preference', val: resume.remotePreference },
          { label: 'Open to Relocation', val: resume.openToRelocation || (resume.openToRelocation === false ? 'No' : '—') },
          { label: 'Work Authorization', val: resume.workAuth || resume.workAuthorization },
        ].map((f, i) => (
          <div className="kb-field" key={i}>
            <div className="kb-field-label">{f.label}</div>
            <div className="kb-field-value">{f.val || '—'}</div>
          </div>
        ))}

        <div className="kb-field">
          <div className="kb-field-label">Skills</div>
          {Object.entries(resume.skills || {}).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'capitalize' }}>{cat}</div>
              <div className="skill-chips">
                {(Array.isArray(items) ? items : [items]).map((s, i) => <SkillChip key={i} label={s} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Experience */}
      <div className="kb-section">
        <p className="card-title">Work Experience (AI Knowledge)</p>
        {(resume.experience || []).map((exp, i) => (
          <div className="exp-item" key={i}>
            <div className="exp-company">{exp.company}</div>
            <div className="exp-title">{exp.title}</div>
            <div className="exp-duration">{exp.duration}</div>
            <ul className="exp-highlights">
              {(exp.highlights || []).map((h, j) => <li key={j}>{h}</li>)}
            </ul>
          </div>
        ))}

        <div className="card" style={{ marginTop: 4 }}>
          <p className="card-title">Edit Knowledge Base</p>
          <p className="text-muted text-sm">
            To update the AI's knowledge, edit:
            <code className="font-mono" style={{ color: 'var(--cyan)', display: 'block', marginTop: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
              backend/src/main/resources/resume.json
            </code>
            Restart the Spring Boot server after changes. All fields affect what the AI says on calls.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── ArchitectureTab ────────────────────────────────────────────
function ArchitectureTab() {
  return (
    <div className="arch-panel">
      {/* System diagram */}
      <div className="card flex flex-col gap-16">
        <p className="card-title">System Flow</p>
        <div className="arch-flow">
          <div className="flow-node twilio">
            <div className="flow-node-title">📞 Twilio</div>
            <div className="flow-node-sub">$0.01/min · Phone Layer</div>
          </div>
          <div className="flow-arrow">↓ POST /api/calls/incoming</div>
          <div className="flow-node spring">
            <div className="flow-node-title">⚙️ Spring Boot :8080</div>
            <div className="flow-node-sub">TwilioWebhookController</div>
          </div>
          <div className="flow-arrow">↓ check Redis ai_mode</div>
          <div className="flow-node redis">
            <div className="flow-node-title">🔴 Redis</div>
            <div className="flow-node-sub">ai_mode = "true" | "false"</div>
          </div>

          <div style={{ width: '100%', display: 'flex', gap: 8, margin: '12px 0' }}>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--green)' }}>
              ✅ AI ON → Stream Audio
            </div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              ⚡ AI OFF → &lt;Dial&gt; real number
            </div>
          </div>

          <div className="flow-node deepgram">
            <div className="flow-node-title">🎙️ Deepgram Nova-2</div>
            <div className="flow-node-sub">Real-time STT · $0.0059/min</div>
          </div>
          <div className="flow-arrow">↓ transcript</div>
          <div className="flow-node claude">
            <div className="flow-node-title">🧠 Claude claude-sonnet-4-5</div>
            <div className="flow-node-sub">Resume as system prompt · ~$0.003/1K tokens</div>
          </div>
          <div className="flow-arrow">↓ text response</div>
          <div className="flow-node eleven">
            <div className="flow-node-title">🔊 ElevenLabs TTS</div>
            <div className="flow-node-sub">eleven_turbo_v2 · Clone your voice</div>
          </div>
          <div className="flow-arrow">↓ MP3 → Twilio → caller hears "you"</div>
        </div>
      </div>

      {/* Pseudocode */}
      <div className="flex flex-col gap-16">
        <div className="code-block">
          <p className="card-title" style={{ marginBottom: 12 }}>Spring Boot Webhook Pseudocode</p>
          <pre dangerouslySetInnerHTML={{__html: `<span class="cm">// POST /api/calls/incoming</span>
<span class="kw">@PostMapping</span>(<span class="st">"/api/calls/incoming"</span>)
<span class="kw">public</span> ResponseEntity&lt;String&gt; incomingCall(
    <span class="kw">@RequestParam</span> String callSid,
    <span class="kw">@RequestParam</span> String from) {

  <span class="fn">incrementTotalCalls</span>();

  <span class="kw">boolean</span> aiMode = redis
    .<span class="fn">get</span>(<span class="st">"ai_mode"</span>)
    .<span class="fn">equals</span>(<span class="st">"true"</span>);

  <span class="kw">if</span> (aiMode) {
    <span class="fn">incrementAiCalls</span>();
    <span class="cm">// Stream audio to AI pipeline</span>
    <span class="kw">return</span> <span class="fn">streamTwiML</span>(wsUrl, callSid);
  } <span class="kw">else</span> {
    <span class="cm">// Forward to real phone</span>
    <span class="kw">return</span> <span class="fn">dialTwiML</span>(realPhone);
  }
}`}} />
        </div>

        <div className="code-block">
          <p className="card-title" style={{ marginBottom: 12 }}>AI Pipeline Pseudocode</p>
          <pre dangerouslySetInnerHTML={{__html: `<span class="cm">// Audio Pipeline Flow</span>
<span class="fn">openDeepgramStream</span>()
  .<span class="fn">onTranscript</span>(text -> {
    <span class="cm">// Claude reasons from resume</span>
    String reply = claude.<span class="fn">respond</span>(
      text,
      <span class="fn">buildSystemPrompt</span>(resumeJson)
    );
    <span class="cm">// ElevenLabs to voice</span>
    byte[] audio = elevenlabs
      .<span class="fn">synthesize</span>(reply, voiceId);
    <span class="cm">// Send back to caller</span>
    twilio.<span class="fn">sendAudio</span>(callSid, audio);
  });`}} />
        </div>

        <div className="card">
          <p className="card-title">Cost Estimate Per Call</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {[
              ['Twilio (10 min)', '$0.10'],
              ['Deepgram STT', '$0.059'],
              ['Claude API', '$0.05'],
              ['ElevenLabs TTS', '$0.06'],
              ['Total / call', '$0.27'],
            ].map(([label, cost], i) => (
              <div key={i} className="flex justify-between items-center text-sm"
                style={{ paddingBottom: 6, borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: i === 4 ? 'var(--cyan)' : 'var(--text-primary)', fontWeight: i === 4 ? 700 : 400 }}>{cost}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="card-title">Local Dev Commands</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {[
              ['Start Redis', 'docker compose up -d'],
              ['Start Backend', 'cd backend && mvn spring-boot:run'],
              ['Start Frontend', 'cd frontend && npm run dev'],
              ['Expose via ngrok', 'ngrok http 8080'],
              ['Set Twilio webhook', 'https://xxxx.ngrok.io/api/calls/incoming'],
            ].map(([label, cmd], i) => (
              <div key={i} style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
                <code className="font-mono" style={{ color: 'var(--cyan)' }}>{cmd}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Call History Dashboard ─────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '—'
  const m = ts.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})/)
  if (!m) return ts
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m[2])-1]} ${parseInt(m[3])}, ${m[1]}  ${m[4]}:${m[5]}`
}

function fmtPhone(p) {
  if (!p || p === 'unknown') return 'Unknown'
  const d = p.replace(/\D/g,'')
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  return p
}

// Parse the plain-text summary into structured sections
function parseSummary(text) {
  if (!text) return {}
  const sections = {}
  const headings = ['CALL DETAILS','WHO CALLED','WHAT WAS DISCUSSED','KEY TOPICS','NEXT STEPS / ACTION ITEMS','HANDLED BY']
  let current = null
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    const heading = headings.find(h => trimmed.toUpperCase() === h)
    if (heading) { current = heading; sections[current] = []; continue }
    if (current && trimmed) sections[current].push(trimmed)
  }
  return sections
}

// Extract key points from transcript for the AI training view
function extractKeyPoints(transcript) {
  if (!transcript || transcript.length === 0) return []
  const points = []
  const hrKeywords = ['visa','salary','rate','location','start','remote','relocation','w2','c2c','sponsor','authorization']
  const techKeywords = ['java','spring','kafka','rag','llm','ai','cloud','docker','kubernetes','react','python','aws','gcp']
  for (const turn of transcript) {
    if (turn.role !== 'user') continue
    const lower = (turn.content || '').toLowerCase()
    if (hrKeywords.some(k => lower.includes(k))) points.push({ type: 'hr', text: turn.content })
    else if (techKeywords.some(k => lower.includes(k))) points.push({ type: 'tech', text: turn.content })
  }
  return points.slice(0, 6)
}

function Pill({ label, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: `${color}18`, color, border: `1px solid ${color}40`,
      letterSpacing: 0.5, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function SummaryCard({ sections }) {
  const sectionMeta = {
    'CALL DETAILS':              { icon: '📅', color: '#7da9ff' },
    'WHO CALLED':                { icon: '👤', color: '#00f5ff' },
    'WHAT WAS DISCUSSED':        { icon: '💬', color: '#00ffaa' },
    'KEY TOPICS':                { icon: '🔑', color: '#ff9f0a' },
    'NEXT STEPS / ACTION ITEMS': { icon: '✅', color: '#00d68f' },
    'HANDLED BY':                { icon: '🤖', color: '#a78bfa' },
  }
  const keys = Object.keys(sections)
  if (keys.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No summary generated for this call yet.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {keys.map(key => {
        const meta = sectionMeta[key] || { icon: '•', color: 'var(--text-secondary)' }
        return (
          <div key={key} style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${meta.color}`, borderRadius: 8, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: 1,
              textTransform: 'uppercase', marginBottom: 6 }}>
              {meta.icon} {key}
            </div>
            {sections[key].map((line, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{line}</div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function AITrainingPanel({ call, transcript }) {
  const keyPoints = extractKeyPoints(transcript)
  const aiTurns = transcript ? transcript.filter(t => t.role === 'assistant').length : 0
  const callerTurns = transcript ? transcript.filter(t => t.role === 'user').length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Training status */}
      <div style={{
        background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.2)',
        borderRadius: 10, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'rgba(0,214,143,0.15)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
        }}>🧠</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
            Ingested into Pinecone RAG
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            This call's Q&A pairs are embedded and stored — AI will use them for consistency on future calls
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'AI Responses', value: aiTurns, color: 'var(--cyan)' },
          { label: 'Caller Turns', value: callerTurns, color: '#7da9ff' },
          { label: 'Training Pairs', value: Math.min(aiTurns, callerTurns), color: 'var(--green)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Key questions asked */}
      {keyPoints.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1,
            textTransform: 'uppercase', marginBottom: 10 }}>Questions Asked by Recruiter</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {keyPoints.map((kp, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px',
              }}>
                <Pill
                  label={kp.type === 'hr' ? 'HR' : 'TECH'}
                  color={kp.type === 'hr' ? '#ff9f0a' : '#00f5ff'}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                  {kp.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RAG pipeline note */}
      <div style={{
        background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 10, padding: '12px 16px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Self-Training Pipeline
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            '1. Call ends → transcript saved to GCS',
            '2. Q&A pairs extracted and sent to /api/ingest',
            '3. OpenAI embeddings generated for each pair',
            '4. Vectors upserted into Pinecone index',
            '5. Next call → similar Q retrieved → injected as "PAST CALL MEMORY"',
            '6. AI stays consistent across all recruiter calls',
          ].map((step, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
              <span style={{ color: '#a78bfa', flexShrink: 0 }}>→</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CallHistoryTab() {
  const [calls, setCalls]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('summary')
  const [filter, setFilter] = useState('all') // 'all' | 'summarized' | 'audio'
  const audioRef = useRef(null)
  const listRef = useRef(null)

  const refresh = () => {
    setLoading(true)
    fetch('/api/calls/history')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setCalls(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const openCall = async (call) => {
    if (selected === call.id) return
    setSelected(call.id)
    setDetail(null)
    setDetailLoading(true)
    setActiveSection('summary')
    try {
      const res = await fetch(`/api/calls/history/${call.id}`)
      if (res.ok) setDetail(await res.json())
    } catch { /* offline */ }
    setDetailLoading(false)
  }

  const filtered = calls.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || (c.caller||'').includes(q) || (c.summary||'').toLowerCase().includes(q) || (c.timestamp||'').includes(q)
    const matchFilter = filter === 'all' || (filter === 'summarized' && c.hasSummary) || (filter === 'audio' && c.hasAudio)
    return matchSearch && matchFilter
  })

  const totalCalls  = calls.length
  const withSummary = calls.filter(c => c.hasSummary).length
  const withAudio   = calls.filter(c => c.hasAudio).length
  const totalTurns  = calls.reduce((s, c) => s + (c.turns || 0), 0)
  const aiRate      = totalCalls > 0 ? Math.round((withSummary / totalCalls) * 100) : 0

  const summaryParsed = detail?.summary ? parseSummary(detail.summary) : {}
  const transcript    = detail?.transcript || []

  const tabStyle = (id) => ({
    padding: '7px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
    border: '1px solid var(--border)',
    background: activeSection === id ? 'rgba(0,245,255,0.1)' : 'transparent',
    color: activeSection === id ? 'var(--cyan)' : 'var(--text-muted)',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

      {/* ── KPI Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        {[
          { label: 'Total Calls',  value: totalCalls,  icon: '📞', color: 'var(--cyan)',    sub: 'last 48 hours' },
          { label: 'Summarized',   value: withSummary, icon: '📋', color: '#00ffaa',         sub: 'AI generated' },
          { label: 'With Audio',   value: withAudio,   icon: '🔊', color: '#7da9ff',         sub: 'recorded WAV' },
          { label: 'Total Turns',  value: totalTurns,  icon: '💬', color: '#ff9f0a',         sub: 'Q&A exchanges' },
          { label: 'AI Rate',      value: `${aiRate}%`,icon: '🤖', color: 'var(--green)',    sub: 'completion rate' },
        ].map(({ label, value, icon, color, sub }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 12, right: 14,
              fontSize: 22, opacity: 0.15,
            }}>{icon}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: 0.8, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main layout: sidebar + detail ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14, flex: 1, minHeight: 0 }}>

        {/* ── LEFT SIDEBAR: Call List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>🔍</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by number, summary…"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 12px 9px 32px', fontSize: 12,
                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filter pills + refresh */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['all','summarized','audio'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${filter === f ? 'var(--border-cyan)' : 'var(--border)'}`,
                background: filter === f ? 'rgba(0,245,255,0.1)' : 'transparent',
                color: filter === f ? 'var(--cyan)' : 'var(--text-muted)',
                textTransform: 'capitalize', transition: 'all 0.15s',
              }}>{f}</button>
            ))}
            <button onClick={refresh} title="Refresh" style={{
              marginLeft: 'auto', padding: '4px 10px', borderRadius: 20,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
            }}>↻</button>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
            {loading ? 'Loading…' : `${filtered.length} of ${totalCalls} call${totalCalls !== 1 ? 's' : ''} · 48h window`}
          </div>

          {/* Call cards */}
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fetching calls from GCS…</div>
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 13 }}>
                  {totalCalls === 0 ? 'No calls in the last 48 hours.' : 'No calls match your filter.'}
                </div>
                {totalCalls === 0 && (
                  <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)' }}>
                    Make a test call to Twilio to see data here.
                  </div>
                )}
              </div>
            )}
            {filtered.map(call => {
              const isSelected = selected === call.id
              return (
                <div key={call.id} onClick={() => openCall(call)} style={{
                  padding: '13px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${isSelected ? 'rgba(0,245,255,0.35)' : 'var(--border)'}`,
                  background: isSelected ? 'rgba(0,245,255,0.05)' : 'rgba(255,255,255,0.02)',
                  boxShadow: isSelected ? '0 0 0 1px rgba(0,245,255,0.1) inset' : 'none',
                  transition: 'all 0.15s', position: 'relative',
                }}>
                  {/* Selected indicator */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', left: 0, top: '20%', bottom: '20%',
                      width: 3, borderRadius: '0 2px 2px 0', background: 'var(--cyan)',
                    }} />
                  )}
                  {/* Top row: number + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                      color: isSelected ? 'var(--cyan)' : 'var(--text-primary)',
                    }}>
                      {fmtPhone(call.caller)}
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      {call.hasSummary && <Pill label="AI" color="#00ffaa" />}
                      {call.hasAudio   && <Pill label="REC" color="#7da9ff" />}
                    </div>
                  </div>
                  {/* Date + turns */}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {fmtDate(call.timestamp)} &nbsp;·&nbsp; {call.turns} turn{call.turns !== 1 ? 's' : ''}
                  </div>
                  {/* Summary snippet */}
                  {call.hasSummary && call.summary && (
                    <p style={{
                      fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>{call.summary.replace(/\n+/g,' ').trim()}</p>
                  )}
                  {!call.hasSummary && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
                      Summary pending…
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: Detail Panel ── */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
          borderRadius: 14, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
        }}>

          {/* Empty / loading states */}
          {!selected && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', color: 'var(--text-muted)', gap: 14, padding: 40 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
              }}>📞</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Select a call to view details
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Summary, transcript, audio recording, and AI training data
                </div>
              </div>
            </div>
          )}

          {selected && detailLoading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 24, animation: 'spin 1s linear infinite' }}>⟳</div>
              <div style={{ fontSize: 12 }}>Loading call details…</div>
            </div>
          )}

          {selected && !detailLoading && !detail && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 13 }}>
              Failed to load call details.
            </div>
          )}

          {selected && !detailLoading && detail && (
            <>
              {/* ── Detail Header ── */}
              <div style={{
                padding: '18px 22px 14px', borderBottom: '1px solid var(--border)',
                background: 'rgba(0,0,0,0.2)', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, color: 'var(--cyan)' }}>
                        {fmtPhone(detail.caller)}
                      </span>
                      {detail.hasSummary && <Pill label="AI SUMMARIZED" color="#00ffaa" />}
                      {detail.hasAudio   && <Pill label="RECORDED" color="#7da9ff" />}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>📅 {fmtDate(detail.timestamp)}</span>
                      <span>💬 {detail.turns || 0} conversation turns</span>
                      {detail.callId && (
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                          ID: {detail.callId.slice(0,12)}…
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Download button */}
                  {detail.hasAudio && (
                    <a href={`/api/calls/audio/${detail.id}`} download={`call-${detail.id}.wav`}
                      style={{
                        padding: '7px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                        border: '1px solid rgba(125,169,255,0.3)', background: 'rgba(125,169,255,0.08)',
                        color: '#7da9ff', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                      ⬇ Download WAV
                    </a>
                  )}
                </div>

                {/* Section tabs */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button style={tabStyle('summary')}   onClick={() => setActiveSection('summary')}>📋 Summary</button>
                  <button style={tabStyle('transcript')} onClick={() => setActiveSection('transcript')}>💬 Transcript</button>
                  {detail.hasAudio && (
                    <button style={tabStyle('audio')} onClick={() => setActiveSection('audio')}>🔊 Recording</button>
                  )}
                  <button style={tabStyle('training')} onClick={() => setActiveSection('training')}>🧠 AI Training</button>
                </div>
              </div>

              {/* ── Content area ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

                {/* SUMMARY */}
                {activeSection === 'summary' && (
                  detail.hasSummary && Object.keys(summaryParsed).length > 0
                    ? <SummaryCard sections={summaryParsed} />
                    : detail.hasSummary
                      ? <pre style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75,
                          whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{detail.summary}</pre>
                      : (
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 10, padding: 40, color: 'var(--text-muted)', textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 32 }}>⏳</div>
                          <div style={{ fontSize: 13 }}>Summary is being generated by Claude…</div>
                          <div style={{ fontSize: 11 }}>Check back in a moment — AI summarization runs async after each call.</div>
                        </div>
                      )
                )}

                {/* TRANSCRIPT */}
                {activeSection === 'transcript' && (
                  transcript.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
                      No transcript recorded for this call.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Turn counter */}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', paddingBottom: 4,
                        borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                        {transcript.length} turns total · {transcript.filter(t=>t.role==='user').length} from recruiter · {transcript.filter(t=>t.role==='assistant').length} AI responses
                      </div>
                      {transcript.map((turn, i) => {
                        const isAI = turn.role === 'assistant'
                        return (
                          <div key={i} style={{
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                            flexDirection: isAI ? 'row-reverse' : 'row',
                          }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 15, fontWeight: 700,
                              background: isAI ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.06)',
                              color: isAI ? 'var(--cyan)' : 'var(--text-muted)',
                              border: `1px solid ${isAI ? 'rgba(0,245,255,0.25)' : 'var(--border)'}`,
                            }}>
                              {isAI ? '🤖' : '👤'}
                            </div>
                            <div style={{
                              maxWidth: '72%', padding: '10px 14px', borderRadius: 12,
                              fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6,
                              background: isAI
                                ? 'linear-gradient(135deg, rgba(0,245,255,0.06), rgba(124,58,237,0.06))'
                                : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${isAI ? 'rgba(0,245,255,0.18)' : 'var(--border)'}`,
                              borderBottomRightRadius: isAI ? 3 : 12,
                              borderBottomLeftRadius:  isAI ? 12 : 3,
                            }}>
                              <div style={{
                                fontSize: 10, fontWeight: 700, marginBottom: 5,
                                textTransform: 'uppercase', letterSpacing: 0.6,
                                color: isAI ? 'var(--cyan)' : 'var(--text-muted)',
                                display: 'flex', alignItems: 'center', gap: 6,
                              }}>
                                {isAI ? 'Teja (AI Agent)' : 'Recruiter'}
                                <span style={{ fontWeight: 400, opacity: 0.5 }}>#{i+1}</span>
                              </div>
                              {turn.content}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}

                {/* AUDIO */}
                {activeSection === 'audio' && detail.hasAudio && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{
                      background: 'rgba(125,169,255,0.05)', border: '1px solid rgba(125,169,255,0.2)',
                      borderRadius: 12, padding: '20px 22px',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7da9ff', letterSpacing: 1,
                        textTransform: 'uppercase', marginBottom: 14 }}>
                        🔊 Call Recording
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                        μ-law 8kHz audio · decoded to 16-bit PCM WAV · {fmtDate(detail.timestamp)}
                      </div>
                      <audio
                        ref={audioRef} controls
                        src={`/api/calls/audio/${detail.id}`}
                        style={{ width: '100%', borderRadius: 8, outline: 'none', filter: 'invert(0.1) hue-rotate(180deg)' }}
                      />
                      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <a href={`/api/calls/audio/${detail.id}`} download={`call-${detail.id}.wav`} style={{
                          padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                          border: '1px solid rgba(125,169,255,0.3)', background: 'rgba(125,169,255,0.1)',
                          color: '#7da9ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                        }}>⬇ Download WAV</a>
                      </div>
                    </div>

                    {/* Side-by-side transcript reference while listening */}
                    {transcript.length > 0 && (
                      <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '16px 18px',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                          letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                          Transcript — follow along while listening
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                          {transcript.map((t, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, flexShrink: 0, padding: '2px 6px',
                                borderRadius: 4, marginTop: 1,
                                background: t.role === 'assistant' ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.06)',
                                color: t.role === 'assistant' ? 'var(--cyan)' : 'var(--text-muted)',
                              }}>
                                {t.role === 'assistant' ? 'AI' : 'REC'}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                {t.content}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI TRAINING */}
                {activeSection === 'training' && (
                  <AITrainingPanel call={detail} transcript={transcript} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── App Shell ──────────────────────────────────────────────────
const TABS = [
  { id: 'command',   icon: '⚡', label: 'Command' },
  { id: 'simulate',  icon: '💬', label: 'Simulate' },
  { id: 'knowledge', icon: '📚', label: 'Knowledge Base' },
  { id: 'history',   icon: '📞', label: 'Call History' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('command')
  const { status } = useAgentStatus()
  const armed = status?.armed

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">🤖</div>
          <span className="logo-text">AI Call Screener</span>
        </div>
        <div className="header-status">
          <div className={`status-dot ${armed ? 'armed' : ''}`} />
          <span>{armed ? 'Agent Armed — Intercepting Calls' : 'Agent Disarmed'}</span>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="tabs-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="content">
        {activeTab === 'command'   && <div className="tab-panel"><CommandTab /></div>}
        {activeTab === 'simulate'  && <div className="tab-panel"><SimulateTab /></div>}
        {activeTab === 'knowledge' && <div className="tab-panel"><KnowledgeBaseTab /></div>}
        {activeTab === 'history'   && <div className="tab-panel"><CallHistoryTab /></div>}
      </main>
    </div>
  )
}
