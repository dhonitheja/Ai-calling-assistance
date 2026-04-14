import { querySimilar } from "@/lib/pinecone";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/query
 * Body: { "question": "tell me about your RAG experience", "topK": 3 }
 * Returns: { "chunks": ["Q: ... A: ...", ...] }
 *
 * Called by the Java ClaudeService before every AI response to retrieve
 * the most relevant past call Q/A pairs from Pinecone as context.
 */
export async function POST(req: NextRequest) {
  try {
    const { question, topK = 3 } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }
    const chunks = await querySimilar(question.trim(), topK);
    return NextResponse.json({ chunks });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
