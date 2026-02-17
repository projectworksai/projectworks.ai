import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { safeJsonParse, getIndexContentForTable } from "@/lib/parser";
import { canAccessSection } from "@/lib/tiers";
import mammoth from "mammoth";
import { authOptions } from "@/lib/auth";

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";
const MAX_DOCUMENT_CHARS = 18000;
const MAX_TOKENS = Math.min(8192, Math.max(512, parseInt(process.env.OLLAMA_MAX_TOKENS || "4096", 10) || 4096));

const SYSTEM_PROMPT = `You are the foremost project manager in the world. Your project plans set the standard. You produce comprehensive, submission-ready plans that leave nothing to chance. Write in detail: every section must be substantial (multiple paragraphs, 3–6+ where appropriate). No one-sentence summaries. Return ONLY valid JSON. No markdown. Escape quotes and newlines in strings (use \\n for newlines, \\" for quotes).

INDEX: Tabulated table of contents with optional page numbers. One line per section. Format: Number TAB Section title TAB Page (e.g. "1\\tBackground\\t1", "2\\tScope\\t2"). Use page numbers 1, 2, 3... if known, or "—" for page. Include all main sections and appendices in order.

MAIN SECTIONS (use these exact keys; each value must be DETAILED plain text—several paragraphs, not short):
- "index": tabulated list (No. TAB Section name TAB Page), one line per section
- "background": full project background, client, objectives, constraints, context (detailed)
- "scope": comprehensive scope of works, inclusions, exclusions, boundaries, interfaces
- "projectOrganisationStructure": organisation chart narrative, roles, responsibilities, reporting lines, key personnel
- "plantAndEquipment": full list and description of plant, machinery, equipment, capacity, maintenance approach
- "constructionMethodStatement": methodology per work package/WBS; sequence, resources, quality and safety per activity; reference to tender/spec
- "qualityManagement": quality plan, standards, inspections, ITP, hold points, records, non-conformance process
- "riskManagement": risk process, risk matrix summary, key risks and mitigations; reference Appendix A
- "safetyManagement": safety plan, SWMS, inductions, PPE, emergency procedures, client requirements
- "constructionSchedule": narrative plus key phases and dates; reference Appendix B (Program)
- "projectReference": all applicable standards (Main Roads, AS, client specs); cite tender and technical spec where relevant. When Tender Document and/or Technical Specification are provided, explicitly refer to them and list standards they specify.

APPENDICES (detailed content, not one line):
- "appendixRiskMatrix": full risk matrix table content (risk description, likelihood, impact, rating, mitigation)
- "appendixProjectProgram": program summary, key dates, milestones, critical path notes
- "appendixInspectionAndTestPlan": ITP table or detailed inspection and test requirements
- "appendixReferenceNotes": reference list, document register, revision notes

JSON structure (every string value must be lengthy and detailed):
{
  "index": "1\\tBackground\\n2\\tScope\\n...",
  "background": "",
  "scope": "",
  "projectOrganisationStructure": "",
  "plantAndEquipment": "",
  "constructionMethodStatement": "",
  "qualityManagement": "",
  "riskManagement": "",
  "safetyManagement": "",
  "constructionSchedule": "",
  "projectReference": "",
  "appendixRiskMatrix": "",
  "appendixProjectProgram": "",
  "appendixInspectionAndTestPlan": "",
  "appendixReferenceNotes": ""
}`;

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

async function callOllama(prompt: string): Promise<string> {
  const url = `${OLLAMA_BASE}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: false,
      options: { num_predict: MAX_TOKENS },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
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
      const body = await req.json();
      prompt = body?.prompt || "";
    }

    if (!prompt && !tenderText && !technicalSpecText) {
      return NextResponse.json(
        { success: false, error: "Project brief or at least one document is required" },
        { status: 400 }
      );
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

    const rawOutput = await callOllama(combinedInput);
    if (!rawOutput || typeof rawOutput !== "string") {
      return NextResponse.json(
        { success: false, error: "AI model returned no content. Try again." },
        { status: 502 }
      );
    }
    const parsed = safeJsonParse(rawOutput);
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { success: false, error: "Could not parse plan. Try again with a clearer brief." },
        { status: 502 }
      );
    }

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
    const msg = String(err?.message || "Internal server error");
    const isConnectionError =
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      msg.includes("Failed to fetch") ||
      msg.includes("ENOTFOUND");

    const userMessage = isConnectionError
      ? "Cannot connect to Ollama. Ensure Ollama is running (ollama serve) and the model is pulled (e.g. ollama pull phi3:mini)."
      : msg;

    console.error("Generate API error:", error);
    return NextResponse.json(
      { success: false, error: userMessage },
      { status: isConnectionError ? 503 : 500 }
    );
  }
}
