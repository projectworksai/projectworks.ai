import { NextResponse } from "next/server";
import { getQualityGateConfig } from "@/lib/ai/sections";

export async function GET() {
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev) {
    return NextResponse.json(
      { success: false, code: "NOT_FOUND", message: "Not found" },
      { status: 404 }
    );
  }

  const config = getQualityGateConfig();
  const effectiveMaxRetries =
    config.enabled && config.strictRetryEnabled ? config.maxRetries : 0;

  return NextResponse.json(
    {
      success: true,
      environment: process.env.NODE_ENV || "unknown",
      resolved: {
        ...config,
        effectiveMaxRetries,
      },
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
