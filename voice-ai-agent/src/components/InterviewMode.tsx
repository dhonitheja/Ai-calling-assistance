"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function InterviewMode() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm the AI Hiring Manager. I can simulate a technical or behavioral interview for the Full Stack or AI Engineer roles. What kind of interview would you like to practice today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Proxies securely to our /api/claude endpoint instead of api.anthropic.com
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useRAG: true,
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          system: "You are a tough but fair technical hiring manager interviewing a candidate for an AI Engineering / Full Stack Java role. Ask them one question at a time. Push back if their answers are too shallow.",
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Proxy error");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content[0].text },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble connecting to the AI." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh] bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <h2 className="text-white font-mono font-bold tracking-wide">MOCK INTERVIEW SIMULATOR</h2>
        </div>
        <div className="text-zinc-500 font-mono text-xs border border-zinc-700 px-2 py-1 rounded bg-zinc-800">
          Proxy: /api/claude
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] p-4 rounded-xl font-mono text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-emerald-600 text-emerald-50 rounded-br-none"
                  : "bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-bl-none"
              }`}
            >
              <div className="text-[10px] opacity-50 mb-1 uppercase tracking-wider font-bold">
                {msg.role === "assistant" ? "Interviewer" : "You (Sai Teja)"}
              </div>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-xl rounded-bl-none">
              <div className="flex gap-2 items-center">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Type your response..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-md font-mono font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            SEND
          </button>
        </form>
      </div>
    </div>
  );
}
