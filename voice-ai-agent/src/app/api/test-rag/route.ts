import { querySimilar } from "@/lib/pinecone";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const context = await querySimilar("tell me about your Kafka experience", 3);
    return NextResponse.json({ success: true, context });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
