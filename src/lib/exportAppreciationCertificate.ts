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
            transformation: { width: 105, height: 100 },
            altText: {
              title: "شعار وزارة التربية والتعليم وتنمية الموارد البشرية",
              description: "الشعار الرسمي للوزارة",
              name: "شعار الوزارة",
            },
          })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 15 },
        }),
        centered("المملكة الأردنية الهاشمية", 22, true),
        centered("وزارة التربية والتعليم وتنمية الموارد البشرية", 26, true),
        centered(data.directorateName ? `مديرية التربية والتعليم: ${data.directorateName}` : "مديرية التربية والتعليم", 22),
        centered(data.schoolName || "المدرسة", 26, true, 10, 60),
        centered("شهادة تقدير", 54, true, 35, 70),
        centered("تتقدم إدارة المدرسة بخالص الشكر والتقدير إلى الطالب/ة", 28, false, 20, 35),
        centered(data.student.name, 44, true, 15, 45),
        centered(`من الصف: ${className}`, className.length > 45 ? 21 : 27, true, 5, 45),
        centered(`تقديراً لـ ${data.reason.trim()}`, 30, false, 25, 65),
        centered("مع أطيب الأمنيات بمزيد من التفوق والنجاح", 26, false, 20, 100),
        new Paragraph({
          children: [
            text(`التاريخ: ${data.date}`, 24, true),
            new TextRun({ text: "                                                            ", font: FONT, size: 24 }),
            text(`مدير/ة المدرسة: ${data.principalName || "........................"}`, 24, true),
          ],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
        }),
        centered("التوقيع والختم: ........................", 22, false, 35),
      ],
    }],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `شهادة_تقدير_${data.student.name}.docx`);
}