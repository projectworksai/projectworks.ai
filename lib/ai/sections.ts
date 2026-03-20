import OpenAI from "openai";
import { detectProjectType } from "@/lib/project-type";

const MAX_RETRIES = 1;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  const provider = process.env.AI_PROVIDER || "openai";
  if (provider !== "openai" || !key) {
    throw new Error("AI_PROVIDER must be 'openai' and OPENAI_API_KEY must be set");
  }
  return new OpenAI({ apiKey: key });
}

export type SectionResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; code: string; message: string };

const SECTION_PROMPTS: Record<string, string> = {
  overview: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "summary": "2-3 sentence executive summary of the project",
  "objectives": ["objective 1", "objective 2", ...],
  "keyDeliverables": ["deliverable 1", ...],
  "budgetEstimate": "brief description or range, e.g. $1M or $800k-$1.2M",
  "budgetBreakdown": [{"item": "Cost category", "amount": "estimated amount/range", "basis": "estimation basis"}] or [],
  "durationWeeks": number or null,
  "scheduleBaseline": [{"phase": "phase name", "startWeek": number, "endWeek": number, "notes": "optional"}] or [],
  "keyAssumptions": ["assumption 1", ...]
}
Keep each field concise. durationWeeks should be a number or null.`,

  scope: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "scopeOfWork": "Detailed description of the scope of works (2-4 paragraphs)",
  "inclusions": ["inclusion 1", "inclusion 2", ...],
  "exclusions": ["exclusion 1", ...],
  "boundaries": "Description of project boundaries and interfaces",
  "acceptanceCriteria": ["criterion 1", ...] or []
}
Be specific to the project.`,

  schedule: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "phases": [{"name": "Phase name", "durationWeeks": number, "description": "short description"}, ...],
  "milestones": [{"name": "Milestone", "targetWeek": number, "deliverable": "what is delivered"}, ...],
  "criticalPathNotes": "Brief narrative on critical path and dependencies",
  "keyDates": [{"label": "date label", "week": number}, ...] or [],
  "tasks": [{"id": "1", "name": "Task name", "phase": "Phase name", "wbs": "1.1", "durationDays": number, "startOffsetDays": number, "dependencies": ["id of predecessor"]}, ...]
}
Include at least 3-5 phases and 3-5 milestones. tasks must be a flat list for MS Project/Primavera: id (string), name, phase, wbs, durationDays, startOffsetDays (days from project start), dependencies (array of predecessor task ids). Use numbers for durations and weeks.`,

  resources: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "roles": [{"role": "Role name", "count": number or 1, "responsibilities": "brief summary"}, ...],
  "equipment": [{"item": "Equipment/plant", "quantity": number or "as required", "notes": "optional"}, ...],
  "assumptions": ["resource assumption 1", ...],
  "organisationSummary": "Short narrative on resourcing approach"
}
Be practical and aligned with the project.`,

  procurement: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "items": [{"category": "e.g. Materials", "description": "item or category", "estimatedValue": "optional", "leadTimeWeeks": number or null}, ...],
  "assumptions": ["procurement assumption 1", ...],
  "keySuppliers": ["type or name", ...] or [],
  "procurementNotes": "Brief narrative on procurement strategy"
}
Include main procurement categories.`,

  risk: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "riskRegister": [
    {
      "id": "R1",
      "riskDescription": "Risk description",
      "cause": "Primary cause / trigger",
      "impact": "Impact if the risk occurs",
      "likelihood": 1,
      "severity": 1,
      "riskScore": 1,
      "mitigationStrategy": "Mitigation / response strategy",
      "owner": "Owner / role responsible"
    },
    ...
  ],
  "overallRiskSummary": "Brief narrative on key risks and approach",
  "contingencyNotes": "Optional contingency or reserve notes"
}
Constraints:
- Include 5-10 risks.
- likelihood and severity MUST be integers 1-5 (1 = lowest, 5 = highest).
- riskScore MUST equal likelihood * severity.
- Keep fields specific to the project and aligned with good construction/non-construction project practice.`,

  compliance: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "standards": [{"code": "e.g. AS 1234", "description": "what it applies to"}, ...],
  "checklists": [{"name": "Checklist or regime", "items": ["item 1", ...]}, ...] or [],
  "complianceNotes": "Brief narrative on compliance approach",
  "regulatoryRequirements": ["requirement 1", ...] or []
}
Reference relevant Australian/industry standards where applicable.`,

  qualityManagement: `You are a project management expert for construction. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "summary": "Brief overview of quality approach (1-2 paragraphs)",
  "objectives": ["quality objective 1", ...],
  "standards": ["e.g. AS/ISO or client standard", ...],
  "inspectionAndTest": ["ITP item or inspection activity", ...],
  "defectsManagement": "How defects and NCRs are managed",
  "qualityRecords": ["type of record to be maintained", ...]
}
Focus on construction project quality management (for non-construction, adapt to relevant QA/QC and acceptance processes).`,

  plantAndEquipment: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "summary": "Brief overview of plant and equipment strategy (1-2 paragraphs)",
  "equipment": [{"item": "Plant/equipment name", "quantity": number or "as required", "use": "brief use or phase", "notes": "optional"}],
  "majorPlant": ["key plant items with brief spec", ...],
  "maintenanceAndAvailability": "How maintenance and availability are ensured",
  "assumptions": ["assumption 1", ...]
}
Be specific to the project. If the project is non-construction, treat this section as tools/platforms/infrastructure/resources (still use the same JSON fields). If hybrid, include both.`,

  constructionMethodology: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "summary": "Executive summary of construction methodology (2-3 paragraphs)",
  "sequence": ["Step 1: description", "Step 2: description", ...],
  "keyMethods": [{"activity": "Activity name", "method": "How it will be done", "notes": "optional"}],
  "temporaryWorks": ["temporary works or staging requirement", ...],
  "interfaces": "Description of interfaces with existing assets, utilities, or other contractors",
  "constraints": ["constraint 1", ...]
}
Describe delivery methodology. If non-construction, adapt as delivery approach (agile/waterfall/hybrid) while preserving the JSON schema. If hybrid, combine both.`,

  safetyManagement: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "summary": "Brief overview of safety management approach (1-2 paragraphs)",
  "objectives": ["safety objective 1", ...],
  "hazards": [{"hazard": "description", "control": "control measure"}, ...],
  "swms": ["SWMS or high-risk activity", ...],
  "trainingAndInduction": "Training and induction requirements",
  "emergencyProcedures": "Brief emergency and incident response"
}
For construction projects: provide WHS/safety management (hazards, controls, SWMS/high-risk activities, training/induction, emergency procedures).
For non-construction projects: treat this as operational risk/incident management (operational hazards, controls, high-risk activities, readiness training, incident response).
For hybrid: include both.`,
};

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

export type SectionKey = keyof typeof SECTION_PROMPTS;

export async function generateSection(
  section: SectionKey,
  projectPrompt: string
): Promise<SectionResult> {
  const projectType = detectProjectType(projectPrompt);
  const adaptiveRules =
    projectType === "construction"
      ? `PROJECT_TYPE=construction. Provide construction-focused domain depth: plant/equipment logistics, method statements, WHS safety, and construction-grade risk responses.`
      : projectType === "non_construction"
        ? `PROJECT_TYPE=non_construction. Adapt domains: treat plant/equipment as tools/platforms/infrastructure; treat construction methodology as delivery approach; treat safety management as operational incident readiness. Focus risks on delivery/operations.`
        : `PROJECT_TYPE=hybrid. Combine construction and non-construction domains. Include both WHS-style safety and operational incident readiness where relevant.`;

  const frameworkAlignment =
    section === "overview"
      ? `FRAMEWORKS: PMBOK Integration/Initiating (Business case) and PRINCE2 Business Case theme.`
      : section === "scope"
        ? `FRAMEWORKS: PMBOK Scope/Requirements and PRINCE2 Plans.`
        : section === "schedule"
          ? `FRAMEWORKS: PMBOK Schedule/Timeline and PRINCE2 Plans.`
          : section === "resources"
            ? `FRAMEWORKS: PMBOK Resource/Team management and PRINCE2 Organization.`
            : section === "plantAndEquipment"
              ? `FRAMEWORKS: Project environment & capability (logistics/resources). For non-construction, map to required tools/platforms.`
              : section === "constructionMethodology"
                ? `FRAMEWORKS: PMBOK Execution approach and PRINCE2 Delivery approach.`
                : section === "qualityManagement"
                  ? `FRAMEWORKS: PMBOK Quality management and PRINCE2 Quality theme.`
                  : section === "procurement"
                    ? `FRAMEWORKS: PMBOK Procurement/Commercial strategy and PRINCE2 Commercial considerations.`
                    : section === "risk"
                      ? `FRAMEWORKS: PMBOK Risk management and PRINCE2 Risk theme.`
                      : section === "safetyManagement"
                        ? `FRAMEWORKS: Construction WHS or operational incident readiness, consistent with risk controls.`
                        : section === "compliance"
                          ? `FRAMEWORKS: PMBOK Governance controls and PRINCE2 Progress/Business governance themes.`
                          : `FRAMEWORKS: Align this section with relevant PMBOK/PRINCE2 themes.`;

  const systemPrompt = `${SECTION_PROMPTS[section]}\n\n${adaptiveRules}\n${frameworkAlignment}\n\nReturn ONLY valid JSON that matches the exact schema for this section. No markdown.`;
  if (!systemPrompt) {
    return { success: false, code: "INVALID_SECTION", message: `Unknown section: ${section}` };
  }

  const openai = getClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: projectPrompt },
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
