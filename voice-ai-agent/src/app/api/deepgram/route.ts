import { DeepgramClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // @ts-expect-error - SDK type mismatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deepgram: any = new DeepgramClient(process.env.DEEPGRAM_API_KEY!);
    const projectId = process.env.DEEPGRAM_PROJECT_ID || "";
    
    if (!projectId) {
      console.warn("DEEPGRAM_PROJECT_ID missing, falling back to direct API proxy warning");
      return NextResponse.json({ key: process.env.DEEPGRAM_API_KEY });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result, error } = await deepgram.manage.createProjectKey(
      projectId,
      {
        comment: "temp_browser_stt",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 3600, 
      }
    );

    if (error) {
      return NextResponse.json({ error: error?.message }, { status: 500 });
    }

    return NextResponse.json({ key: result?.key });
  } catch (error) {
    console.error("Deepgram Vendor Error:", error);
    return NextResponse.json({ error: "Failed to provision Deepgram token" }, { status: 500 });
  }
}
