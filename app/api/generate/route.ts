import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getIndexContentForTable } from "@/lib/parser";
import { canAccessSection } from "@/lib/tiers";
import { generatePlan } from "@/lib/ai/provider";
import mammoth from "mammoth";
import { authOptions } from "@/lib/auth";

const MAX_DOCUMENT_CHARS = 18000;

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  if (name.endsWith(".pdf")) {
    try {
      return await extractTextFromPdf(buf);
    } catch (e) {
      console.warn("PDF extraction error for", file.name, e instanceof Error ? e.message : e);
      return "";
    }
  }
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value || "";
  }
  if (name.endsWith(".txt")) return buf.toString("utf-8");
  return buf.toString("utf-8");
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let prompt = "";
    let tenderText = "";
    let technicalSpecText = "";
    let projectName = "";
    let client = "";
    let location = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      prompt = formData.get("prompt")?.toString() || "";
      projectName = formData.get("projectName")?.toString() || "";
      client = formData.get("client")?.toString() || "";
      location = formData.get("location")?.toString() || "";

      const tenderFile = formData.get("tenderDocument") as File | null;
      const technicalSpecFile = formData.get("technicalSpecification") as File | null;
      if (tenderFile?.size) {
        try {
          tenderText = await extractTextFromFile(tenderFile);
        } catch (e) {
          console.warn("Tender document extraction failed:", e);
        }
      }
      if (technicalSpecFile?.size) {
        try {
          technicalSpecText = await extractTextFromFile(technicalSpecFile);
        } catch (e) {
          console.warn("Technical specification extraction failed:", e);
        }
      }
    } else if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      prompt = body?.prompt || "";
    }

    if (!prompt && !tenderText && !technicalSpecText) {
      return errorResponse("MISSING_INPUT", "Project brief or at least one document is required", 400);
    }

    const truncate = (s: string, max: number) =>
      s.length <= max ? s : s.slice(0, max) + "\n\n[Document truncated for length.]";

    const profileParts = [
      projectName ? `Project name: ${projectName}` : "",
      client ? `Client: ${client}` : "",
      location ? `Location: ${location}` : "",
    ].filter(Boolean);

    const combinedInput = [
      profileParts.length ? `PROJECT PROFILE:\n${profileParts.join("\n")}` : "",
      prompt ? `PROJECT BRIEF:\n${prompt}` : "",
      tenderText ? `TENDER DOCUMENT (from client):\n${truncate(tenderText, MAX_DOCUMENT_CHARS)}` : "",
      technicalSpecText ? `TECHNICAL SPECIFICATION (from client):\n${truncate(technicalSpecText, MAX_DOCUMENT_CHARS)}` : "",
    ].filter(Boolean).join("\n\n");

    const result = await generatePlan(combinedInput);

    if (!result.success) {
      const status = result.code === "AUTH_ERROR" ? 401 : result.code === "RATE_LIMIT" ? 429 : 502;
      return errorResponse(result.code, result.message, status);
    }

    const parsed = result.data;
    const rawIndex = parsed.index;
    if (typeof rawIndex === "string" && (rawIndex.trim().startsWith("{") || rawIndex.includes('"background"'))) {
      parsed.index = getIndexContentForTable(rawIndex);
    }

    const session = await getServerSession(authOptions);
    const tier = (session?.user as { plan?: "FREE" | "PRO" } | undefined)?.plan ?? "FREE";
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (canAccessSection(key, tier)) {
        filtered[key] = value;
      }
    }
    const planData = Object.keys(filtered).length > 0 ? filtered : parsed;

    return NextResponse.json({ success: true, data: planData, tier });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Generate API error:", error);
    return errorResponse(
      "SERVER_ERROR",
      err?.message || "Internal server error",
      500
    );
  }
}
