import { upsertChunks } from "@/lib/pinecone";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { chunks, metadata } = await req.json();
    if (!Array.isArray(chunks) || chunks.length === 0 || chunks.some((chunk) => typeof chunk !== "string" || !chunk.trim())) {
      return NextResponse.json({ error: "chunks must be a non-empty string array" }, { status: 400 });
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return NextResponse.json({ error: "metadata object required" }, { status: 400 });
    }
    const count = await upsertChunks(chunks, metadata);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
