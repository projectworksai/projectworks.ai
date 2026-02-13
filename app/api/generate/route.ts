import { NextResponse } from "next/server";
import OpenAI from "openai";
import { safeJsonParse, getIndexContentForTable } from "@/lib/parser";
import pdf from "pdf-extraction";
import mammoth from "mammoth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "ProjectWorksAI"
  }
});

const MAX_DOCUMENT_CHARS = 18000;
// Stay within OpenRouter credits: default 1500 fits tight free-tier limits. Set OPENROUTER_MAX_TOKENS to override.
const MAX_TOKENS = Math.min(8192, Math.max(1024, parseInt(process.env.OPENROUTER_MAX_TOKENS || "1500", 10) || 1500));

// Token-saving: input is truncated per doc (see MAX_DOCUMENT_CHARS). For longer docs consider:
// - Two-phase: 1) summarize uploaded docs in a first call, 2) generate plan from summary + brief.
// - Chunking: split doc into chunks, summarize each, then pass chunk summaries to plan step.
// - Larger-context model via OpenRouter (e.g. Claude 100k) if available.
// See docs/TOKEN_AND_ALTERNATIVES.md for options including local Python LLM.

// ---- AI CALL WITH FALLBACK ----

async function callModel(model: string, prompt: string) {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `
You are the foremost project manager in the world. Your project plans set the standard. You produce comprehensive, submission-ready plans that leave nothing to chance. Write in detail: every section must be substantial (multiple paragraphs, 3–6+ where appropriate). No one-sentence summaries. Return ONLY valid JSON. No markdown. Escape quotes and newlines in strings (use \\n for newlines, \\" for quotes).

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
}
`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.4,
    max_tokens: MAX_TOKENS,
  });

  return response.choices[0].message?.content || "";
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  if (name.endsWith(".pdf")) {
    try {
      const data = await pdf(buf);
      return data.text || "";
    } catch (e) {
      console.warn("PDF extraction error for", file.name, e instanceof Error ? e.message : e);
      return "";
    }
  }
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value || "";
  }
  if (name.endsWith(".txt")) {
    return buf.toString("utf-8");
  }
  return buf.toString("utf-8");
}

function is402(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) return (error as { status: number }).status === 402;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("402") || msg.includes("credits");
}

async function generateProjectPlan(prompt: string) {
  try {
    return await callModel("anthropic/claude-3-haiku", prompt);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
    console.warn("Primary model (claude-3-haiku) failed:", errMsg, errCode ? `[${errCode}]` : "");
    if (is402(error)) {
      const e = error as Error & { status?: number };
      e.status = 402;
      throw e;
    }
    try {
      return await callModel("mistralai/mistral-7b-instruct", prompt);
    } catch (fallbackError: unknown) {
      if (is402(fallbackError)) {
        const e = fallbackError as Error & { status?: number };
        e.status = 402;
        throw e;
      }
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error("Fallback model also failed:", fallbackMsg);
      throw fallbackError;
    }
  }
}

// ---- API ROUTE ----

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let prompt = "";
    let tenderText = "";
    let technicalSpecText = "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      prompt = body?.prompt || "";
    }

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

    const rawOutput = await generateProjectPlan(combinedInput);

    const parsed = safeJsonParse(rawOutput);

    // Ensure index is always tabulated text, never raw JSON
    const rawIndex = parsed.index;
    if (typeof rawIndex === "string" && (rawIndex.trim().startsWith("{") || rawIndex.includes('"background"'))) {
      parsed.index = getIndexContentForTable(rawIndex);
    }

    return NextResponse.json({
      success: true,
      data: parsed
    });

  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    const isCreditsError = err.status === 402 || (err.message && (err.message.includes("402") || err.message.includes("credits")));
    const status = isCreditsError ? 402 : 500;
    const message = isCreditsError
      ? "Insufficient OpenRouter credits. Add credits at https://openrouter.ai/settings/credits or set OPENROUTER_MAX_TOKENS lower (e.g. 1500)."
      : (err.message || "Internal server error");
    if (status === 500) console.error("API ERROR:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
	



