import { upsertChunks } from "@/lib/pinecone";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { chunks, metadata } = await req.json();
    const count = await upsertChunks(chunks, metadata);
    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
