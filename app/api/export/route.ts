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
  convertInchesToTwip,
} from "docx";
import {
  OUTLINE_SECTION_KEYS,
  APPENDIX_KEYS,
  SECTION_DISPLAY_NAMES,
  getIndexContentForTable,
  parseIndexLine,
} from "@/lib/parser";

const SPACE_AFTER_PARAGRAPH = 200;
const SPACE_AFTER_HEADING = 280;
const SPACE_BEFORE_HEADING = 240;

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

    const notes = (plan["constructionSchedule"] ?? "")
      .toString()
      .split("\n")
      .find((line) => line.toLowerCase().includes((item.name ?? "").toString().toLowerCase()))
      ?? "";

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

async function buildDocx(plan: PlanPayload): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

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
          rows: tableRows,
          width: { size: 100, type: "pct" },
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
          ...bodyParagraphs(organogram)
        );
      }
      if (roles.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Role Description Table", font: "Calibri", size: 22, bold: true })],
            spacing: { after: 120 },
          }),
          new Table({
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
            width: { size: 100, type: "pct" },
          })
        );
      }
      if (contacts.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Contact Information", font: "Calibri", size: 22, bold: true })],
            spacing: { before: 180, after: 120 },
          }),
          new Table({
            rows: [
              new TableRow({
                children: ["Role", "Name", "Phone", "Email"].map((h) =>
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
                    new TableCell({ children: [new Paragraph(String(row.name ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(row.phone ?? ""))] }),
                    new TableCell({ children: [new Paragraph(String(row.email ?? ""))] }),
                  ],
                });
              }),
            ],
            width: { size: 100, type: "pct" },
          })
        );
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
            width: { size: 100, type: "pct" },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Risk Register", font: "Calibri", size: 22, bold: true })],
            spacing: { before: 220, after: 120 },
          }),
          new Table({
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
            width: { size: 100, type: "pct" },
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
          width: { size: 100, type: "pct" },
        })
      );
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
