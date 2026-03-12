import { NextResponse } from "next/server";
import {
  Document,
  HeadingLevel,
  Packer,
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
    const text = typeof value === "string" ? value : value != null ? String(value) : "";

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
    children.push(...bodyParagraphs(text));
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
