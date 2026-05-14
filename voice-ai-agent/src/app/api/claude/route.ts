import { querySimilar } from "@/lib/pinecone";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 503 });
    }

    const body = await req.json();
    const { useRAG, messages, system, ...rest } = body;
    if (!Array.isArray(messages) || typeof system !== "string" || !system.trim()) {
      return NextResponse.json({ error: "messages and system are required" }, { status: 400 });
    }

    let enrichedSystem = system;

    if (useRAG && messages.length > 0) {
      const lastUser = [...messages]
        .reverse()
        .find((m) => m.role === "user")?.content;

      if (lastUser) {
        const context = await querySimilar(lastUser, 4);
        enrichedSystem = `${system}

RELEVANT CONTEXT FROM MY EXPERIENCE:
${context.join("\n")}

Use this context to answer more specifically and accurately.`;
      }
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...rest, messages, system: enrichedSystem }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
