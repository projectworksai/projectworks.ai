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
  "application",
  "integration",
  "migration",
];

const STRONG_CONSTRUCTION_KEYWORDS = [
  "boq",
  "excavation",
  "concrete",
  "earthworks",
  "swms",
  "itp",
  "pipeline",
  "culvert",
  "crane",
  "formwork",
  "pavement",
];

const STRONG_NON_CONSTRUCTION_KEYWORDS = [
  "software",
  "saas",
  "app",
  "application",
  "product",
  "agile",
  "scrum",
  "sprint",
  "crm",
  "api",
  "integration",
  "data migration",
  "digital transformation",
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
  const hit = (kw: string): boolean => {
    const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\W)${safe}(\\W|$)`, "i").test(t);
  };
  const constructionHits = CONSTRUCTION_KEYWORDS.filter((w) => hit(w)).length;
  const nonConstructionHits = NON_CONSTRUCTION_KEYWORDS.filter((w) => hit(w)).length;
  const strongConstructionHits = STRONG_CONSTRUCTION_KEYWORDS.filter((w) => hit(w)).length;
  const strongNonConstructionHits = STRONG_NON_CONSTRUCTION_KEYWORDS.filter((w) => hit(w)).length;
  const hasConstruction = constructionHits > 0;
  const hasNonConstruction = nonConstructionHits > 0;

  // Strong-signal short-circuits to reduce false positives.
  if (strongNonConstructionHits >= 2 && strongConstructionHits === 0) {
    return "non_construction";
  }
  if (strongConstructionHits >= 2 && strongNonConstructionHits === 0) {
    return "construction";
  }

  if (hasConstruction && hasNonConstruction) {
    if (constructionHits >= nonConstructionHits + 3 && strongNonConstructionHits === 0) return "construction";
    if (nonConstructionHits >= constructionHits + 2 && strongConstructionHits === 0) return "non_construction";
    return "hybrid";
  }
  if (hasConstruction) {
    // Require stronger confidence to avoid forcing construction domains on non-construction briefs.
    if (constructionHits === 1 && strongConstructionHits === 0) return "non_construction";
    return "construction";
  }
  if (hasNonConstruction) return "non_construction";
  // Bias to non-construction when signals are weak/unknown to prevent construction-domain leakage.
  return "non_construction";
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

