/** Main document section keys (camelCase) in order. */
export const OUTLINE_SECTION_KEYS = [
  "index",
  "background",
  "scope",
  "projectOrganisationStructure",
  "plantAndEquipment",
  "constructionMethodStatement",
  "qualityManagement",
  "riskManagement",
  "safetyManagement",
  "constructionSchedule",
  "projectReference",
] as const;

/** Appendix keys for references (Risk Matrix, Project Program, ITP, Reference Notes). */
export const APPENDIX_KEYS = [
  "appendixRiskMatrix",
  "appendixProjectProgram",
  "appendixInspectionAndTestPlan",
  "appendixReferenceNotes",
] as const;

/** Display titles for main sections and appendices. */
export const SECTION_DISPLAY_NAMES: Record<string, string> = {
  index: "Index",
  background: "Background",
  scope: "Scope",
  projectOrganisationStructure: "Project Organisation Structure",
  plantAndEquipment: "Plant and Equipment",
  constructionMethodStatement: "Construction Method Statement (Methodology)",
  qualityManagement: "Quality Management",
  riskManagement: "Risk Management",
  safetyManagement: "Safety Management",
  constructionSchedule: "Construction Schedule (Gantt)",
  projectReference: "Project Reference",
  appendixRiskMatrix: "Appendix A – Risk Matrix",
  appendixProjectProgram: "Appendix B – Project Program",
  appendixInspectionAndTestPlan: "Appendix C – Inspection and Test Plan",
  appendixReferenceNotes: "Appendix D – Reference Notes",
};

/** Find the span of the root JSON object (first { to matching }). */
function extractRootObject(str: string): string | null {
  const start = str.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  let quote = "";
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === quote) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

/** Replace literal newlines inside JSON string values with \\n so JSON.parse can succeed. */
function repairNewlinesInStrings(str: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  let escape = false;
  const quote = '"';
  while (i < str.length) {
    const c = str[i];
    if (escape) {
      result += c;
      escape = false;
      i++;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        result += c;
        i++;
        continue;
      }
      if (c === quote) {
        inString = false;
        result += c;
        i++;
        continue;
      }
      if (c === "\n") {
        result += "\\n";
        i++;
        continue;
      }
      if (c === "\r") {
        result += "\\r";
        i++;
        continue;
      }
      result += c;
      i++;
      continue;
    }
    if (c === quote) {
      inString = true;
      result += c;
      i++;
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

/** Find the start of "key": " in jsonStr; return start index of the value content, or -1. */
function findKeyValueStart(jsonStr: string, key: string): number {
  const prefix = `"${key}"`;
  const i = jsonStr.indexOf(prefix);
  if (i === -1) return -1;
  let j = i + prefix.length;
  while (j < jsonStr.length && /\s/.test(jsonStr[j])) j++;
  if (jsonStr[j] !== ":") return -1;
  j++;
  while (j < jsonStr.length && /\s/.test(jsonStr[j])) j++;
  if (jsonStr[j] !== '"') return -1;
  return j + 1;
}

/** Extract the string value starting at start (after the opening quote) until the closing unescaped quote. */
function extractStringToClosingQuote(str: string, start: number): string {
  let out = "";
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (c === "\\" && i + 1 < str.length) {
      const next = str[i + 1];
      if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === "r") out += "\r";
      else out += next;
      i++;
      continue;
    }
    if (c === '"') return out;
    out += c;
  }
  return out;
}

/** When JSON parse fails, try to extract each known key's string value from the raw blob. */
function salvageParse(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const allKeys = [...OUTLINE_SECTION_KEYS, ...APPENDIX_KEYS];
  for (const key of allKeys) {
    result[key] = "";
  }
  const root = extractRootObject(raw);
  if (!root) return result;
  const repaired = repairNewlinesInStrings(root)
    .replace(/,(\s*[}\]])/g, "$1");
  try {
    const parsed = JSON.parse(repaired) as Record<string, unknown>;
    for (const key of allKeys) {
      const v = parsed[key];
      if (typeof v === "string") result[key] = v;
    }
    return result;
  } catch {
    // Last resort: find "key": " and extract string value (handles newlines and escapes)
    for (const key of allKeys) {
      const start = findKeyValueStart(root, key);
      if (start >= 0) {
        const value = extractStringToClosingQuote(root, start);
        result[key] = value;
      }
    }
  }
  return result;
}

export function safeJsonParse(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  // 1) Try direct parse
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // continue
  }

  // 2) Extract root object
  const candidate = extractRootObject(cleaned) || cleaned;

  // 3) Fix trailing commas and CRLF
  let repaired = candidate
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/\r\n/g, "\n");

  try {
    return JSON.parse(repaired) as Record<string, unknown>;
  } catch {
    // continue
  }

  // 4) Repair literal newlines inside string values (LLMs often emit these)
  repaired = repairNewlinesInStrings(repaired);
  try {
    return JSON.parse(repaired) as Record<string, unknown>;
  } catch {
    // continue
  }

  // 5) Salvage: extract each key from the raw blob so we never dump full JSON into one field
  return salvageParse(cleaned);
}

/** Returns sections for UI: main sections then appendices, with display titles. */
export function getOutlineForDisplay(
  data: Record<string, unknown> | null
): Record<string, string> {
  if (!data || typeof data !== "object") return {};

  const result: Record<string, string> = {};
  const allKeys = [...OUTLINE_SECTION_KEYS, ...APPENDIX_KEYS];

  for (const key of allKeys) {
    const v = data[key];
    const text = typeof v === "string" ? v : v != null ? String(v) : "";
    const title = SECTION_DISPLAY_NAMES[key] || key;
    result[title] = text;
  }

  return result;
}

/** True if this string looks like the entire API JSON response (not a single section). */
function looksLikeFullJson(s: string): boolean {
  const t = s.trim();
  return t.length > 100 && t.startsWith("{") && t.includes('"index"') && t.includes('"background"');
}

/** If the value is the full JSON blob, extract the correct field so we never show raw JSON in the UI. */
function sanitizeSectionValue(key: string, value: string): string {
  if (!value || !looksLikeFullJson(value)) return value;
  const root = extractRootObject(value);
  if (!root) return value;
  try {
    const repaired = repairNewlinesInStrings(root).replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(repaired) as Record<string, unknown>;
    const v = parsed[key];
    if (typeof v === "string") return v;
  } catch {
    // ignore
  }
  return value;
}

/** Main sections only (no appendices), for right-column summaries. Values that are raw JSON blobs are sanitized. */
export function getMainSectionsOnly(
  data: Record<string, unknown> | null
): Record<string, string> {
  if (!data || typeof data !== "object") return {};

  const result: Record<string, string> = {};
  for (const key of OUTLINE_SECTION_KEYS) {
    const v = data[key];
    let text = typeof v === "string" ? v : v != null ? String(v) : "";
    text = sanitizeSectionValue(key, text);
    const title = SECTION_DISPLAY_NAMES[key] || key;
    result[title] = text;
  }
  return result;
}

/** First paragraph or first maxChars for use as a short summary. */
export function toSummary(text: string, maxChars: number = 280): string {
  const t = text.trim();
  if (!t) return "—";
  const firstPara = t.split(/\n\s*\n/)[0]?.trim() || t;
  if (firstPara.length <= maxChars) return firstPara;
  return firstPara.slice(0, maxChars).trim() + "…";
}

/** If Index value is raw JSON or malformed, extract the tabulated index string. Never return raw JSON. */
export function getIndexContentForTable(value: string): string {
  let s = value.trim();
  if (!s) return "";

  // Already tabulated (e.g. "1\tBackground" or "1\tBackground\t1")
  if (/^\d+\t/.test(s) || /^\d+[.)]\s*\S/.test(s)) return s;

  // Whole response dumped into index: extract root object then "index" field
  if (s.startsWith("{")) {
    const extracted = extractRootObject(s);
    if (extracted) {
      try {
        const repaired = extracted.replace(/,(\s*[}\]])/g, "$1");
        const parsed = JSON.parse(repaired) as Record<string, unknown>;
        const inner = parsed.index;
        if (typeof inner === "string" && inner.trim()) {
          const innerTrim = inner.trim();
          if (/^\d+\t/.test(innerTrim) || /^\d+[.)]\s*\S/.test(innerTrim)) return innerTrim;
        }
      } catch {
        // fall through to fallback
      }
    }
  }

  // Fallback: build a professional index from section order (no page numbers in preview)
  return OUTLINE_SECTION_KEYS.map((key, i) => `${i + 1}\t${SECTION_DISPLAY_NAMES[key] || key}`).join("\n");
}

/** Parse a single index line into { num, section, page }. Page may be empty. */
export function parseIndexLine(line: string, rowIndex: number): { num: string; section: string; page: string } {
  const trimmed = line.trim();
  const byTab = trimmed.split(/\t/);
  let num = String(rowIndex + 1);
  let section = trimmed;
  let page = "—";

  if (byTab.length >= 3) {
    num = byTab[0].trim();
    section = byTab[1].trim();
    page = byTab[2].trim() || "—";
  } else if (byTab.length >= 2) {
    num = byTab[0].trim();
    section = byTab.slice(1).join("\t").trim();
  } else {
    const m = trimmed.match(/^(\d+)[.)\s]+(.+)$/);
    if (m) {
      num = m[1];
      section = m[2].trim();
    }
  }
  return { num, section, page };
}
