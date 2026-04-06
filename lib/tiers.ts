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

/** V1: all sections and exports are free; restore tier checks in V2. */
export function canAccessSection(_key: string, _tier: PlanTier | null | undefined): boolean {
  return true;
}

/** V1: Word export allowed for all; gate in V2 if needed. */
export function canDownloadWord(_tier: PlanTier | null | undefined): boolean {
  return true;
}
