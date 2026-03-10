import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Header, ImageRun } from "docx";
import { saveAs } from "file-saver";

const FONT = "Traditional Arabic";
const FONT_SIZE = 24;
const SMALL_SIZE = 20;
const TITLE_SIZE = 28;
const BIG_TITLE = 32;

// Load logo once and cache
let logoBuffer: ArrayBuffer | null = null;
async function getLogoBuffer(): Promise<ArrayBuffer> {
  if (logoBuffer) return logoBuffer;
  const resp = await fetch(`${import.meta.env.BASE_URL}images/moe-logo.png`);
  logoBuffer = await resp.arrayBuffer();
  return logoBuffer;
}

function logoImage(buffer: ArrayBuffer): ImageRun {
  return new ImageRun({
    data: buffer,
    transformation: { width: 80, height: 80 },
    type: "png",
  });
}

function logoHeader(buffer: ArrayBuffer): Paragraph {
  return new Paragraph({
    children: [logoImage(buffer)],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  });
}

function tr(text: string, opts?: { bold?: boolean; size?: number; underline?: boolean; color?: string }): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size || FONT_SIZE,
    bold: opts?.bold,
    underline: opts?.underline ? {} : undefined,
    color: opts?.color,
    rightToLeft: true,
  });
}

function para(runs: TextRun[], alignment: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.RIGHT, spacing?: { before?: number; after?: number }): Paragraph {
  return new Paragraph({
    children: runs,
    alignment,
    bidirectional: true,
    spacing: { before: spacing?.before ?? 60, after: spacing?.after ?? 60 },
  });
}

function emptyLine(size = 60): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "", size: 2 })], spacing: { before: size, after: size } });
}

function dots(count = 80): string {
  return ".".repeat(count);
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
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function cell(text: string, opts?: { bold?: boolean; width?: number; shading?: string; borders?: any; size?: number; alignment?: typeof AlignmentType[keyof typeof AlignmentType]; colspan?: number }): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [tr(text, { bold: opts?.bold, size: opts?.size || SMALL_SIZE })],
      alignment: opts?.alignment || AlignmentType.CENTER,
      bidirectional: true,
    })],
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    borders: opts?.borders || cellBorders,
    shading: opts?.shading ? { fill: opts.shading } : undefined,
    verticalAlign: "center" as any,
    columnSpan: opts?.colspan,
  });
}

// ═══════════════════════════════════════════════════════════════
// 1. نموذج استجواب - Interrogation Form (matching exact template)
// ═══════════════════════════════════════════════════════════════
export interface InterrogationData {
  school: string;
  directorate: string;
  employeeName: string;
  category: string; // الفئة / الدرجة
  jobTitle: string; // الوظيفة
  previousPenalties: string;
  subject: string;
  details: string;
  directorName: string;
}

export async function fillInterrogationForm(data: InterrogationData) {
  const logo = await getLogoBuffer();
  // Part 1 table
  const part1Table = new Table({
    rows: [
      new TableRow({
        children: [
          cell("الوظيفة", { bold: true, width: 25, shading: "E8EDF5" }),
          cell("الفئة / الدرجة", { bold: true, width: 25, shading: "E8EDF5" }),
          cell("اسم الموظف من أربع مقاطع", { bold: true, width: 50, shading: "E8EDF5" }),
        ],
      }),
      new TableRow({
        children: [
          cell(data.jobTitle || "", { width: 25 }),
          cell(data.category || "", { width: 25 }),
          cell(data.employeeName, { width: 50 }),
        ],
      }),
      new TableRow({
        children: [
          cell(`القسم: ${data.school}`, { width: 25, alignment: AlignmentType.RIGHT }),
          cell(`المديرية: ${data.directorate || "لواءي الطيبة والوسطية"}`, { width: 25, alignment: AlignmentType.RIGHT }),
          cell("مكان العمل: وزارة التربية والتعليم", { width: 50, alignment: AlignmentType.RIGHT }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 900, right: 900 } },
      },
      children: [
        logoHeader(logo),
        para([
          tr("ديوان الخدمة المدنية", { bold: true, size: TITLE_SIZE }),
          tr("                                        "),
          tr("الدائرة وزارة التربية والتعليم", { bold: true, size: TITLE_SIZE }),
        ], AlignmentType.CENTER),
        para([tr("نموذج استجواب", { bold: true, size: BIG_TITLE, underline: true })], AlignmentType.CENTER),
        para([tr("عن المخالفة المرتكبة من قبل الموظف", { bold: true, size: FONT_SIZE })], AlignmentType.CENTER),
        para([tr("(سنداً لأحكام المادة 72/أ/1 من نظام إدارة الموارد البشرية للقطاع العام رقم (33) لسنة 2024)", { size: SMALL_SIZE })], AlignmentType.CENTER),

        // Part 1
        para([tr("الجزء الأول: (يعبأ من قبل مسؤول شؤون الموظفين)", { bold: true, size: FONT_SIZE, underline: true })], AlignmentType.CENTER, { before: 200 }),
        emptyLine(40),
        part1Table,
        para([tr(`العقوبات التأديبية السابقة المتخذة بحق الموظف:`, { size: FONT_SIZE })]),
        para([tr(data.previousPenalties || dots(), { size: FONT_SIZE })]),

        // Part 2
        emptyLine(40),
        para([tr("الجزء الثاني: (يعبأ من قبل الرئيس المباشر للموظف)", { bold: true, size: FONT_SIZE, underline: true })], AlignmentType.CENTER),
        para([tr(`موضوع الاستفسار:`, { size: FONT_SIZE })]),
        para([tr(data.subject || "", { size: FONT_SIZE })]),
        para([tr(data.details || "", { size: FONT_SIZE })]),
        emptyLine(200),
        para([tr("التوقيع:", { bold: true, size: FONT_SIZE })]),

        // Part 3
        emptyLine(40),
        para([tr("الجزء الثالث: (يعبأ من قبل الموظف المستجوب)", { bold: true, size: FONT_SIZE, underline: true })], AlignmentType.CENTER),
        para([tr("الإجابة:", { size: FONT_SIZE })]),
        emptyLine(300),
        para([tr("التوقيع:", { bold: true, size: FONT_SIZE })]),

        // Part 4
        para([tr("الجزء الرابع: القرار متخذ وفقاً للصلاحيات المنصوص عليها في المادة (68/أ) من إدارة الموارد البشرية رقم (33) لسنة 2024", { size: SMALL_SIZE })], AlignmentType.RIGHT, { before: 200 }),
        
        para([tr(`تنسيب / قرار مدير المدرسة:`, { bold: true, size: FONT_SIZE })]),
        para([tr(dots(), { size: FONT_SIZE })]),
        para([tr("التوقيع:", { size: FONT_SIZE })]),
        emptyLine(40),
        para([tr("تنسيب / قرار مدير التربية والتعليم:", { bold: true, size: FONT_SIZE })]),
        para([tr(dots(), { size: FONT_SIZE })]),
        para([
          tr("التوقيع:                                        ", { size: FONT_SIZE }),
          tr("التاريخ:    /    /", { size: FONT_SIZE }),
        ]),
        para([tr("تنسيب / قرار الأمين العام:", { bold: true, size: FONT_SIZE })]),
        para([tr(dots(), { size: FONT_SIZE })]),
        para([
          tr("التوقيع:                                        ", { size: FONT_SIZE }),
          tr("التاريخ:    /    /", { size: FONT_SIZE }),
        ]),
        para([tr("تنسيب /قرار الرئيس:", { bold: true, size: FONT_SIZE })]),
        para([tr(dots(), { size: FONT_SIZE })]),
        para([
          tr("التوقيع:                                        ", { size: FONT_SIZE }),
          tr("التاريخ:    /    /", { size: FONT_SIZE }),
        ]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `استجواب_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════════════════════════════
// 2. نموذج إجازة عرضية - Casual Leave Form (matching exact template)
// ═══════════════════════════════════════════════════════════════
export interface CasualLeaveData {
  school: string;
  directorate: string;
  employeeName: string;
  employeeNumber: string;
  jobTitle: string;
  section: string; // القسم
  department: string; // الشعبة
  leaveReason: string; // سبب الإجازة
  deathRelation: string; // وفاة أحد الأقارب - الدرجة
  otherReasons: string;
  daysEntitled: string;
  totalLeavesThisYear: string;
  startDate: string;
  endDate: string;
  notes: string;
  directorName: string;
}

export async function fillCasualLeaveForm(data: CasualLeaveData) {
  // Employee info table
  const infoTable = new Table({
    rows: [
      new TableRow({
        children: [
          cell("بيانات الموظف/ الموظفة", { bold: true, colspan: 3, shading: "D6E4F0", size: FONT_SIZE }),
        ],
      }),
      new TableRow({
        children: [
          cell(`المسمى الوظيفي: ${data.jobTitle || ""}`, { width: 33, alignment: AlignmentType.RIGHT }),
          cell(`الرقم الوزاري: ${data.employeeNumber || ""}`, { width: 34, alignment: AlignmentType.RIGHT }),
          cell(`الاسم: ${data.employeeName}`, { width: 33, alignment: AlignmentType.RIGHT }),
        ],
      }),
      new TableRow({
        children: [
          cell(`الشعبة: ${data.department || data.school}`, { width: 33, alignment: AlignmentType.RIGHT }),
          cell(`القسم: ${data.section || ""}`, { width: 34, alignment: AlignmentType.RIGHT }),
          cell(`الإدارة:`, { width: 16, alignment: AlignmentType.RIGHT }),
        ],
      }),
      new TableRow({
        children: [
          cell("", { width: 33 }),
          cell(`المديرية: ${data.directorate || "لواءي الطيبة والوسطية"}`, { width: 34, alignment: AlignmentType.RIGHT }),
          cell("", { width: 33 }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // Leave details section
  const leaveTable = new Table({
    rows: [
      new TableRow({
        children: [
          cell("بيانات الإجازة (تعبأ من قبل الموظف المعني في الوحدة التنظيمية المعنية بالموارد البشرية والتطوير المؤسسي)", { bold: true, colspan: 1, shading: "D6E4F0", size: SMALL_SIZE }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 900, right: 900 } },
      },
      children: [
        // Header
        para([tr("المملكة الأردنية الهاشمية", { bold: true, size: TITLE_SIZE })], AlignmentType.CENTER),
        para([tr("نموذج إجازة عرضية", { bold: true, size: BIG_TITLE, underline: true })], AlignmentType.CENTER, { before: 100 }),
        emptyLine(40),
        infoTable,
        emptyLine(20),
        leaveTable,
        para([tr("سبب الإجازة:", { bold: true, size: FONT_SIZE })]),
        para([
          tr("وفاة أحد الأقارب:   ☐ ", { size: FONT_SIZE }),
          tr("من الدرجة الأولى        ", { size: FONT_SIZE }),
          tr("من الدرجة الثانية        ", { size: FONT_SIZE }),
          tr("من الدرجة الثالثة        ", { size: FONT_SIZE }),
          tr("زوجة/ زوج", { size: FONT_SIZE }),
        ]),
        para([
          tr("☐ أسباب أخرى ( خاص بمن تنطبق عليهم أحكام المادة (35-ج) من نظام إدارة الموارد البشرية في القطاع العام):", { size: FONT_SIZE }),
        ]),
        para([tr(data.otherReasons || data.leaveReason || dots(), { size: FONT_SIZE })]),
        para([tr(dots(), { size: FONT_SIZE })]),
        para([tr(`عدد الأيام المستحقة بموجب أحكام المواد (53) و(54) من نظام إدارة الموارد البشرية في القطاع العام: ( ${data.daysEntitled || "  "} ) يوم`, { size: FONT_SIZE })]),
        para([tr(`مجموع الإجازات العرضية التي تم منحها للموظف خلال العام: ( ${data.totalLeavesThisYear || "  "} ) يوم`, { size: FONT_SIZE })]),
        para([
          tr(`تاريخ ابتداء الإجازة: ${data.startDate || "  /  /  "}`, { size: FONT_SIZE }),
          tr("                              "),
          tr(`تاريخ انتهاء الإجازة: ${data.endDate || "  /  /  "}`, { size: FONT_SIZE }),
        ]),
        para([tr("ملاحظات:", { size: FONT_SIZE })]),
        para([tr(data.notes || dots(), { size: FONT_SIZE })]),
        para([tr(dots(), { size: FONT_SIZE })]),
        emptyLine(40),
        para([
          tr("الأسم:                              ", { size: FONT_SIZE }),
          tr("المسمى الوظيفي:                              ", { size: FONT_SIZE }),
          tr("التوقيع:", { size: FONT_SIZE }),
        ]),

        // Secretary General decision
        emptyLine(20),
        new Table({
          rows: [
            new TableRow({
              children: [
                cell("قرار الأمين العام", { bold: true, shading: "D6E4F0", size: FONT_SIZE }),
              ],
            }),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        para([tr(dots(), { size: FONT_SIZE })]),
        para([tr(dots(), { size: FONT_SIZE })]),
        para([tr(dots(), { size: FONT_SIZE })]),
        emptyLine(40),
        para([
          tr(`التاريخ:    /    /`, { size: FONT_SIZE }),
          tr("                                                          "),
          tr("التوقيع", { size: FONT_SIZE }),
        ]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `إجازة_عرضية_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════════════════════════════
// 3. نموذج عدم صرف - No-Payment Form (matching exact template)
// ═══════════════════════════════════════════════════════════════
export interface NoPaymentData {
  school: string;
  directorate: string;
  employeeName: string;
  date: string;
  refNumber: string;
  reason: string;
  daysAbsent: string;
  directorName: string;
}

export async function fillNoPaymentForm(data: NoPaymentData) {
  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 900, right: 900 } },
      },
      children: [
        para([tr("وزارة التربية والتعليم", { bold: true, size: BIG_TITLE })], AlignmentType.CENTER),
        para([tr(`مديرية التربية والتعليم ${data.directorate || "للواءي الطيبة والوسطية"}/محافظة اربد`, { bold: true, size: TITLE_SIZE })], AlignmentType.CENTER),
        para([tr(data.school, { bold: true, size: TITLE_SIZE })], AlignmentType.CENTER),
        emptyLine(40),
        // Horizontal line
        para([tr("━".repeat(70), { size: 16 })], AlignmentType.CENTER),
        emptyLine(40),
        para([tr(`الرقم:`, { size: FONT_SIZE })], AlignmentType.RIGHT),
        para([tr(`التاريخ: ${data.date || ""}`, { size: FONT_SIZE })], AlignmentType.RIGHT),
        para([tr(`الموافق:`, { size: FONT_SIZE })], AlignmentType.RIGHT),
        emptyLine(80),
        para([tr(`السيد / ${data.employeeName}`, { bold: true, size: FONT_SIZE })], AlignmentType.CENTER),
        para([tr(`المعلم في ${data.school}`, { bold: true, size: FONT_SIZE })], AlignmentType.CENTER),
        para([tr("الموضوع / التغيب عن العمل", { bold: true, size: TITLE_SIZE, underline: true })], AlignmentType.CENTER, { before: 100 }),
        emptyLine(60),
        para([tr("السلام عليكم ورحمة الله وبركاته   ،،،", { size: FONT_SIZE })], AlignmentType.CENTER),
        emptyLine(60),
        para([tr(`إشارة إلى جوابك المؤرخ    /    / رقم                 ، واستناداً إلى أحكام المادة (22) من نظام الخدمة المدنية لسنة 2020`, { size: FONT_SIZE })]),
        para([tr(`وتعديلاته ودلالة المادة (143).`, { size: FONT_SIZE })]),
        para([tr(`وبموجب الصلاحيات المفوضة الى بكتاب وزير التربية والتعليم رقم`, { size: FONT_SIZE })]),
        para([tr(`1/70/7886 تاريخ 10/2/2020. قررت عدم صرف راتبك عن يوم /`, { bold: true, size: FONT_SIZE })]),
        para([tr(`الأيام  ${data.reason || dots(60)} بسبب تغيبك عن العمل دون`, { bold: true, size: FONT_SIZE })]),
        para([tr(`إجازة قانونية أو عذر مشروع بعد انتهاء اجازتك مباشرة.`, { bold: true, size: FONT_SIZE })]),
        emptyLine(100),
        para([tr("وتفضلوا بقبول فائق الاحترام", { bold: true, size: FONT_SIZE })], AlignmentType.CENTER),
        emptyLine(80),
        para([tr("مدير المدرسة", { bold: true, size: FONT_SIZE })]),
        para([tr(data.directorName, { bold: true, size: FONT_SIZE })]),
        emptyLine(200),
        para([tr(`نسخة / مدير التربية والتعليم ${data.directorate || "للواءي الطيبة والوسطية"}/محافظة اربد`, { bold: true, size: SMALL_SIZE })]),
        para([tr("نسخة/للملف", { bold: true, size: SMALL_SIZE })]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `عدم_صرف_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════════════════════════════
// 4. نموذج جرد عهدة - Inventory Custody (matching exact template)
// ═══════════════════════════════════════════════════════════════
export interface InventoryCustodyItem {
  serialNumber: number;
  itemName: string;
  actualBalance: number;
  existing: number;
  shortage: number;
  surplus: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface InventoryCustodyData {
  school: string;
  directorate: string;
  categoryLabel: string;
  items: InventoryCustodyItem[];
  directorName: string;
  committeeMember: string;
  custodian: string; // المعني بالعهدة
  date: string;
}

export async function exportInventoryCustodyDocx(data: InventoryCustodyData) {
  const splitPrice = (n: number) => {
    const dinars = Math.floor(n);
    const fils = Math.round((n - dinars) * 1000);
    return { d: dinars > 0 ? String(dinars) : "", f: fils > 0 ? String(fils) : "" };
  };

  // Header row with split price columns
  const headerRow = new TableRow({
    children: [
      cell("ملاحظات", { bold: true, width: 8, shading: "D6E4F0" }),
      cell("السعر الإجمالي", { bold: true, width: 10, shading: "D6E4F0", colspan: 2 }),
      cell("السعر الإفرادي", { bold: true, width: 10, shading: "D6E4F0", colspan: 2 }),
      cell("الزيادة", { bold: true, width: 7, shading: "D6E4F0" }),
      cell("النقص", { bold: true, width: 7, shading: "D6E4F0" }),
      cell("الموجود", { bold: true, width: 8, shading: "D6E4F0" }),
      cell("رصيد الفعلي", { bold: true, width: 8, shading: "D6E4F0" }),
      cell("اللوازم", { bold: true, width: 20, shading: "D6E4F0" }),
      cell("رقم صفحة السجل", { bold: true, width: 8, shading: "D6E4F0" }),
    ],
    tableHeader: true,
  });

  // Sub-header for price columns
  const subHeaderRow = new TableRow({
    children: [
      cell("", { shading: "D6E4F0" }),
      cell("د", { bold: true, shading: "D6E4F0" }),
      cell("ف", { bold: true, shading: "D6E4F0" }),
      cell("د", { bold: true, shading: "D6E4F0" }),
      cell("ف", { bold: true, shading: "D6E4F0" }),
      cell("", { shading: "D6E4F0" }),
      cell("", { shading: "D6E4F0" }),
      cell("", { shading: "D6E4F0" }),
      cell("", { shading: "D6E4F0" }),
      cell("", { shading: "D6E4F0" }),
      cell("", { shading: "D6E4F0" }),
    ],
  });

  const dataRows = data.items.map(item => {
    const up = splitPrice(item.unitPrice);
    const tp = splitPrice(item.totalPrice);
    return new TableRow({
      children: [
        cell(item.notes || ""),
        cell(tp.d),
        cell(tp.f),
        cell(up.d),
        cell(up.f),
        cell(item.surplus ? String(item.surplus) : ""),
        cell(item.shortage ? String(item.shortage) : ""),
        cell(String(item.existing)),
        cell(String(item.actualBalance)),
        cell(item.itemName, { alignment: AlignmentType.RIGHT }),
        cell(String(item.serialNumber)),
      ],
    });
  });

  // Add empty rows to fill page
  const minRows = 15;
  for (let i = data.items.length; i < minRows; i++) {
    dataRows.push(new TableRow({
      children: Array(11).fill(null).map(() => cell("")),
    }));
  }

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 500, left: 720, right: 720 } },
      },
      children: [
        para([tr("وزارة التربية والتعليم", { bold: true, size: TITLE_SIZE })], AlignmentType.CENTER),
        para([tr(`نموذج جرد مستودعات المدارس ( ${data.categoryLabel} )`, { bold: true, size: BIG_TITLE, underline: true })], AlignmentType.CENTER),
        emptyLine(40),
        para([
          tr(`اسم المدرسة : ${data.school}`, { size: FONT_SIZE }),
          tr("                                                          "),
          tr(`مديرية التربية والتعليم : ${data.directorate || dots(30)}`, { size: FONT_SIZE }),
        ]),
        para([tr(dots(30), { size: FONT_SIZE })]),
        emptyLine(20),
        table,
        emptyLine(40),
        para([tr("أقر أنا المسؤول عن العهدة بأن الجرد تم بحضوري ومعرفتي وأوافق على صحة القوائم ونتائجها من حيث النقص أو الزيادة ولا توجد أية", { size: SMALL_SIZE })]),
        para([tr("مستودعات أخرى ل للوازم بالمدرسة غير التي جرى عليها الجرد وعليه أوقع على هذا المحضر", { size: SMALL_SIZE })]),
        emptyLine(20),
        para([
          tr(`عضو:                              `, { size: FONT_SIZE }),
          tr(`اسم المعني بالعهدة                              `, { size: FONT_SIZE }),
          tr(`اسم مدير المدرسة: ${data.directorName}`, { size: FONT_SIZE }),
        ]),
        para([tr("                                                          والختم الرسمي", { size: FONT_SIZE })]),
        para([
          tr(`الاسم :                              `, { size: FONT_SIZE }),
          tr(`الاسم : ${data.custodian || ""}                              `, { size: FONT_SIZE }),
          tr(`الاسم : ${data.directorName}`, { size: FONT_SIZE }),
        ]),
        para([
          tr(`التوقيع :                              `, { size: FONT_SIZE }),
          tr(`التوقيع :                              `, { size: FONT_SIZE }),
          tr("التوقيع :", { size: FONT_SIZE }),
        ]),
        para([tr(`التاريخ : ${data.date}`, { size: FONT_SIZE })]),
        emptyLine(20),
        para([tr("Form#QF72-4-24 rev.a", { size: 16 })], AlignmentType.LEFT),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `جرد_${data.categoryLabel}_${data.school}.docx`);
}
