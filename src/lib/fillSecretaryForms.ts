import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

const FONT = "Traditional Arabic";
const FONT_SIZE = 24; // half-points = 12pt
const TITLE_SIZE = 32;

function textRun(text: string, opts?: { bold?: boolean; size?: number; underline?: boolean }): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size || FONT_SIZE,
    bold: opts?.bold,
    underline: opts?.underline ? {} : undefined,
    rightToLeft: true,
  });
}

function para(runs: TextRun[], alignment: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.RIGHT, spacing?: { before?: number; after?: number }): Paragraph {
  return new Paragraph({
    children: runs,
    alignment,
    bidirectional: true,
    spacing: { before: spacing?.before || 100, after: spacing?.after || 100 },
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 80, after: 80 } });
}

function separator(): Paragraph {
  return new Paragraph({
    children: [textRun("─".repeat(60))],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
  });
}

// ═══════════════════════════════════════
// Interrogation Form - نموذج استجواب
// ═══════════════════════════════════════
export interface InterrogationData {
  school: string;
  employeeName: string;
  date: string;
  subject: string;
  details: string;
  directorName: string;
}

export async function fillInterrogationForm(data: InterrogationData) {
  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 } },
      },
      children: [
        para([textRun("وزارة التربية والتعليم", { bold: true, size: TITLE_SIZE })], AlignmentType.CENTER),
        para([textRun("نموذج استجواب", { bold: true, size: 36, underline: true })], AlignmentType.CENTER, { before: 200 }),
        para([textRun("عن المخالفة المرتكبة من قبل الموظف", { bold: true, size: FONT_SIZE })], AlignmentType.CENTER),
        emptyLine(),
        separator(),
        para([textRun("الجزء الأول", { bold: true, size: 28, underline: true })], AlignmentType.CENTER),
        para([textRun("(يعبأ من قبل مسؤول الموظفين)", { size: 20 })], AlignmentType.CENTER),
        emptyLine(),
        para([textRun(`المدرسة / مكان العمل: ${data.school}`, { size: FONT_SIZE })]),
        para([textRun(`اسم الموظف: ${data.employeeName}`, { size: FONT_SIZE })]),
        para([textRun(`التاريخ: ${data.date}`, { size: FONT_SIZE })]),
        para([textRun(`العقوبات التأديبية السابقة المتخذة بحق الموظف:`, { size: FONT_SIZE })]),
        para([textRun(".............................................................................................", { size: FONT_SIZE })]),
        emptyLine(),
        separator(),
        para([textRun("الجزء الثاني", { bold: true, size: 28, underline: true })], AlignmentType.CENTER),
        para([textRun("(يعبأ من قبل الرئيس المباشر للموظف)", { size: 20 })], AlignmentType.CENTER),
        emptyLine(),
        para([textRun(`الموضوع: ${data.subject}`, { bold: true, size: FONT_SIZE })]),
        para([textRun(`تفاصيل المخالفة:`, { size: FONT_SIZE })]),
        para([textRun(data.details || ".............................................................................................", { size: FONT_SIZE })]),
        para([textRun("التوقيع: ................................", { size: FONT_SIZE })]),
        emptyLine(),
        separator(),
        para([textRun("الجزء الثالث", { bold: true, size: 28, underline: true })], AlignmentType.CENTER),
        para([textRun("(يعبأ من قبل الموظف المستجوب)", { size: 20 })], AlignmentType.CENTER),
        emptyLine(),
        para([textRun("إجابة الموظف:", { size: FONT_SIZE })]),
        para([textRun(".............................................................................................", { size: FONT_SIZE })]),
        para([textRun(".............................................................................................", { size: FONT_SIZE })]),
        para([textRun("التوقيع: ................................", { size: FONT_SIZE })]),
        emptyLine(),
        separator(),
        para([textRun("الجزء الرابع", { bold: true, size: 28, underline: true })], AlignmentType.CENTER),
        para([textRun("تنسيب / قرار مدير التربية والتعليم:", { size: FONT_SIZE })]),
        para([textRun(".............................................................................................", { size: FONT_SIZE })]),
        para([textRun(`مدير المدرسة: ${data.directorName}`, { size: FONT_SIZE })]),
        para([textRun("التوقيع: ................................     التاريخ: ................................", { size: FONT_SIZE })]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `استجواب_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════
// Casual Leave Form - نموذج إجازة عرضية
// ═══════════════════════════════════════
export interface CasualLeaveData {
  school: string;
  employeeName: string;
  employeeNumber: string;
  jobTitle: string;
  directorate: string;
  date: string;
  reason: string;
  directorName: string;
}

export async function fillCasualLeaveForm(data: CasualLeaveData) {
  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 } },
      },
      children: [
        para([textRun("المملكة الأردنية الهاشمية", { bold: true, size: TITLE_SIZE })], AlignmentType.CENTER),
        para([textRun("وزارة التربية والتعليم", { bold: true, size: TITLE_SIZE })], AlignmentType.CENTER),
        para([textRun("نموذج إجازة عرضية", { bold: true, size: 36, underline: true })], AlignmentType.CENTER, { before: 200 }),
        emptyLine(),
        para([textRun("بيانات الموظف / الموظفة", { bold: true, size: 28, underline: true })], AlignmentType.RIGHT),
        emptyLine(),
        para([textRun(`الاسم: ${data.employeeName}`, { size: FONT_SIZE })]),
        para([textRun(`الرقم الوزاري: ${data.employeeNumber || ".................."}`, { size: FONT_SIZE })]),
        para([textRun(`المسمى الوظيفي: ${data.jobTitle || ".................."}`, { size: FONT_SIZE })]),
        para([textRun(`المديرية: ${data.directorate || ".................."}`, { size: FONT_SIZE })]),
        para([textRun(`المدرسة: ${data.school}`, { size: FONT_SIZE })]),
        emptyLine(),
        para([textRun("بيانات الإجازة", { bold: true, size: 28, underline: true })], AlignmentType.RIGHT),
        emptyLine(),
        para([textRun(`التاريخ: ${data.date}`, { size: FONT_SIZE })]),
        para([textRun(`سبب الإجازة: ${data.reason || ".................."}`, { size: FONT_SIZE })]),
        emptyLine(),
        para([textRun("أتعهد أنا الموظف المذكور أعلاه بأن جميع البيانات صحيحة", { size: FONT_SIZE })]),
        emptyLine(),
        para([textRun(`توقيع الموظف: ................................`, { size: FONT_SIZE })]),
        emptyLine(),
        separator(),
        para([textRun("رأي الرئيس المباشر:", { bold: true, size: FONT_SIZE })]),
        para([textRun(".............................................................................................", { size: FONT_SIZE })]),
        para([textRun(`مدير المدرسة: ${data.directorName}`, { size: FONT_SIZE })]),
        para([textRun("التوقيع: ................................     التاريخ: ................................", { size: FONT_SIZE })]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `إجازة_عرضية_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════
// No-Payment Form - نموذج عدم صرف
// ═══════════════════════════════════════
export interface NoPaymentData {
  school: string;
  employeeName: string;
  date: string;
  reason: string;
  daysAbsent: string;
  directorName: string;
}

export async function fillNoPaymentForm(data: NoPaymentData) {
  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 } },
      },
      children: [
        para([textRun("وزارة التربية والتعليم", { bold: true, size: TITLE_SIZE })], AlignmentType.CENTER),
        para([textRun("محافظة اربد", { size: FONT_SIZE })], AlignmentType.CENTER),
        para([textRun(`${data.school}`, { size: FONT_SIZE })], AlignmentType.CENTER),
        emptyLine(),
        para([textRun(`التاريخ: ${data.date}`, { size: FONT_SIZE })]),
        emptyLine(),
        para([textRun(`السيد المعلم / ${data.employeeName} في ${data.school}`, { bold: true, size: FONT_SIZE })]),
        emptyLine(),
        para([textRun("الموضوع: التغيب عن العمل", { bold: true, size: 28, underline: true })]),
        emptyLine(),
        para([textRun("السلام عليكم ورحمة الله وبركاته", { size: FONT_SIZE })]),
        emptyLine(),
        para([textRun(`استناداً إلى أحكام نظام الخدمة المدنية، قررت عدم صرف راتبك عن الأيام التي تغيبت فيها عن العمل بسبب:`, { size: FONT_SIZE })]),
        para([textRun(data.reason || ".............................................................................................", { size: FONT_SIZE })]),
        emptyLine(),
        para([textRun(`عدد أيام الغياب: ${data.daysAbsent || ".................."}`, { size: FONT_SIZE })]),
        emptyLine(),
        para([textRun("وذلك لعدم مباشرتك العمل بعد انتهاء إجازتك القانونية أو بدون عذر مشروع.", { size: FONT_SIZE })]),
        emptyLine(),
        para([textRun("وتفضلوا بقبول فائق الاحترام", { size: FONT_SIZE })], AlignmentType.CENTER),
        emptyLine(),
        para([textRun(`مدير المدرسة: ${data.directorName}`, { bold: true, size: FONT_SIZE })]),
        para([textRun("التوقيع: ................................", { size: FONT_SIZE })]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `عدم_صرف_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════
// Inventory Custody Form - نموذج جرد عهدة
// ═══════════════════════════════════════
export interface InventoryCustodyItem {
  serialNumber: number;
  itemName: string;
  actualBalance: number;
  existing: number;
  shortage: number;
  surplus: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InventoryCustodyData {
  school: string;
  directorate: string;
  categoryLabel: string;
  items: InventoryCustodyItem[];
  directorName: string;
  committeeMember: string;
  date: string;
}

const borderStyle = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "000000",
};
const cellBorders = {
  top: borderStyle,
  bottom: borderStyle,
  left: borderStyle,
  right: borderStyle,
};

function tableCell(text: string, opts?: { bold?: boolean; width?: number; shading?: string }): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [textRun(text, { bold: opts?.bold, size: 20 })],
      alignment: AlignmentType.CENTER,
      bidirectional: true,
    })],
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    borders: cellBorders,
    shading: opts?.shading ? { fill: opts.shading } : undefined,
    verticalAlign: "center" as any,
  });
}

export async function exportInventoryCustodyDocx(data: InventoryCustodyData) {
  const headerRow = new TableRow({
    children: [
      tableCell("رقم السجل", { bold: true, width: 8, shading: "D9E2F3" }),
      tableCell("اللوازم", { bold: true, width: 22, shading: "D9E2F3" }),
      tableCell("الرصيد الفعلي", { bold: true, width: 10, shading: "D9E2F3" }),
      tableCell("الموجود", { bold: true, width: 10, shading: "D9E2F3" }),
      tableCell("النقص", { bold: true, width: 10, shading: "D9E2F3" }),
      tableCell("الزيادة", { bold: true, width: 10, shading: "D9E2F3" }),
      tableCell("السعر الإفرادي", { bold: true, width: 15, shading: "D9E2F3" }),
      tableCell("السعر الإجمالي", { bold: true, width: 15, shading: "D9E2F3" }),
    ],
    tableHeader: true,
  });

  const dataRows = data.items.map(item => new TableRow({
    children: [
      tableCell(String(item.serialNumber)),
      tableCell(item.itemName),
      tableCell(String(item.actualBalance)),
      tableCell(String(item.existing)),
      tableCell(String(item.shortage)),
      tableCell(String(item.surplus)),
      tableCell(item.unitPrice ? item.unitPrice.toFixed(2) : ""),
      tableCell(item.totalPrice ? item.totalPrice.toFixed(2) : ""),
    ],
  }));

  // Add empty rows to fill page
  const minRows = 20;
  for (let i = data.items.length; i < minRows; i++) {
    dataRows.push(new TableRow({
      children: Array(8).fill(null).map(() => tableCell("")),
    }));
  }

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } },
      },
      children: [
        para([textRun("وزارة التربية والتعليم", { bold: true, size: 28 })], AlignmentType.CENTER),
        para([textRun("نموذج جرد مستودعات المدارس", { bold: true, size: 32, underline: true })], AlignmentType.CENTER),
        emptyLine(),
        para([
          textRun(`اسم المدرسة: ${data.school}`, { size: FONT_SIZE }),
          textRun("          ", {}),
          textRun(`المديرية: ${data.directorate || ".................."}`, { size: FONT_SIZE }),
        ]),
        para([textRun(`التصنيف: ${data.categoryLabel}`, { bold: true, size: FONT_SIZE })]),
        para([textRun(`التاريخ: ${data.date}`, { size: 20 })]),
        emptyLine(),
        table,
        emptyLine(),
        para([textRun("أقر بأن العهدة الموجودة والمسؤول عنها قد تم جردها وأن النتائج المدونة على القوائم صحيحة.", { size: 20 })]),
        emptyLine(),
        para([
          textRun(`اسم مدير المدرسة: ${data.directorName}`, { size: FONT_SIZE }),
          textRun("          ", {}),
          textRun(`اسم العضو: ${data.committeeMember}`, { size: FONT_SIZE }),
        ]),
        para([
          textRun("التوقيع: ................................", { size: 20 }),
          textRun("          ", {}),
          textRun("التوقيع: ................................", { size: 20 }),
        ]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `جرد_${data.categoryLabel}_${data.school}.docx`);
}
