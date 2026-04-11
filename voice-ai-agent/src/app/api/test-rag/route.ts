import { querySimilar } from "@/lib/pinecone";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const context = await querySimilar("tell me about your Kafka experience", 3);
    return NextResponse.json({ success: true, context });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
