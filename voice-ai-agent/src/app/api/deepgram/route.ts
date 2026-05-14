import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Return API key directly — for production use Deepgram temporary key API
  // via REST if needed. The SDK method createProjectKey was removed in v3.
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY not configured" }, { status: 500 });
  }
  return NextResponse.json({ key }, { headers: { "Cache-Control": "no-store" } });
}
