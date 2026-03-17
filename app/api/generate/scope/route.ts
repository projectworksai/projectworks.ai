import { NextResponse } from "next/server";
import { generateSection } from "@/lib/ai/sections";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const projectPrompt = body?.projectPrompt ?? "";
    if (!projectPrompt || typeof projectPrompt !== "string") {
      return NextResponse.json(
        { success: false, code: "MISSING_PROMPT", message: "projectPrompt is required" },
        { status: 400 }
      );
    }
    const result = await generateSection("scope", projectPrompt.trim());
    if (!result.success) {
      const status = result.code === "AUTH_ERROR" ? 401 : result.code === "RATE_LIMIT" ? 429 : 502;
      return NextResponse.json({ success: false, code: result.code, message: result.message }, { status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (e) {
    console.error("Generate scope error:", e);
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", message: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
