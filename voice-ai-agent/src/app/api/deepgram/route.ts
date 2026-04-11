import { createClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
    const projectId = process.env.DEEPGRAM_PROJECT_ID || "";
    
    if (!projectId) {
      console.warn("DEEPGRAM_PROJECT_ID missing, falling back to direct API proxy warning");
      // For immediate dev testing without Project ID, you can pass the original key, 
      // but warn the user. In true prod, ALWAYS use vendor keys.
      return NextResponse.json({ key: process.env.DEEPGRAM_API_KEY });
    }

    const { result, error }: any = await deepgram.manage.createProjectKey(
      projectId,
      {
        comment: "temp_browser_stt",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 3600, // 1 hour temporary token
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ key: result.key });
  } catch (error: any) {
    console.error("Deepgram Vendor Error:", error);
    return NextResponse.json({ error: "Failed to provision Deepgram token" }, { status: 500 });
  }
}
