import {
  AlignmentType,
  BorderStyle,
  Document,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  PageOrientation,
  Packer,
  Paragraph,
  TextRun,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
} from "docx";
import { saveAs } from "file-saver";
import graduationWatermarkUrl from "@/assets/graduation-watermark-soft.png";
import ministryLogoUrl from "@/assets/ministry-human-resources-logo.png";
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

function aligned(value: string, size: number, alignment: (typeof AlignmentType)[keyof typeof AlignmentType], bold = false, before = 0, after = 0) {
  return new Paragraph({
    children: [text(value, size, bold)],
    alignment,
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
  const [logoResponse, watermarkResponse] = await Promise.all([
    fetch(ministryLogoUrl),
    fetch(graduationWatermarkUrl),
  ]);
  if (!logoResponse.ok || !watermarkResponse.ok) {
    throw new Error("تعذر تحميل صور شهادة التقدير");
  }
  const [logo, watermark] = await Promise.all([
    logoResponse.arrayBuffer(),
    watermarkResponse.arrayBuffer(),
  ]);
  const className = data.student.className || data.student.grade || "غير محدد";

  const document = new Document({
    styles: { default: { document: { run: { font: FONT, size: 26 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 500, right: 900, bottom: 500, left: 900 },
          borders: {
            pageBorderTop: { style: BorderStyle.TRIPLE, size: 18, color: "B38A28", space: 16 },
            pageBorderBottom: { style: BorderStyle.TRIPLE, size: 18, color: "B38A28", space: 16 },
            pageBorderLeft: { style: BorderStyle.TRIPLE, size: 18, color: "B38A28", space: 16 },
            pageBorderRight: { style: BorderStyle.TRIPLE, size: 18, color: "B38A28", space: 16 },
          },
        },
      },
      children: [
        new Paragraph({
          children: [new ImageRun({
            data: watermark,
            type: "png",
            transformation: { width: 430, height: 430 },
            floating: {
              behindDocument: true,
              allowOverlap: true,
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                align: HorizontalPositionAlign.CENTER,
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                align: VerticalPositionAlign.CENTER,
              },
            },
            altText: { title: "علامة تخرج مائية", description: "قبعة وشهادة تخرج", name: "علامة تخرج مائية" },
          })],
          spacing: { after: 0 },
        }),
        new Paragraph({
          children: [new ImageRun({
            data: logo,
            type: "png",
            transformation: { width: 125, height: 119 },
            altText: {
              title: "شعار وزارة التربية والتعليم وتنمية الموارد البشرية",
              description: "الشعار الرسمي للوزارة",
              name: "شعار الوزارة",
            },
          })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 35 },
        }),
        centered("المملكة الأردنية الهاشمية", 27, true, 0, 12),
        centered("وزارة التربية والتعليم وتنمية الموارد البشرية", 32, true, 0, 12),
        centered(data.directorateName ? `مديرية التربية والتعليم: ${data.directorateName}` : "مديرية التربية والتعليم", 27, false, 0, 12),
        centered(data.schoolName || "المدرسة", 32, true, 0, 95),
        centered("شهادة تقدير", 66, true, 45, 105),
        centered("تتقدم إدارة المدرسة بخالص الشكر والتقدير إلى الطالب/ة", 34, false, 25, 55),
        centered(data.student.name, 54, true, 20, 65),
        centered(`من الصف: ${className}`, className.length > 45 ? 25 : 33, true, 10, 65),
        centered(`تقديراً لـ ${data.reason.trim()}`, 37, false, 30, 90),
        centered("مع أطيب الأمنيات بمزيد من التفوق والنجاح", 33, false, 25, 135),
        aligned(`التاريخ: ${data.date}`, 29, AlignmentType.RIGHT, true, 0, 20),
        aligned(`مدير/ة المدرسة: ${data.principalName || "........................"}`, 29, AlignmentType.LEFT, true, 0, 25),
        aligned("التوقيع والختم: ........................", 27, AlignmentType.LEFT),
      ],
    }],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `شهادة_تقدير_${data.student.name}.docx`);
}