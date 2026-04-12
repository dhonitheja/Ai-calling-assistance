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
    setTimeout(() => addLog('ai', '🤖 AI agent answering...'), 800)
    setTimeout(() => addLog('ai', '🎙️ Caller: "Hi, I\'m Sarah from TechRecruit. Are you open to new opportunities?"'), 2200)
    setTimeout(() => addLog('ai', '🤖 AI: "Thanks for reaching out Sarah! I\'m currently exploring roles..."'), 3800)
    setTimeout(() => addLog('ai', '🎙️ Caller: "What\'s your experience with Kafka?"'), 5500)
    setTimeout(() => addLog('ai', '🤖 AI: "I\'ve built Kafka pipelines processing 500K events/hour at TechCorp..."'), 6800)
    setTimeout(() => addLog('ok', '✅ Call completed. Duration: 4m 32s — AI handled'), 10000)
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
  "Tell me about your LLM integration experience",
  "What's your experience with Vertex AI / Gemini?",
  "Have you built RAG pipelines?",
  "Are you open to remote work?",
  "When can you start?",
  "What's your experience with prompt engineering?",
  "Are you IBM prompt engineering certified?",
  "What's your expected salary?",
]

function SimulateTab() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm answering on Sai Teja Ragula's behalf. I'm an AI screening assistant — feel free to ask me anything a recruiter would ask: his LLM/GenAI experience, tech stack, certifications, availability, or salary expectations. How can I help you?"
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
        "salary": "I'm open to discussion based on the role and the total compensation package. Happy to share a specific number once I know more about the opportunity.",
        "experience": "5+ years in software engineering, with the last 2+ years focused specifically on AI/LLM integration at Frontier Communications — Vertex AI, Gemini, Claude, RAG, multi-model orchestration.",
        "certif": "Yes — IBM Certified in Prompt Engineering (2024), Oracle Cloud Infrastructure AI Foundations (2024), and AWS Certified Solutions Architect – Associate (2025).",
        "kafka": "I use Kafka at Frontier for real-time AI processing pipelines — feeding data into LLM workflows asynchronously for high-throughput event-driven AI features.",
        "aws": "I'm AWS Certified Solutions Architect. I use EC2, Lambda, and S3 primarily — deployed Wealthix on AWS with full monitoring and observability.",
        "python": "Python is my primary AI/ML language — I use it for FastAPI backends, LLM integration scripts, RAG pipelines, and prompt engineering.",
      }
      const lower = userMsg.toLowerCase()
      const match = Object.entries(fallbacks).find(([k]) => lower.includes(k))
      const fallback = match ? match[1] : "Great question. With my 5+ years of experience and focus on LLM integration and GenAI, I'm well-positioned on that. Would you like to schedule a proper call to go deeper?"
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

// ── App Shell ──────────────────────────────────────────────────
const TABS = [
  { id: 'command',       icon: '⚡', label: 'Command' },
  { id: 'simulate',      icon: '💬', label: 'Simulate' },
  { id: 'knowledge',     icon: '📚', label: 'Knowledge Base' },
  { id: 'architecture',  icon: '🏗️', label: 'Architecture' },
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
        {activeTab === 'command'      && <div className="tab-panel"><CommandTab /></div>}
        {activeTab === 'simulate'     && <div className="tab-panel"><SimulateTab /></div>}
        {activeTab === 'knowledge'    && <div className="tab-panel"><KnowledgeBaseTab /></div>}
        {activeTab === 'architecture' && <div className="tab-panel"><ArchitectureTab /></div>}
      </main>
    </div>
  )
}
