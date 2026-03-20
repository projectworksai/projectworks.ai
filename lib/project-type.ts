export type ProjectType = "construction" | "non_construction" | "hybrid";

const CONSTRUCTION_KEYWORDS = [
  "infrastructure",
  "civil",
  "building",
  "site work",
  "construction",
  "drawings",
  "boq",
  "contractor",
  "excavation",
  "concrete",
  "earthworks",
  "pavement",
  "road",
  "bridge",
  "culvert",
  "pipeline",
  "plant",
  "equipment",
  "permit",
  "mrwa",
  "swms",
  "whs",
  "itp",
];

const NON_CONSTRUCTION_KEYWORDS = [
  "software",
  "it",
  "product",
  "platform",
  "saas",
  "marketing",
  "operations",
  "operational",
  "business rollout",
  "transformation",
  "deployment",
  "release",
  "agile",
  "scrum",
  "sprint",
  "crm",
  "customer",
  "app",
  "application",
  "integration",
  "migration",
];

const QUALITY_RELEVANCE_KEYWORDS = [
  "quality",
  "qa",
  "qc",
  "testing",
  "acceptance",
  "uat",
  "iso",
  "compliance",
  "audit",
  "defect",
];

export function detectProjectType(input: string): ProjectType {
  const t = input.toLowerCase();
  const hasConstruction = CONSTRUCTION_KEYWORDS.some((w) => t.includes(w));
  const hasNonConstruction = NON_CONSTRUCTION_KEYWORDS.some((w) => t.includes(w));

  if (hasConstruction && hasNonConstruction) return "hybrid";
  if (hasConstruction) return "construction";
  if (hasNonConstruction) return "non_construction";
  return "construction";
}

export const DOMAIN_CONFIG = {
  construction: [
    "overview",
    "scope",
    "schedule",
    "resources",
    "plant-and-equipment",
    "construction-methodology",
    "procurement",
    "quality-management",
    "risk",
    "safety-management",
    "compliance",
  ],
  non_construction: [
    "overview",
    "scope",
    "schedule",
    "resources",
    "procurement",
    "risk",
    "compliance",
  ],
  hybrid: [
    "overview",
    "scope",
    "schedule",
    "resources",
    "plant-and-equipment",
    "construction-methodology",
    "procurement",
    "quality-management",
    "risk",
    "safety-management",
    "compliance",
  ],
} as const;

export function shouldIncludeQualityForNonConstruction(input: string): boolean {
  const t = input.toLowerCase();
  return QUALITY_RELEVANCE_KEYWORDS.some((w) => t.includes(w));
}

export function getDomainsByProjectType(projectType: ProjectType, input: string): string[] {
  if (projectType === "non_construction") {
    const base: string[] = [...DOMAIN_CONFIG.non_construction];
    if (shouldIncludeQualityForNonConstruction(input)) base.push("quality-management");
    return base;
  }
  return [...DOMAIN_CONFIG[projectType]] as string[];
}

