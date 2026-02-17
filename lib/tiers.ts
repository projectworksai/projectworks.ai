/** Section keys available to free users. */
export const FREE_SECTION_KEYS = [
  "index",
  "background",
  "scope",
  "constructionMethodStatement",
] as const;

/** Section keys requiring Pro (paid) subscription. */
export const PRO_ONLY_SECTION_KEYS = [
  "projectOrganisationStructure",
  "plantAndEquipment",
  "qualityManagement",
  "riskManagement",
  "safetyManagement",
  "constructionSchedule",
  "projectReference",
  "appendixRiskMatrix",
  "appendixProjectProgram",
  "appendixInspectionAndTestPlan",
  "appendixReferenceNotes",
] as const;

export type PlanTier = "FREE" | "PRO";

export function isProUser(tier: PlanTier | null | undefined): boolean {
  return tier === "PRO";
}

const FREE_SET = new Set<string>(FREE_SECTION_KEYS);
export function canAccessSection(key: string, tier: PlanTier | null | undefined): boolean {
  if (FREE_SET.has(key)) return true;
  return isProUser(tier);
}

export function canDownloadWord(tier: PlanTier | null | undefined): boolean {
  return isProUser(tier);
}
