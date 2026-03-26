import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, ImageRun,
} from "docx";
import { saveAs } from "file-saver";

export interface CommitteeMember {
  name: string;
  role: string; // رئيسا، عضوا، etc.
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


async function loadLogo(): Promise<ArrayBuffer | null> {
  try {
    const base = (import.meta as any).env?.BASE_URL || "/";
    const res = await fetch(`${base}ministry-logo.png`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function generateCommitteeDocx(data: CommitteeData) {
  const logo = await loadLogo();

  const headerChildren: Paragraph[] = [];

  if (logo) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logo,
            transformation: { width: 80, height: 80 },
            type: "png",
          }),
        ],
      })
    );
  }

  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "وزارة التربية والتعليم", bold: true, font: "Traditional Arabic", size: 28, rightToLeft: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: data.directorateName, bold: true, font: "Traditional Arabic", size: 28, rightToLeft: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: `مدرسة / ${data.schoolName}`, bold: true, font: "Traditional Arabic", size: 28, rightToLeft: true }),
      ],
    })
  );

  // Addressee
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `السيد مدير التربية والتعليم ${data.directorateName.replace("مديرية التربية والتعليم ", "").replace("مديرية التربية والتعليم", "")} المحترم`, bold: true, font: "Traditional Arabic", size: 26, rightToLeft: true }),
      ],
    })
  );

  // Subject
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: `الموضوع / لجنة ${data.committeeName}`, bold: true, font: "Traditional Arabic", size: 26, rightToLeft: true }),
      ],
    })
  );

  // Greeting
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "السلام عليكم ورحمة الله وبركاته:", bold: true, font: "Traditional Arabic", size: 26, rightToLeft: true }),
      ],
    })
  );

  // Body text
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `ارجو ان احيطكم علما بأنه تم تشكيل لجنة ${data.committeeName} للعام الدراسي ${data.academicYear}م  في المدرسة وهم كالآتي:`,
          font: "Traditional Arabic",
          size: 26,
          rightToLeft: true,
        }),
      ],
    })
  );


  // Members as paragraphs (since section children don't mix Table/Paragraph easily)
  data.members.forEach((m, i) => {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${i + 1}-     ${m.name}`, font: "Traditional Arabic", size: 26, rightToLeft: true }),
          new TextRun({ text: `          ${m.role}`, font: "Traditional Arabic", size: 26, rightToLeft: true }),
        ],
      })
    );
  });

  // Closing
  headerChildren.push(
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: "وتفضلوا بقبول فائق الاحترام", bold: true, font: "Traditional Arabic", size: 26, rightToLeft: true }),
      ],
    })
  );

  // Director signature
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      children: [new TextRun({ text: "مدير", font: "Traditional Arabic", size: 26, rightToLeft: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      children: [new TextRun({ text: "المدرسة", font: "Traditional Arabic", size: 26, rightToLeft: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { after: 400 },
      children: [new TextRun({ text: data.directorName, font: "Traditional Arabic", size: 26, rightToLeft: true })],
    })
  );

  // Separator line
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1 } },
      spacing: { after: 200 },
    })
  );

  // Phone
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      children: [
        new TextRun({ text: "تلفون المدرسة", font: "Traditional Arabic", size: 24, rightToLeft: true, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      children: [
        new TextRun({ text: `(${data.schoolPhone})`, font: "Traditional Arabic", size: 24, rightToLeft: true }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
        },
      },
      children: headerChildren,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `لجنة_${data.committeeName}.docx`);
}
