import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { saveAs } from "file-saver";
import type { StudentInfo } from "@/types/studentAbsence";

const FONT = "Traditional Arabic";

function text(value: string, size: number, bold = false) {
  return new TextRun({ text: value, font: FONT, size, bold, rightToLeft: true });
}

function centered(value: string, size: number, bold = false, before = 0, after = 0) {
  return new Paragraph({
    children: [text(value, size, bold)],
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before, after },
  });
}

export interface AppreciationCertificateData {
  student: StudentInfo;
  reason: string;
  date: string;
  schoolName: string;
  directorateName: string;
  principalName: string;
}

export async function exportAppreciationCertificate(data: AppreciationCertificateData) {
  const response = await fetch(`${import.meta.env.BASE_URL}images/moe-logo.png`);
  const logo = await response.arrayBuffer();
  const className = data.student.className || data.student.grade || "غير محدد";

  const document = new Document({
    styles: { default: { document: { run: { font: FONT, size: 26 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 650, right: 850, bottom: 650, left: 850 },
          borders: {
            pageBorderTop: { style: BorderStyle.DOUBLE, size: 14, color: "B38A28", space: 18 },
            pageBorderBottom: { style: BorderStyle.DOUBLE, size: 14, color: "B38A28", space: 18 },
            pageBorderLeft: { style: BorderStyle.DOUBLE, size: 14, color: "B38A28", space: 18 },
            pageBorderRight: { style: BorderStyle.DOUBLE, size: 14, color: "B38A28", space: 18 },
          },
        },
      },
      children: [
        new Paragraph({
          children: [new ImageRun({
            data: logo,
            type: "png",
            transformation: { width: 82, height: 82 },
            altText: { title: "شعار وزارة التربية والتعليم", description: "شعار الوزارة", name: "شعار الوزارة" },
          })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
        }),
        centered("المملكة الأردنية الهاشمية", 24, true),
        centered("وزارة التربية والتعليم", 26, true),
        centered(data.directorateName ? `مديرية التربية والتعليم: ${data.directorateName}` : "مديرية التربية والتعليم", 23),
        centered(data.schoolName || "المدرسة", 28, true, 20, 180),
        centered("شهادة تقدير", 52, true, 100, 180),
        centered("تتقدم إدارة المدرسة بخالص الشكر والتقدير إلى", 29, false, 80, 90),
        centered(data.student.name, 42, true, 40, 100),
        centered(`من الصف: ${className}`, 28, true, 20, 120),
        centered(`تقديراً لـ ${data.reason.trim()}`, 31, false, 80, 150),
        centered("مع أطيب الأمنيات بمزيد من التفوق والنجاح", 27, false, 50, 260),
        new Paragraph({
          children: [
            text(`التاريخ: ${data.date}`, 24, true),
            new TextRun({ text: "                                      ", font: FONT, size: 24 }),
            text(`مدير/ة المدرسة: ${data.principalName || "........................"}`, 24, true),
          ],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
        }),
        centered("التوقيع والختم: ........................", 22, false, 80),
      ],
    }],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `شهادة_تقدير_${data.student.name}.docx`);
}