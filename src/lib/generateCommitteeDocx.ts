import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, ImageRun, WidthType, ShadingType,
  VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";

export interface CommitteeMember {
  name: string;
  role: string;
}

export interface CommitteeData {
  committeeName: string;
  academicYear: string;
  members: CommitteeMember[];
  directorName: string;
  schoolPhone: string;
  schoolName: string;
  directorateName: string;
}

const FONT = "Traditional Arabic";
const FONT_SIZE = 28; // 14pt
const SMALL_SIZE = 24; // 12pt

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function rtlParagraph(text: string, opts: { bold?: boolean; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacing?: { before?: number; after?: number } } = {}) {
  return new Paragraph({
    alignment: opts.alignment ?? AlignmentType.RIGHT,
    bidirectional: true,
    spacing: opts.spacing ?? {},
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? FONT_SIZE,
        bold: opts.bold ?? false,
        rightToLeft: true,
      }),
    ],
  });
}

async function loadLogo(): Promise<ArrayBuffer | null> {
  try {
    const base = (import.meta as any).env?.BASE_URL || "/";
    const res = await fetch(`${base}ministry-logo.jpeg`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function generateCommitteeDocx(data: CommitteeData) {
  const logo = await loadLogo();
  const children: Paragraph[] = [];

  // Logo
  if (logo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new ImageRun({
            data: logo,
            transformation: { width: 90, height: 90 },
            type: "jpg",
          }),
        ],
      })
    );
  }

  // Header lines
  children.push(
    rtlParagraph("وزارة التربية والتعليم", { bold: true, size: 30, alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
    rtlParagraph(data.directorateName, { bold: true, size: 28, alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
    rtlParagraph(`مدرسة / ${data.schoolName}`, { bold: true, size: 28, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
  );

  // Addressee
  const dirShort = data.directorateName
    .replace("مديرية التربية والتعليم ", "")
    .replace("مديرية التربية والتعليم", "");
  children.push(
    rtlParagraph(`السيد مدير التربية والتعليم ${dirShort} المحترم`, { bold: true, size: 28, alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
  );

  // Subject
  children.push(
    rtlParagraph(`الموضوع / لجنة ${data.committeeName}`, { bold: true, size: 28, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
  );

  // Greeting
  children.push(
    rtlParagraph("السلام عليكم ورحمة الله وبركاته:", { bold: true, size: 28, spacing: { after: 200 } }),
  );

  // Body
  children.push(
    rtlParagraph(
      `أرجو أن أحيطكم علماً بأنه تم تشكيل لجنة ${data.committeeName} للعام الدراسي ${data.academicYear}م في المدرسة وهم كالآتي:`,
      { size: 28, spacing: { after: 250 } }
    ),
  );

  // Members table
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const cellMargins = { top: 60, bottom: 60, left: 120, right: 120 };

  // Header row
  const headerShading = { fill: "D5E8D4", type: ShadingType.CLEAR, color: "auto" };
  const tableHeaderRow = new TableRow({
    children: [
      new TableCell({
        borders: cellBorders,
        shading: headerShading,
        margins: cellMargins,
        width: { size: 1000, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        children: [rtlParagraph("م", { bold: true, size: SMALL_SIZE, alignment: AlignmentType.CENTER })],
      }),
      new TableCell({
        borders: cellBorders,
        shading: headerShading,
        margins: cellMargins,
        width: { size: 5200, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        children: [rtlParagraph("اسم العضو", { bold: true, size: SMALL_SIZE, alignment: AlignmentType.CENTER })],
      }),
      new TableCell({
        borders: cellBorders,
        shading: headerShading,
        margins: cellMargins,
        width: { size: 2800, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        children: [rtlParagraph("الصفة", { bold: true, size: SMALL_SIZE, alignment: AlignmentType.CENTER })],
      }),
    ],
  });

  // Data rows
  const dataRows = data.members.map((m, i) =>
    new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          margins: cellMargins,
          width: { size: 1000, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: [rtlParagraph(`${i + 1}`, { size: SMALL_SIZE, alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          borders: cellBorders,
          margins: cellMargins,
          width: { size: 5200, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: [rtlParagraph(m.name, { size: SMALL_SIZE, alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          borders: cellBorders,
          margins: cellMargins,
          width: { size: 2800, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: [rtlParagraph(m.role, { size: SMALL_SIZE, alignment: AlignmentType.CENTER })],
        }),
      ],
    })
  );

  // We can't mix Table and Paragraph in children array directly, so we build sections
  // Actually docx-js sections children accept both Table and Paragraph
  const sectionChildren: (Paragraph | Table)[] = [...children];

  sectionChildren.push(
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      columnWidths: [1000, 5200, 2800],
      rows: [tableHeaderRow, ...dataRows],
    })
  );

  // Closing
  sectionChildren.push(
    new Paragraph({ spacing: { before: 400 } }),
    rtlParagraph("وتفضلوا بقبول فائق الاحترام", { bold: true, size: 28, alignment: AlignmentType.CENTER, spacing: { after: 500 } }),
  );

  // Director signature - using invisible table for layout
  sectionChildren.push(
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      columnWidths: [4500, 4500],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              width: { size: 4500, type: WidthType.DXA },
              children: [new Paragraph({})],
            }),
            new TableCell({
              borders: noBorders,
              width: { size: 4500, type: WidthType.DXA },
              children: [
                rtlParagraph("مدير المدرسة", { bold: true, size: 26, alignment: AlignmentType.CENTER }),
                rtlParagraph(data.directorName, { bold: true, size: 26, alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Separator line
  sectionChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "333333" } },
      spacing: { before: 400, after: 150 },
    })
  );

  // Phone
  sectionChildren.push(
    rtlParagraph(`تلفون المدرسة: (${data.schoolPhone})`, { bold: true, size: SMALL_SIZE, alignment: AlignmentType.CENTER }),
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
        },
      },
      children: sectionChildren,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `لجنة_${data.committeeName}.docx`);
}
