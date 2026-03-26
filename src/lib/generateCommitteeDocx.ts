import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, ImageRun,
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

function rtlParagraph(text: string, opts: { bold?: boolean; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacing?: { before?: number; after?: number } } = {}) {
  return new Paragraph({
    alignment: opts.alignment ?? AlignmentType.LEFT,
    bidirectional: true,
    spacing: opts.spacing ?? {},
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? 28,
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

  // Header
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
    rtlParagraph("السلام عليكم ورحمة الله وبركاته:", { bold: true, size: 28, alignment: AlignmentType.LEFT, spacing: { after: 200 } }),
  );

  // Body
  children.push(
    rtlParagraph(
      `أرجو أن أحيطكم علماً بأنه تم تشكيل لجنة ${data.committeeName} للعام الدراسي ${data.academicYear}م في المدرسة وهم كالآتي:`,
      { size: 28, alignment: AlignmentType.LEFT, spacing: { after: 250 } }
    ),
  );

  // Members as numbered lines
  data.members.forEach((m, i) => {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        bidirectional: true,
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${i + 1}-     ${m.name}`, font: FONT, size: 28, rightToLeft: true }),
          new TextRun({ text: `          ${m.role}`, font: FONT, size: 28, rightToLeft: true }),
        ],
      })
    );
  });

  // Closing
  children.push(
    new Paragraph({ spacing: { before: 400 } }),
    rtlParagraph("وتفضلوا بقبول فائق الاحترام", { bold: true, size: 28, alignment: AlignmentType.CENTER, spacing: { after: 500 } }),
  );

  // Director signature
  children.push(
    rtlParagraph("مدير المدرسة", { size: 28, alignment: AlignmentType.LEFT }),
    rtlParagraph(data.directorName, { size: 28, alignment: AlignmentType.LEFT, spacing: { after: 400 } }),
  );

  // Separator
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "333333" } },
      spacing: { before: 400, after: 150 },
    })
  );

  // Phone
  children.push(
    rtlParagraph(`تلفون المدرسة: (${data.schoolPhone})`, { bold: true, size: 24, alignment: AlignmentType.CENTER }),
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `لجنة_${data.committeeName}.docx`);
}
