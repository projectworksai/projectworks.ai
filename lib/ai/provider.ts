import OpenAI from "openai";

const MAX_RETRIES = 2;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  const provider = process.env.AI_PROVIDER || "openai";
  if (provider !== "openai" || !key) {
    throw new Error("AI_PROVIDER must be 'openai' and OPENAI_API_KEY must be set");
  }
  return new OpenAI({ apiKey: key });
}

export type PlanGenerationResult = { success: true; data: Record<string, unknown> } | { success: false; code: string; message: string };

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
- "projectReference": all applicable standards (Main Roads, AS, client specs); cite tender and technical spec where relevant.

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

function parseJsonFromContent(content: string): Record<string, unknown> | null {
  const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  const slice = cleaned.slice(start);
  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(slice.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export async function generatePlan(prompt: string): Promise<PlanGenerationResult> {
  const openai = getClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        lastError = new Error("Empty or invalid AI response");
        continue;
      }

      const parsed = parseJsonFromContent(content);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        return { success: true, data: parsed };
      }
      lastError = new Error("Invalid JSON structure from AI");
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  const message = lastError?.message || "AI generation failed";
  const code = message.includes("API key") || message.includes("401") ? "AUTH_ERROR" : message.includes("rate") ? "RATE_LIMIT" : "GENERATION_FAILED";
  return { success: false, code, message };
}
