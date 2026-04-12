import { upsertChunks } from "@/lib/pinecone";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { chunks, metadata } = await req.json();
    const count = await upsertChunks(chunks, metadata);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
