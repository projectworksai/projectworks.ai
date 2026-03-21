import OpenAI from "openai";
import { detectProjectType } from "@/lib/project-type";

export type QualityGateConfig = {
  profile: "dev" | "staging" | "prod";
  enabled: boolean;
  strictRetryEnabled: boolean;
  maxRetries: number;
  genericCheckEnabled: boolean;
  minOverviewSummaryChars: number;
  minOverviewObjectives: number;
  minOverviewBudgetBreakdown: number;
  minSchedulePhases: number;
  minScheduleMilestones: number;
  minScheduleTasks: number;
  minResourcesRoles: number;
  minResourcesLabour: number;
  minResourcesContacts: number;
  minOrganogramChars: number;
  minPlantItems: number;
  minQualityInspectionItems: number;
  minQualityHoldPoints: number;
  minQualityStandards: number;
  minRiskItems: number;
  minComplianceStandards: number;
  minComplianceReferences: number;
  minProcurementItems: number;
  minScopeChars: number;
};

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

function intFromEnv(value: string | undefined, fallback: number, min = 0, max = 999): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function getQualityProfile(): "dev" | "staging" | "prod" {
  const raw = (process.env.AI_SECTION_QUALITY_PROFILE || "staging").trim().toLowerCase();
  if (raw === "dev" || raw === "staging" || raw === "prod") return raw;
  return "staging";
}

function presetConfig(profile: "dev" | "staging" | "prod"): Omit<QualityGateConfig, "profile"> {
  if (profile === "dev") {
    return {
      enabled: true,
      strictRetryEnabled: false,
      maxRetries: 0,
      genericCheckEnabled: true,
      minOverviewSummaryChars: 70,
      minOverviewObjectives: 2,
      minOverviewBudgetBreakdown: 2,
      minSchedulePhases: 3,
      minScheduleMilestones: 3,
      minScheduleTasks: 6,
      minResourcesRoles: 3,
      minResourcesLabour: 2,
      minResourcesContacts: 2,
      minOrganogramChars: 15,
      minPlantItems: 3,
      minQualityInspectionItems: 4,
      minQualityHoldPoints: 2,
      minQualityStandards: 2,
      minRiskItems: 4,
      minComplianceStandards: 2,
      minComplianceReferences: 1,
      minProcurementItems: 4,
      minScopeChars: 120,
    };
  }
  if (profile === "prod") {
    return {
      enabled: true,
      strictRetryEnabled: true,
      maxRetries: 1,
      genericCheckEnabled: true,
      minOverviewSummaryChars: 100,
      minOverviewObjectives: 4,
      minOverviewBudgetBreakdown: 5,
      minSchedulePhases: 5,
      minScheduleMilestones: 5,
      minScheduleTasks: 14,
      minResourcesRoles: 5,
      minResourcesLabour: 4,
      minResourcesContacts: 4,
      minOrganogramChars: 25,
      minPlantItems: 5,
      minQualityInspectionItems: 8,
      minQualityHoldPoints: 4,
      minQualityStandards: 3,
      minRiskItems: 8,
      minComplianceStandards: 4,
      minComplianceReferences: 3,
      minProcurementItems: 6,
      minScopeChars: 240,
    };
  }
  return {
    enabled: true,
    strictRetryEnabled: true,
    maxRetries: 1,
    genericCheckEnabled: true,
    minOverviewSummaryChars: 80,
    minOverviewObjectives: 3,
    minOverviewBudgetBreakdown: 3,
    minSchedulePhases: 4,
    minScheduleMilestones: 4,
    minScheduleTasks: 10,
    minResourcesRoles: 4,
    minResourcesLabour: 3,
    minResourcesContacts: 3,
    minOrganogramChars: 20,
    minPlantItems: 4,
    minQualityInspectionItems: 6,
    minQualityHoldPoints: 3,
    minQualityStandards: 2,
    minRiskItems: 5,
    minComplianceStandards: 3,
    minComplianceReferences: 2,
    minProcurementItems: 5,
    minScopeChars: 180,
  };
}

export function getQualityGateConfig(): QualityGateConfig {
  const profile = getQualityProfile();
  const preset = presetConfig(profile);
  return {
    profile,
    enabled: boolFromEnv(process.env.AI_SECTION_QUALITY_GATE_ENABLED, preset.enabled),
    strictRetryEnabled: boolFromEnv(process.env.AI_SECTION_STRICT_RETRY_ENABLED, preset.strictRetryEnabled),
    maxRetries: intFromEnv(process.env.AI_SECTION_MAX_RETRIES, preset.maxRetries, 0, 5),
    genericCheckEnabled: boolFromEnv(process.env.AI_SECTION_GENERIC_CHECK_ENABLED, preset.genericCheckEnabled),
    minOverviewSummaryChars: intFromEnv(process.env.AI_MIN_OVERVIEW_SUMMARY_CHARS, preset.minOverviewSummaryChars, 20, 500),
    minOverviewObjectives: intFromEnv(process.env.AI_MIN_OVERVIEW_OBJECTIVES, preset.minOverviewObjectives, 1, 20),
    minOverviewBudgetBreakdown: intFromEnv(process.env.AI_MIN_OVERVIEW_BUDGET_BREAKDOWN, preset.minOverviewBudgetBreakdown, 1, 20),
    minSchedulePhases: intFromEnv(process.env.AI_MIN_SCHEDULE_PHASES, preset.minSchedulePhases, 1, 20),
    minScheduleMilestones: intFromEnv(process.env.AI_MIN_SCHEDULE_MILESTONES, preset.minScheduleMilestones, 1, 30),
    minScheduleTasks: intFromEnv(process.env.AI_MIN_SCHEDULE_TASKS, preset.minScheduleTasks, 1, 200),
    minResourcesRoles: intFromEnv(process.env.AI_MIN_RESOURCES_ROLES, preset.minResourcesRoles, 1, 30),
    minResourcesLabour: intFromEnv(process.env.AI_MIN_RESOURCES_LABOUR, preset.minResourcesLabour, 1, 30),
    minResourcesContacts: intFromEnv(process.env.AI_MIN_RESOURCES_CONTACTS, preset.minResourcesContacts, 1, 30),
    minOrganogramChars: intFromEnv(process.env.AI_MIN_RESOURCES_ORGANOGRAM_CHARS, preset.minOrganogramChars, 5, 500),
    minPlantItems: intFromEnv(process.env.AI_MIN_PLANT_ITEMS, preset.minPlantItems, 1, 50),
    minQualityInspectionItems: intFromEnv(process.env.AI_MIN_QUALITY_ITP_ITEMS, preset.minQualityInspectionItems, 1, 50),
    minQualityHoldPoints: intFromEnv(process.env.AI_MIN_QUALITY_HOLD_POINTS, preset.minQualityHoldPoints, 1, 30),
    minQualityStandards: intFromEnv(process.env.AI_MIN_QUALITY_STANDARDS, preset.minQualityStandards, 1, 20),
    minRiskItems: intFromEnv(process.env.AI_MIN_RISK_ITEMS, preset.minRiskItems, 1, 50),
    minComplianceStandards: intFromEnv(process.env.AI_MIN_COMPLIANCE_STANDARDS, preset.minComplianceStandards, 1, 30),
    minComplianceReferences: intFromEnv(process.env.AI_MIN_COMPLIANCE_REFERENCES, preset.minComplianceReferences, 1, 30),
    minProcurementItems: intFromEnv(process.env.AI_MIN_PROCUREMENT_ITEMS, preset.minProcurementItems, 1, 30),
    minScopeChars: intFromEnv(process.env.AI_MIN_SCOPE_CHARS, preset.minScopeChars, 50, 2000),
  };
}

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

function isWeakSectionData(section: SectionKey, data: Record<string, unknown>, cfg: QualityGateConfig): boolean {
  const txt = (v: unknown) => (v == null ? "" : String(v).trim());
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const looksGeneric = (s: string) =>
    cfg.genericCheckEnabled && /lorem|tbd|to be determined|generic|placeholder|as required|sample/i.test(s);

  if (section === "overview") {
    const summary = txt(data.summary);
    const objectives = arr(data.objectives);
    const budget = txt(data.budgetEstimate);
    const breakdown = arr(data.budgetBreakdown);
    return (
      summary.length < cfg.minOverviewSummaryChars ||
      objectives.length < cfg.minOverviewObjectives ||
      !budget ||
      breakdown.length < cfg.minOverviewBudgetBreakdown ||
      looksGeneric(summary)
    );
  }

  if (section === "schedule") {
    const phases = arr(data.phases);
    const milestones = arr(data.milestones);
    const tasks = arr(data.tasks);
    const hasShallowWbs = tasks.some((t) => {
      const w = txt((t as Record<string, unknown>).wbs);
      return w.split(".").length < 2;
    });
    return (
      phases.length < cfg.minSchedulePhases ||
      milestones.length < cfg.minScheduleMilestones ||
      tasks.length < cfg.minScheduleTasks ||
      hasShallowWbs
    );
  }

  if (section === "resources") {
    const roles = arr(data.roles);
    const labour = arr(data.labourBreakdown);
    const contacts = arr(data.contacts);
    const organogram = txt(data.organogram);
    return (
      roles.length < cfg.minResourcesRoles ||
      labour.length < cfg.minResourcesLabour ||
      contacts.length < cfg.minResourcesContacts ||
      organogram.length < cfg.minOrganogramChars
    );
  }

  if (section === "plantAndEquipment") {
    const equipment = arr(data.equipment);
    const hasCapacity = equipment.some((e) => txt((e as Record<string, unknown>).capacity).length > 0);
    return equipment.length < cfg.minPlantItems || !hasCapacity;
  }

  if (section === "qualityManagement") {
    const itp = arr(data.inspectionAndTest);
    const hold = arr(data.holdPoints);
    const standards = arr(data.standards);
    return (
      itp.length < cfg.minQualityInspectionItems ||
      hold.length < cfg.minQualityHoldPoints ||
      standards.length < cfg.minQualityStandards
    );
  }

  if (section === "risk") {
    const rr = arr(data.riskRegister);
    return rr.length < cfg.minRiskItems;
  }

  if (section === "compliance") {
    const standards = arr(data.standards);
    const refs = arr(data.sourceReferences);
    return standards.length < cfg.minComplianceStandards || refs.length < cfg.minComplianceReferences;
  }

  if (section === "procurement") {
    const items = arr(data.items);
    return items.length < cfg.minProcurementItems;
  }

  if (section === "scope") {
    const sw = txt(data.scopeOfWork);
    return sw.length < cfg.minScopeChars || looksGeneric(sw);
  }

  return false;
}

function stricterPromptForSection(section: SectionKey): string {
  if (section === "overview") {
    return `QUALITY GATE (STRICT): budgetEstimate and budgetBreakdown are mandatory. Provide at least 5 budget breakdown lines with basis notes. If no explicit budget is supplied, infer a realistic range with assumptions.`;
  }
  if (section === "schedule") {
    return `QUALITY GATE (STRICT): Provide 10-20 schedule tasks with project-specific multi-level WBS (e.g. 1.1, 1.2, 2.1). Avoid generic labels.`;
  }
  if (section === "resources") {
    return `QUALITY GATE (STRICT): Include complete organogram (PM/PE/supervisor hierarchy chains), 4+ roles, labourBreakdown; contacts may use role-only rows with empty phone/email if names unknown.`;
  }
  if (section === "plantAndEquipment") {
    return `QUALITY GATE (STRICT): Plant/equipment must include quantity and capacity/spec for major items, tied to project activities.`;
  }
  if (section === "qualityManagement") {
    return `QUALITY GATE (STRICT): Include practical ITP and hold points mapped to scope activities and standards.`;
  }
  if (section === "risk") {
    return `QUALITY GATE (STRICT): Include 8-12 risks in riskRegister with valid L,S,Score and clear owner/mitigation.`;
  }
  if (section === "compliance") {
    return `QUALITY GATE (STRICT): include explicit standards and sourceReferences that cite client/spec/attachments if mentioned.`;
  }
  if (section === "procurement") {
    return `QUALITY GATE (STRICT): Provide detailed procurement lines with lead times and values/categories.`;
  }
  if (section === "scope") {
    return `QUALITY GATE (STRICT): scopeOfWork must be specific, detailed, and non-generic with clear boundaries/inclusions/exclusions.`;
  }
  if (section === "safetyManagement") {
    return `QUALITY GATE (STRICT): Every hazard MUST include primaryAccountableRole varied by hazard type; never default all rows to one generic role.`;
  }
  return `QUALITY GATE (STRICT): Provide detailed, project-specific and non-generic content.`;
}

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
Include at least 3-5 phases and 3-5 milestones. tasks must be a flat list for MS Project/Primavera: id (string), name, phase, wbs, durationDays, startOffsetDays (days from project start), dependencies (array of predecessor task ids). Use numbers for durations and weeks.
WBS must be detailed and project-specific (multi-level where relevant, not generic).`,

  resources: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "roles": [{"role": "Role name", "count": number or 1, "responsibilities": "brief summary"}, ...],
  "labourBreakdown": [{"discipline": "e.g. Civil crew", "count": number, "utilisation": "e.g. peak weeks 4-10"}] or [],
  "contacts": [{"role": "Role", "name": "optional or blank", "phone": "", "email": ""}] or [],
  "organogram": "Hierarchy organogram using chains like: Project Manager -> Site Engineer -> Construction Crew; Project Manager -> Architect (use -> between levels, ; between branches). Suitable for SmartArt Hierarchy in Word.",
  "equipment": [{"item": "Equipment/plant", "quantity": number or "as required", "notes": "optional"}, ...],
  "assumptions": ["resource assumption 1", ...],
  "organisationSummary": "Short narrative on resourcing approach"
}
Be practical, non-generic, and aligned with the project.`,

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
  "regulatoryRequirements": ["requirement 1", ...] or [],
  "sourceReferences": [{"type": "client|specification|standard|attachment", "reference": "explicit mention from input"}] or []
}
Reference relevant Australian/industry standards where applicable.`,

  qualityManagement: `You are a project management expert for construction. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "summary": "Brief overview of quality approach (1-2 paragraphs)",
  "objectives": ["quality objective 1", ...],
  "standards": ["e.g. AS/ISO or client standard", ...],
  "inspectionAndTest": ["ITP item or inspection activity", ...],
  "holdPoints": ["critical hold point 1", ...] or [],
  "defectsManagement": "How defects and NCRs are managed",
  "qualityRecords": ["type of record to be maintained", ...]
}
Focus on construction project quality management (for non-construction, adapt to relevant QA/QC and acceptance processes).`,

  plantAndEquipment: `You are a project management expert. Given a project brief, return ONLY valid JSON (no markdown) with this structure:
{
  "summary": "Brief overview of plant and equipment strategy (1-2 paragraphs)",
  "equipment": [{"item": "Plant/equipment name", "quantity": number or "as required", "capacity": "rated capacity/spec", "use": "brief use or phase", "notes": "optional"}],
  "majorPlant": ["key plant items with brief spec", ...],
  "maintenanceAndAvailability": "How maintenance and availability are ensured",
  "assumptions": ["assumption 1", ...]
}
Be specific to the project (no generic lists). If the project is non-construction, treat this section as tools/platforms/infrastructure/resources (still use the same JSON fields). If hybrid, include both.`,

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
  "hazards": [
    {
      "hazard": "description",
      "control": "control measure",
      "primaryAccountableRole": "Choose ONE primary coordination role for THIS hazard from: Project Manager | Project Engineer | Site Supervisor | Plant/Equipment Operator | Safety Officer/Advisor. Vary by hazard (do not use the same role for every row unless justified). WHS remains everyone's responsibility; this field is the lead coordinator."
    },
    ...
  ],
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
  const qualityGateConfig = getQualityGateConfig();
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
  const strictInstruction = stricterPromptForSection(section);
  const effectiveMaxRetries =
    qualityGateConfig.enabled && qualityGateConfig.strictRetryEnabled ? qualityGateConfig.maxRetries : 0;

  for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
    try {
      const strictPass =
        qualityGateConfig.enabled &&
        qualityGateConfig.strictRetryEnabled &&
        attempt === effectiveMaxRetries &&
        effectiveMaxRetries > 0;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: strictPass ? `${systemPrompt}\n\n${strictInstruction}` : systemPrompt },
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
        if (
          qualityGateConfig.enabled &&
          qualityGateConfig.strictRetryEnabled &&
          isWeakSectionData(section, parsed, qualityGateConfig) &&
          !strictPass
        ) {
          lastError = new Error("Weak section content, retrying with stricter prompt");
          continue;
        }
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
