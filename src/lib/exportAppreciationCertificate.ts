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
  student?: StudentInfo;
  recipientName?: string;
  recipientType?: "student" | "teacher" | "organization" | "community";
  recipientDetail?: string;
  representativeName?: string;
  template?: "formal" | "academic" | "celebration" | "community";
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
  const recipientName = data.recipientName?.trim() || data.student?.name || "";
  if (!recipientName) throw new Error("اسم المستلم مطلوب");
  const recipientType = data.recipientType || "student";
  const template = data.template || "formal";
  const recipientDetail = data.recipientDetail?.trim()
    || data.student?.className
    || data.student?.grade
    || "";
  const templates = {
    formal: {
      border: BorderStyle.TRIPLE, color: "B38A28", title: "شهادة تقدير", titleSize: 66,
      intro: "تتقدم إدارة المدرسة بخالص الشكر والتقدير إلى",
      closing: "مع أطيب الأمنيات بمزيد من التفوق والنجاح",
    },
    academic: {
      border: BorderStyle.DOUBLE, color: "1D4E89", title: "شهادة شكر وتقدير", titleSize: 61,
      intro: "يسر إدارة المدرسة أن تتقدم بجزيل الشكر والتقدير إلى",
      closing: "تقديراً للعطاء المتميز، مع تمنياتنا بدوام التقدم والنجاح",
    },
    celebration: {
      border: BorderStyle.THICK_THIN_LARGE_GAP, color: "8B2E3F", title: "شهادة تميّز وعطاء", titleSize: 63,
      intro: "بكل الفخر والاعتزاز، تتشرف إدارة المدرسة بتكريم",
      closing: "نعتز بهذا الإنجاز ونتمنى مزيداً من التألق والإبداع",
    },
    community: {
      border: BorderStyle.DOUBLE_WAVE, color: "287271", title: "شهادة شكر وامتنان", titleSize: 61,
      intro: "وفاءً للعطاء والشراكة، تتقدم إدارة المدرسة بالشكر إلى",
      closing: "مع بالغ الاعتزاز بهذه الشراكة وخالص أمنياتنا بالتوفيق",
    },
  } as const;
  const selectedTemplate = templates[template];
  const detailLabels = {
    student: "الصف",
    teacher: "المسمى أو التخصص",
    organization: "الجهة / الصفة",
    community: "الصفة / المؤسسة",
  } as const;

  const document = new Document({
    styles: { default: { document: { run: { font: FONT, size: 26 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 500, right: 900, bottom: 500, left: 900 },
          borders: {
            pageBorderTop: { style: selectedTemplate.border, size: 18, color: selectedTemplate.color, space: 16 },
            pageBorderBottom: { style: selectedTemplate.border, size: 18, color: selectedTemplate.color, space: 16 },
            pageBorderLeft: { style: selectedTemplate.border, size: 18, color: selectedTemplate.color, space: 16 },
            pageBorderRight: { style: selectedTemplate.border, size: 18, color: selectedTemplate.color, space: 16 },
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
        centered(selectedTemplate.title, selectedTemplate.titleSize, true, 45, 105),
        centered(selectedTemplate.intro, 34, false, 25, 55),
        centered(recipientName, 54, true, 20, 65),
        ...(recipientDetail ? [centered(`${detailLabels[recipientType]}: ${recipientDetail}`, recipientDetail.length > 45 ? 25 : 33, true, 10, 45)] : []),
        ...(data.representativeName?.trim() ? [centered(`ممثل الجهة: ${data.representativeName.trim()}`, 28, false, 5, 40)] : []),
        centered(`تقديراً لـ ${data.reason.trim()}`, 37, false, 30, 90),
        centered(selectedTemplate.closing, 33, false, 25, 135),
        aligned(`التاريخ: ${data.date}`, 29, AlignmentType.RIGHT, true, 0, 20),
        aligned(`مدير/ة المدرسة: ${data.principalName || "........................"}`, 29, AlignmentType.LEFT, true, 0, 25),
        aligned("التوقيع والختم: ........................", 27, AlignmentType.LEFT),
      ],
    }],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `شهادة_تقدير_${recipientName}.docx`);
}