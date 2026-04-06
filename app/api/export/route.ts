import { NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TableLayoutType,
  WidthType,
  convertInchesToTwip,
} from "docx";
import {
  OUTLINE_SECTION_KEYS,
  APPENDIX_KEYS,
  SECTION_DISPLAY_NAMES,
  getIndexContentForTable,
  parseIndexLine,
} from "@/lib/parser";
import { buildMicrosoftProjectXml } from "@/lib/schedule-export";

const SPACE_AFTER_PARAGRAPH = 200;
const SPACE_AFTER_HEADING = 280;
const SPACE_BEFORE_HEADING = 240;

/** Full content width between 1" margins on Letter/A4 — avoids docx default 100-twip columns (broken on Word mobile). */
const TABLE_CONTENT_DXA = convertInchesToTwip(6.35);

function tableGridFromRatios(ratios: readonly number[]): {
  layout: (typeof TableLayoutType)[keyof typeof TableLayoutType];
  columnWidths: number[];
  width: { size: number; type: (typeof WidthType)[keyof typeof WidthType] };
} {
  const sumR = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map((r) => Math.floor((TABLE_CONTENT_DXA * r) / sumR));
  const drift = TABLE_CONTENT_DXA - widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += drift;
  return {
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    width: { size: TABLE_CONTENT_DXA, type: WidthType.DXA },
  };
}

type PlanPayload = Record<string, unknown>;

type ScheduleItem = {
  id?: number | string;
  wbs?: string;
  name?: string;
  phase?: string;
  durationDays?: number;
  startOffsetDays?: number;
  dependencies?: Array<number | string>;
};

type RiskRegisterItem = Record<string, unknown>;

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildScheduleCsv(plan: PlanPayload, projectStartDate?: string): string {
  const raw = plan["schedule"];
  if (!Array.isArray(raw) || raw.length === 0) {
    return "Task ID,Task Name,Phase,WBS,Duration (days),Start,Finish,Predecessors,Notes\n";
  }

  const start = projectStartDate ? new Date(projectStartDate) : new Date();
  const items: ScheduleItem[] = raw as ScheduleItem[];

  const rows: string[] = [];
  rows.push("Task ID,Task Name,Phase,WBS,Duration (days),Start,Finish,Predecessors,Notes");

  for (const item of items) {
    const id = item.id ?? "";
    const name = (item.name ?? "").toString().replace(/"/g, '""');
    const phase = (item.phase ?? "").toString().replace(/"/g, '""');
    const wbs = (item.wbs ?? "").toString().replace(/"/g, '""');
    const duration = Number.isFinite(item.durationDays ?? NaN) ? String(item.durationDays) : "";

    const offset = Number.isFinite(item.startOffsetDays ?? NaN) ? (item.startOffsetDays as number) : 0;
    const startDate = new Date(start.getTime());
    startDate.setDate(startDate.getDate() + offset);
    const startStr = toDateString(startDate);
    const finishDate = new Date(startDate.getTime());
    if (Number.isFinite(item.durationDays ?? NaN) && (item.durationDays as number) > 0) {
      finishDate.setDate(finishDate.getDate() + (item.durationDays as number));
    }
    const finishStr = toDateString(finishDate);

    const predecessors = Array.isArray(item.dependencies)
      ? item.dependencies.map((p) => String(p)).join(";")
      : "";

    const constructionScheduleText =
      typeof plan["constructionSchedule"] === "string" ? String(plan["constructionSchedule"]) : "";
    const notes =
      constructionScheduleText
        .split("\n")
        .find((line) => line.toLowerCase().includes((item.name ?? "").toString().toLowerCase())) ?? "";

    const safeNotes = notes.replace(/"/g, '""');

    const row = [
      `"${id}"`,
      `"${name}"`,
      `"${phase}"`,
      `"${wbs}"`,
      `"${duration}"`,
      `"${startStr}"`,
      `"${finishStr}"`,
      `"${predecessors}"`,
      `"${safeNotes}"`,
    ].join(",");
    rows.push(row);
  }

  return rows.join("\r\n");
}

function bodyParagraphs(text: string) {
  const value = String(text ?? "").trim();
  if (!value) {
    return [
      new Paragraph({
        children: [new TextRun({ text: "—", font: "Calibri", size: 22 })],
        spacing: { after: SPACE_AFTER_PARAGRAPH },
      }),
    ];
  }
  const blocks = value.split(/\n\s*\n/).filter((b) => b.trim());
  if (blocks.length === 0) {
    return [
      new Paragraph({
        children: [new TextRun({ text: value, font: "Calibri", size: 22 })],
        spacing: { after: SPACE_AFTER_PARAGRAPH },
      }),
    ];
  }
  return blocks.map(
    (block) =>
      new Paragraph({
        children: [
          new TextRun({
            text: block.replace(/\n/g, " ").trim(),
            font: "Calibri",
            size: 22,
          }),
        ],
        spacing: { after: SPACE_AFTER_PARAGRAPH },
      })
  );
}

function isBlankValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim().length === 0 || v.trim() === "—";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function generateIndexContent(plan: PlanPayload, keys: readonly string[]): string {
  const rows: string[] = [];
  let page = 1;
  let i = 1;
  for (const key of keys) {
    if (key === "index") continue;
    const v = plan[key];
    if (isBlankValue(v)) continue;
    rows.push(`${i}\t${SECTION_DISPLAY_NAMES[key] || key}\t${page}`);
    i++;
    page += 2;
  }
  return rows.join("\n");
}

function riskBandColor(score: number): string {
  if (score >= 16) return "FCA5A5"; // high
  if (score >= 9) return "FDE68A"; // medium
  if (score >= 4) return "FEF3C7"; // low-medium
  return "DCFCE7"; // low
}

function riskBandLabel(score: number): string {
  if (score >= 16) return "High";
  if (score >= 9) return "Medium";
  if (score >= 4) return "Low-Medium";
  return "Low";
}

function extractRiskRegister(plan: PlanPayload): RiskRegisterItem[] {
  const riskManagement = plan["riskManagement"];
  if (
    riskManagement &&
    typeof riskManagement === "object" &&
    !Array.isArray(riskManagement) &&
    Array.isArray((riskManagement as Record<string, unknown>).riskRegister)
  ) {
    return (riskManagement as Record<string, unknown>).riskRegister as RiskRegisterItem[];
  }
  if (Array.isArray(plan["appendixRiskMatrix"])) {
    return plan["appendixRiskMatrix"] as RiskRegisterItem[];
  }
  return [];
}

function buildRiskMatrixCsv(plan: PlanPayload): string {
  const register = extractRiskRegister(plan);
  const rows: string[] = [];
  rows.push(
    "ID,Risk Description,Cause,Impact,Likelihood,Severity,Risk Score,Matrix Cell,Rating,Mitigation,Owner"
  );
  for (const r of register) {
    const l = Number(r.likelihood);
    const s = Number(r.severity);
    const derivedScore = Number.isFinite(l) && Number.isFinite(s) ? l * s : NaN;
    const score = Number.isFinite(Number(r.riskScore)) ? Number(r.riskScore) : derivedScore;
    const safe = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const matrixCell =
      Number.isFinite(l) && Number.isFinite(s) && l >= 1 && l <= 5 && s >= 1 && s <= 5
        ? `S${s}-L${l}`
        : "";
    rows.push(
      [
        safe(r.id ?? ""),
        safe(r.riskDescription ?? ""),
        safe(r.cause ?? ""),
        safe(r.impact ?? ""),
        safe(Number.isFinite(l) ? l : ""),
        safe(Number.isFinite(s) ? s : ""),
        safe(Number.isFinite(score) ? score : ""),
        safe(matrixCell),
        safe(Number.isFinite(score) ? riskBandLabel(score) : ""),
        safe(r.mitigationStrategy ?? ""),
        safe(r.owner ?? ""),
      ].join(",")
    );
  }
  return rows.join("\r\n");
}

function parseOrganogramChains(organogram: string): string[][] {
  return organogram
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chain) =>
      chain
        .split(/->|→/)
        .map((p) => p.trim())
        .filter(Boolean)
    )
    .filter((parts) => parts.length > 0);
}

function buildOrganogramChildrenMap(chains: string[][]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  const seenEdge = new Set<string>();
  for (const parts of chains) {
    for (let i = 0; i < parts.length - 1; i++) {
      const parent = parts[i];
      const child = parts[i + 1];
      const key = `${parent}>>${child}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(child);
    }
  }
  return children;
}

function findOrganogramRoots(chains: string[][]): string[] {
  const all = new Set<string>();
  const asChild = new Set<string>();
  for (const parts of chains) {
    parts.forEach((p) => all.add(p));
    for (let i = 1; i < parts.length; i++) asChild.add(parts[i]);
  }
  return [...all].filter((n) => !asChild.has(n));
}

/** Hierarchical bullets (SmartArt-ready in Word desktop: Convert to SmartArt → Hierarchy). */
function organogramHierarchyParagraphs(organogram: string): Paragraph[] {
  const chains = parseOrganogramChains(organogram);
  if (chains.length === 0) return bodyParagraphs(organogram);

  const childrenMap = buildOrganogramChildrenMap(chains);
  const roots = findOrganogramRoots(chains);
  const indentStep = convertInchesToTwip(0.28);

  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: "Organisation hierarchy (SmartArt-style). In Word for desktop: select the lines below → Home → Convert to SmartArt → Hierarchy.",
          font: "Calibri",
          size: 20,
          italics: true,
        }),
      ],
      spacing: { after: 140 },
    }),
  ];

  function dfs(node: string, depth: number, path: string[]) {
    if (path.includes(node)) return;
    const nextPath = [...path, node];
    paragraphs.push(
      new Paragraph({
        indent: { left: depth * indentStep },
        children: [
          new TextRun({
            text: `${depth > 0 ? "• " : ""}${node}`,
            font: "Calibri",
            size: 22,
            bold: depth === 0,
          }),
        ],
        spacing: { after: 40 },
      })
    );
    for (const child of childrenMap.get(node) ?? []) dfs(child, depth + 1, nextPath);
  }

  if (roots.length === 0) {
    const parts = chains[0];
    parts.forEach((p, i) => {
      paragraphs.push(
        new Paragraph({
          indent: { left: i * indentStep },
          children: [
            new TextRun({
              text: `${i > 0 ? "• " : ""}${p}`,
              font: "Calibri",
              size: 22,
              bold: i === 0,
            }),
          ],
          spacing: { after: 40 },
        })
      );
    });
  } else {
    for (const r of roots) dfs(r, 0, []);
  }

  return paragraphs;
}

const SAFETY_PRIMARY_ROLES = [
  "Project Manager",
  "Project Engineer",
  "Site Supervisor",
  "Plant / Equipment Operator",
] as const;

function resolveSafetyAccountableRole(h: Record<string, unknown>, rowIndex: number): string {
  const raw = String(
    h.primaryAccountableRole ??
      h.responsiblePersonRole ??
      h.responsiblePerson ??
      h.owner ??
      ""
  ).trim();
  if (raw) return raw;
  return SAFETY_PRIMARY_ROLES[rowIndex % SAFETY_PRIMARY_ROLES.length];
}

async function buildDocx(plan: PlanPayload): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  const projectName = String(plan["projectName"] ?? "").trim();
  const clientName = String(plan["clientName"] ?? "").trim();
  const contractorName = String(plan["contractorName"] ?? "").trim();

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Project Plan",
          font: "Calibri",
          size: 32,
          bold: true,
        }),
      ],
      heading: HeadingLevel.TITLE,
      spacing: { after: 360 },
    })
  );
  if (projectName || clientName || contractorName) {
    children.push(
      new Table({
        ...tableGridFromRatios([1, 2.2]),
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Project Name", font: "Calibri", size: 22, bold: true })],
                  }),
                ],
              }),
              new TableCell({ children: [new Paragraph(projectName || "—")] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Client", font: "Calibri", size: 22, bold: true })],
                  }),
                ],
              }),
              new TableCell({ children: [new Paragraph(clientName || "—")] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Contractor", font: "Calibri", size: 22, bold: true })],
                  }),
                ],
              }),
              new TableCell({ children: [new Paragraph(contractorName || "—")] }),
            ],
          }),
        ],
      })
    );
  }

  for (const key of OUTLINE_SECTION_KEYS) {
    const title = SECTION_DISPLAY_NAMES[key] || key;
    const value = plan[key];
    const text =
      key === "index"
        ? (typeof value === "string" && value.trim() ? value : generateIndexContent(plan, OUTLINE_SECTION_KEYS))
        : typeof value === "string"
          ? value
          : value != null
            ? String(value)
            : "";
    if (key !== "index" && isBlankValue(value)) continue;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            font: "Calibri",
            size: 28,
            bold: true,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: SPACE_BEFORE_HEADING,
          after: SPACE_AFTER_HEADING,
        },
      })
    );

    if (key === "index" && text) {
      const indexContent = getIndexContentForTable(text);
      const rows = indexContent.split(/\r?\n/).filter((line) => line.trim());
      const tableRows = [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "No.", font: "Calibri", size: 22, bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Section", font: "Calibri", size: 22, bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Page", font: "Calibri", size: 22, bold: true })],
                }),
              ],
            }),
          ],
        }),
        ...rows.map((line, i) => {
          const { num, section, page } = parseIndexLine(line, i);
          return new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: num, font: "Calibri", size: 22 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: section, font: "Calibri", size: 22 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: page, font: "Calibri", size: 22 })] })],
              }),
            ],
          });
        }),
      ];
      children.push(
        new Table({
          ...tableGridFromRatios([0.14, 0.62, 0.14]),
          rows: tableRows,
        })
      );
    } else if (key === "projectOrganisationStructure" && value && typeof value === "object" && !Array.isArray(value)) {
      const org = value as Record<string, unknown>;
      const summary = org.summary ? String(org.summary) : "";
      const organogram = org.organogram ? String(org.organogram) : "";
      const roles = Array.isArray(org.roles) ? org.roles : [];
      const contacts = Array.isArray(org.contacts) ? org.contacts : [];

      if (summary) children.push(...bodyParagraphs(summary));
      if (organogram) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Organogram", font: "Calibri", size: 22, bold: true })],
            spacing: { after: 120 },
          }),
          ...organogramHierarchyParagraphs(organogram)
        );
      }
      if (roles.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Role Description Table", font: "Calibri", size: 22, bold: true })],
            spacing: { after: 120 },
          }),
          new Table({
            ...tableGridFromRatios([0.9, 0.14, 1.5]),
            rows: [
              new TableRow({
                children: ["Role", "Count", "Responsibilities"].map((h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 21, bold: true })] })],
                  })
                ),
              }),
              ...roles.slice(0, 20).map((r) => {
                const row = r as Record<string, unknown>;
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(row.role ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(row.count ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(row.responsibilities ?? ""))] }),
                  ],
                });
              }),
            ],
          })
        );
      }
      if (contacts.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Role Contact Channels", font: "Calibri", size: 22, bold: true })],
            spacing: { before: 180, after: 120 },
          }),
          new Table({
            ...tableGridFromRatios([0.45, 0.275, 0.275]),
            rows: [
              new TableRow({
                children: ["Role", "Phone", "Email"].map((h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 21, bold: true })] })],
                  })
                ),
              }),
              ...contacts.slice(0, 20).map((c) => {
                const row = c as Record<string, unknown>;
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(row.role ?? ""))] }),
                    new TableCell({ children: [new Paragraph("")] }),
                    new TableCell({ children: [new Paragraph("")] }),
                  ],
                });
              }),
            ],
          })
        );
      }
    } else if (key === "plantAndEquipment" && value && typeof value === "object" && !Array.isArray(value)) {
      const plant = value as Record<string, unknown>;
      const summary = plant.summary ? String(plant.summary) : "";
      const maintenance = plant.maintenanceAndAvailability ? String(plant.maintenanceAndAvailability) : "";
      const equipment = Array.isArray(plant.equipment) ? (plant.equipment as Array<Record<string, unknown>>) : [];
      if (summary) children.push(...bodyParagraphs(summary));
      if (equipment.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Plant and Equipment Schedule", font: "Calibri", size: 22, bold: true })],
            spacing: { after: 120 },
          }),
          new Table({
            ...tableGridFromRatios([1.05, 0.95, 0.35, 0.85]),
            rows: [
              new TableRow({
                children: ["Description", "Capacity", "Quantity", "Use/Notes"].map((h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 21, bold: true })] })],
                  })
                ),
              }),
              ...equipment.slice(0, 40).map((e) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(e.item ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(e.capacity ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(e.quantity ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(e.use ?? e.notes ?? ""))] }),
                  ],
                })
              ),
            ],
          })
        );
      }
      if (maintenance) children.push(...bodyParagraphs(`Maintenance & availability: ${maintenance}`));
    } else if (key === "constructionSchedule" && value && typeof value === "object" && !Array.isArray(value)) {
      const schedule = value as Record<string, unknown>;
      const criticalPathNotes = schedule.criticalPathNotes ? String(schedule.criticalPathNotes) : "";
      const tasks = Array.isArray(schedule.tasks) ? (schedule.tasks as Array<Record<string, unknown>>) : [];
      if (criticalPathNotes) children.push(...bodyParagraphs(criticalPathNotes));
      if (tasks.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "WBS Task Program", font: "Calibri", size: 22, bold: true })],
            spacing: { after: 120 },
          }),
          new Table({
            ...tableGridFromRatios([0.22, 0.42, 0.2, 0.36]),
            rows: [
              new TableRow({
                children: ["WBS", "Task", "Phase", "Timeframe"].map((h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 21, bold: true })] })],
                  })
                ),
              }),
              ...tasks.slice(0, 80).map((t) => {
                const start = Number(t.startOffsetDays);
                const duration = Number(t.durationDays);
                const timeframe =
                  Number.isFinite(start) && Number.isFinite(duration)
                    ? `Day ${start} to Day ${start + Math.max(duration, 0)} (${duration} days)`
                    : "";
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(t.wbs ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(t.name ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(t.phase ?? ""))] }),
                    new TableCell({ children: [new Paragraph(timeframe)] }),
                  ],
                });
              }),
            ],
          })
        );
      } else {
        children.push(...bodyParagraphs(typeof value === "string" ? String(value) : "—"));
      }
    } else if (key === "safetyManagement" && value && typeof value === "object" && !Array.isArray(value)) {
      const safety = value as Record<string, unknown>;
      const summary = safety.summary ? String(safety.summary) : "";
      const hazards = Array.isArray(safety.hazards) ? (safety.hazards as Array<Record<string, unknown>>) : [];
      if (summary) children.push(...bodyParagraphs(summary));
      if (hazards.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Hazard Control Register", font: "Calibri", size: 22, bold: true })],
            spacing: { after: 120 },
          }),
          new Table({
            ...tableGridFromRatios([0.95, 1.15, 0.75]),
            rows: [
              new TableRow({
                children: ["Hazard", "Control", "Primary accountable role"].map((h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 21, bold: true })] })],
                  })
                ),
              }),
              ...hazards.slice(0, 40).map((h, idx) => {
                const accountable = resolveSafetyAccountableRole(h, idx);
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(h.hazard ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(h.control ?? ""))] }),
                    new TableCell({ children: [new Paragraph(accountable)] }),
                  ],
                });
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Note: WHS is the responsibility of all personnel (including PM, PE, supervisors, and operators). The column above identifies the primary coordination role for each hazard.",
                font: "Calibri",
                size: 20,
                italics: true,
              }),
            ],
            spacing: { before: 120, after: 80 },
          })
        );
      }
      if (Array.isArray(safety.objectives) && safety.objectives.length > 0) {
        children.push(...bodyParagraphs(`Objectives: ${(safety.objectives as unknown[]).map((x) => String(x)).join("; ")}`));
      }
      if (Array.isArray(safety.swms) && safety.swms.length > 0) {
        children.push(...bodyParagraphs(`SWMS / high-risk activities: ${(safety.swms as unknown[]).map((x) => String(x)).join("; ")}`));
      }
      if (safety.trainingAndInduction) {
        children.push(...bodyParagraphs(`Training and induction: ${String(safety.trainingAndInduction)}`));
      }
      if (safety.emergencyProcedures) {
        children.push(...bodyParagraphs(`Emergency procedures: ${String(safety.emergencyProcedures)}`));
      }
    } else if (key === "riskManagement" && value && typeof value === "object" && !Array.isArray(value)) {
      const risk = value as Record<string, unknown>;
      const overall = risk.overallRiskSummary ? String(risk.overallRiskSummary) : "";
      const register = Array.isArray(risk.riskRegister) ? (risk.riskRegister as Array<Record<string, unknown>>) : [];
      if (overall) children.push(...bodyParagraphs(overall));

      if (register.length > 0) {
        const matrixCounts: number[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
        for (const r of register) {
          const l = Number(r.likelihood);
          const s = Number(r.severity);
          if (Number.isFinite(l) && Number.isFinite(s) && l >= 1 && l <= 5 && s >= 1 && s <= 5) {
            matrixCounts[s - 1][l - 1] += 1;
          }
        }

        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Risk Matrix (5x5)", font: "Calibri", size: 22, bold: true })],
            spacing: { before: 180, after: 120 },
          }),
          new Table({
            ...tableGridFromRatios([1.15, 1, 1, 1, 1, 1]),
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Severity \\ Likelihood", font: "Calibri", size: 20, bold: true })] })],
                  }),
                  ...[1, 2, 3, 4, 5].map((x) =>
                    new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(x), font: "Calibri", size: 20, bold: true })] })],
                    })
                  ),
                ],
              }),
              ...[1, 2, 3, 4, 5].map((sev) =>
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: String(sev), font: "Calibri", size: 20, bold: true })] })],
                    }),
                    ...[1, 2, 3, 4, 5].map((lik) => {
                      const n = matrixCounts[sev - 1][lik - 1] || 0;
                      const score = sev * lik;
                      return new TableCell({
                        shading: { fill: n > 0 ? riskBandColor(score) : "FFFFFF" },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: n > 0 ? String(n) : "—", font: "Calibri", size: 20, bold: n > 0 })],
                          }),
                        ],
                      });
                    }),
                  ],
                })
              ),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Risk Register", font: "Calibri", size: 22, bold: true })],
            spacing: { before: 220, after: 120 },
          }),
          new Table({
            ...tableGridFromRatios([0.32, 0.9, 0.62, 0.62, 0.22, 0.22, 0.28, 1.05, 0.82]),
            rows: [
              new TableRow({
                children: ["ID", "Risk", "Cause", "Impact", "L", "S", "Score", "Mitigation", "Owner"].map((h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 20, bold: true })] })],
                  })
                ),
              }),
              ...register.slice(0, 20).map((r, i) => {
                const l = Number(r.likelihood);
                const s = Number(r.severity);
                const score = Number.isFinite(Number(r.riskScore)) ? Number(r.riskScore) : (Number.isFinite(l) && Number.isFinite(s) ? l * s : "");
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(r.id ?? `R${i + 1}`))] }),
                    new TableCell({ children: [new Paragraph(String(r.riskDescription ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(r.cause ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(r.impact ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(r.likelihood ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(r.severity ?? ""))] }),
                    new TableCell({
                      shading: Number.isFinite(Number(score)) ? { fill: riskBandColor(Number(score)) } : undefined,
                      children: [new Paragraph(String(score ?? ""))],
                    }),
                    new TableCell({ children: [new Paragraph(String(r.mitigationStrategy ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(r.owner ?? ""))] }),
                  ],
                });
              }),
            ],
          })
        );
      } else {
        children.push(...bodyParagraphs(typeof risk === "string" ? String(risk) : "—"));
      }
    } else {
      children.push(...bodyParagraphs(text));
    }
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Appendices",
          font: "Calibri",
          size: 28,
          bold: true,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: {
        before: SPACE_BEFORE_HEADING,
        after: SPACE_AFTER_HEADING,
      },
    })
  );

  for (const key of APPENDIX_KEYS) {
    const title = SECTION_DISPLAY_NAMES[key] || key;
    const value = plan[key];
    const text = typeof value === "string" ? value : value != null ? String(value) : "";

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            font: "Calibri",
            size: 24,
            bold: true,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: SPACE_BEFORE_HEADING,
          after: 120,
        },
      })
    );
    if (key === "appendixInspectionAndTestPlan" && Array.isArray(value) && value.length > 0) {
      children.push(
        new Table({
          ...tableGridFromRatios([0.12, 0.88]),
          rows: [
            new TableRow({
              children: ["No.", "Inspection/Test Item"].map((h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 21, bold: true })] })],
                })
              ),
            }),
            ...value.slice(0, 40).map((it, idx) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(String(idx + 1))] }),
                  new TableCell({ children: [new Paragraph(String(it))] }),
                ],
              })
            ),
          ],
        })
      );
    } else if (key === "appendixRiskMatrix" && Array.isArray(value) && value.length > 0) {
      const register = value as Array<Record<string, unknown>>;
      const matrixCounts: number[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
      for (const r of register) {
        const l = Number(r.likelihood);
        const s = Number(r.severity);
        if (Number.isFinite(l) && Number.isFinite(s) && l >= 1 && l <= 5 && s >= 1 && s <= 5) {
          matrixCounts[s - 1][l - 1] += 1;
        }
      }
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Risk matrix is downloadable as Excel-compatible CSV (Risk Matrix export).",
              font: "Calibri",
              size: 21,
            }),
          ],
          spacing: { after: 120 },
        }),
        new Table({
          ...tableGridFromRatios([1.15, 1, 1, 1, 1, 1]),
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Severity \\ Likelihood", font: "Calibri", size: 20, bold: true })] })],
                }),
                ...[1, 2, 3, 4, 5].map((x) =>
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(x), font: "Calibri", size: 20, bold: true })] })],
                  })
                ),
              ],
            }),
            ...[1, 2, 3, 4, 5].map((sev) =>
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: String(sev), font: "Calibri", size: 20, bold: true })] })],
                  }),
                  ...[1, 2, 3, 4, 5].map((lik) => {
                    const n = matrixCounts[sev - 1][lik - 1] || 0;
                    const score = sev * lik;
                    return new TableCell({
                      shading: { fill: n > 0 ? riskBandColor(score) : "FFFFFF" },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: n > 0 ? String(n) : "—", font: "Calibri", size: 20, bold: n > 0 })],
                        }),
                      ],
                    });
                  }),
                ],
              })
            ),
          ],
        }),
        new Paragraph({
          children: [new TextRun({ text: "Risk Register", font: "Calibri", size: 22, bold: true })],
          spacing: { before: 220, after: 120 },
        }),
        new Table({
          ...tableGridFromRatios([0.32, 0.9, 0.62, 0.62, 0.22, 0.22, 0.28, 1.05, 0.82]),
          rows: [
            new TableRow({
              children: ["ID", "Risk", "Cause", "Impact", "L", "S", "Score", "Mitigation", "Owner"].map((h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 20, bold: true })] })],
                })
              ),
            }),
            ...register.slice(0, 20).map((r, i) => {
              const l = Number(r.likelihood);
              const s = Number(r.severity);
              const score = Number.isFinite(Number(r.riskScore)) ? Number(r.riskScore) : (Number.isFinite(l) && Number.isFinite(s) ? l * s : "");
              return new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(String(r.id ?? `R${i + 1}`))] }),
                  new TableCell({ children: [new Paragraph(String(r.riskDescription ?? ""))] }),
                  new TableCell({ children: [new Paragraph(String(r.cause ?? ""))] }),
                  new TableCell({ children: [new Paragraph(String(r.impact ?? ""))] }),
                  new TableCell({ children: [new Paragraph(String(r.likelihood ?? ""))] }),
                  new TableCell({ children: [new Paragraph(String(r.severity ?? ""))] }),
                  new TableCell({
                    shading: Number.isFinite(Number(score)) ? { fill: riskBandColor(Number(score)) } : undefined,
                    children: [new Paragraph(String(score ?? ""))],
                  }),
                  new TableCell({ children: [new Paragraph(String(r.mitigationStrategy ?? ""))] }),
                  new TableCell({ children: [new Paragraph(String(r.owner ?? ""))] }),
                ],
              });
            }),
          ],
        })
      );
    } else if (
      key === "appendixProjectProgram" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const program = value as Record<string, unknown>;
      const summary = typeof program.summary === "string" ? program.summary : "";
      const phases = Array.isArray(program.phases) ? (program.phases as Array<Record<string, unknown>>) : [];
      const milestones = Array.isArray(program.milestones) ? (program.milestones as Array<Record<string, unknown>>) : [];
      if (summary) children.push(...bodyParagraphs(summary));
      if (phases.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Program Phases", font: "Calibri", size: 22, bold: true })],
            spacing: { after: 100 },
          }),
          new Table({
            ...tableGridFromRatios([0.38, 0.18, 1.1]),
            rows: [
              new TableRow({
                children: ["Phase", "Duration (weeks)", "Description"].map((h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 20, bold: true })] })],
                  })
                ),
              }),
              ...phases.slice(0, 30).map((p) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(p.name ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(p.durationWeeks ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(p.description ?? ""))] }),
                  ],
                })
              ),
            ],
          })
        );
      }
      if (milestones.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Key Milestones", font: "Calibri", size: 22, bold: true })],
            spacing: { before: 160, after: 100 },
          }),
          new Table({
            ...tableGridFromRatios([0.42, 0.2, 0.95]),
            rows: [
              new TableRow({
                children: ["Milestone", "Target Week", "Deliverable"].map((h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, font: "Calibri", size: 20, bold: true })] })],
                  })
                ),
              }),
              ...milestones.slice(0, 30).map((m) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(m.name ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(m.targetWeek ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(m.deliverable ?? ""))] }),
                  ],
                })
              ),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Schedule download reference: use Microsoft Project XML from the output panel (Primavera P6: Import → Microsoft Project XML).",
                font: "Calibri",
                size: 21,
              }),
            ],
            spacing: { before: 120 },
          })
        );
      }
    } else {
      children.push(...bodyParagraphs(text));
    }
  }

  const marginTwip = convertInchesToTwip(1.0);
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { after: SPACE_AFTER_PARAGRAPH } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: marginTwip,
              right: marginTwip,
              bottom: marginTwip,
              left: marginTwip,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    font: "Calibri",
                    size: 20,
                    children: ["Page ", PageNumber.CURRENT],
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const plan: PlanPayload = body?.plan ?? {};
    const format = (body?.format as string) || "docx";
    const projectStartDate =
      typeof body?.projectStartDate === "string" && body.projectStartDate
        ? body.projectStartDate
        : undefined;

    if (!plan || typeof plan !== "object") {
      return errorResponse("MISSING_PLAN", "Plan data is required", 400);
    }

    if (format === "docx") {
      try {
        const buffer = await buildDocx(plan);
        const bodyBytes = new Uint8Array(buffer) as unknown as BodyInit;
        return new NextResponse(bodyBytes, {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": 'attachment; filename="project-plan.docx"',
          },
        });
      } catch (docxError) {
        console.warn("DOCX export failed, falling back to JSON:", docxError);
      }
    }

    if (format === "schedule_csv") {
      const csv = buildScheduleCsv(plan, projectStartDate);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="project-schedule.csv"',
        },
      });
    }

    if (format === "schedule_msproject_xml" || format === "schedule_primavera_xml") {
      const projectName =
        typeof body?.projectName === "string" && body.projectName.trim()
          ? body.projectName.trim()
          : undefined;
      const xml = buildMicrosoftProjectXml(plan, { projectStartDate, projectName });
      const safeName =
        (projectName || "schedule").replace(/[/\\?*:|"]/g, "-").slice(0, 80) || "schedule";
      const suffix = format === "schedule_msproject_xml" ? "microsoft-project" : "primavera-p6-import";
      const filename = `${safeName}-${suffix}.xml`;
      return new NextResponse(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "risk_matrix_csv") {
      const csv = buildRiskMatrixCsv(plan);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="risk-matrix.csv"',
        },
      });
    }

    const json = JSON.stringify(plan, null, 2);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="project-plan.json"',
      },
    });
  } catch (error: unknown) {
    console.error("Export error:", error);
    return errorResponse(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "Failed to generate export",
      500
    );
  }
}
