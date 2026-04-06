/**
 * 5×5 risk assessment matrix: Likelihood (rows, high → low) × Severity (columns, low → high).
 * Band text and colours match standard construction / ISO-style presentation.
 */

/** Severity columns left → right (1–5). */
export const SEVERITY_AXIS_LABELS = [
  "Negligible",
  "Minor",
  "Moderate",
  "Significant",
  "Severe",
] as const;

/** Likelihood rows top → bottom: Very Likely (5) down to Very Unlikely (1). */
export const LIKELIHOOD_AXIS_LABELS = [
  "Very Likely",
  "Likely",
  "Possible",
  "Unlikely",
  "Very Unlikely",
] as const;

/** riskScore bucket labels per cell [likelihoodRow][severityCol]; row 0 = L5, col 0 = S1. */
export const RISK_ASSESSMENT_BANDS: readonly (readonly string[])[] = [
  ["Low-Med", "Medium", "Med-Hi", "High", "High"],
  ["Low", "Low-Med", "Medium", "Med-Hi", "High"],
  ["Low", "Low-Med", "Medium", "Med-Hi", "Med-Hi"],
  ["Low", "Low-Med", "Low-Med", "Medium", "Med-Hi"],
  ["Low", "Low", "Low", "Medium", "Medium"],
];

export type RiskBandKey = "Low" | "Low-Med" | "Medium" | "Med-Hi" | "High";

export function bandKeyFromLabel(label: string): RiskBandKey {
  const t = label.trim();
  if (t.startsWith("Low-Med")) return "Low-Med";
  if (t.startsWith("Med-Hi")) return "Med-Hi";
  if (t.startsWith("Low")) return "Low";
  if (t.startsWith("Medium")) return "Medium";
  if (t.startsWith("High")) return "High";
  return "Medium";
}

/** Background + text colours for matrix cells. */
export function riskBandCellStyle(label: string): { background: string; color: string } {
  const key = bandKeyFromLabel(label);
  switch (key) {
    case "Low":
      return { background: "#15803d", color: "#ffffff" };
    case "Low-Med":
      return { background: "#86efac", color: "#14532d" };
    case "Medium":
      return { background: "#fef08a", color: "#713f12" };
    case "Med-Hi":
      return { background: "#fb923c", color: "#431407" };
    case "High":
      return { background: "#dc2626", color: "#ffffff" };
    default:
      return { background: "#e2e8f0", color: "#0f172a" };
  }
}

/**
 * Build count grid for overlay: rows = likelihood high→low (0..4), cols = severity (0..4).
 * likelihood 1..5, severity 1..5 from register.
 */
export function buildRiskCountGrid(
  entries: Array<{ likelihood?: unknown; severity?: unknown }>
): number[][] {
  const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  for (const r of entries) {
    const lik = typeof r.likelihood === "number" ? r.likelihood : Number(r.likelihood);
    const sev = typeof r.severity === "number" ? r.severity : Number(r.severity);
    if (!Number.isFinite(lik) || !Number.isFinite(sev)) continue;
    const li = Math.round(lik);
    const si = Math.round(sev);
    if (li < 1 || li > 5 || si < 1 || si > 5) continue;
    const row = 5 - li;
    const col = si - 1;
    grid[row][col] += 1;
  }
  return grid;
}
