import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";

const FONT = "Traditional Arabic";
const S = 18; // compact body
const M = 20; // normal body  
const L = 24; // section headers
const XL = 28; // titles
const XXL = 30; // big titles

// ─── Logo ───
let logoBuffer: ArrayBuffer | null = null;
async function getLogoBuffer(): Promise<ArrayBuffer> {
  if (logoBuffer) return logoBuffer;
  const resp = await fetch(`${import.meta.env.BASE_URL}images/moe-logo.png`);
  logoBuffer = await resp.arrayBuffer();
  return logoBuffer;
}

function logoHeader(buffer: ArrayBuffer): Paragraph {
  return new Paragraph({
    children: [new ImageRun({ data: buffer, transformation: { width: 70, height: 70 }, type: "png" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    bidirectional: true,
  });
}

// ─── Helpers ───
function t(text: string, opts?: { bold?: boolean; size?: number; underline?: boolean }): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size || M,
    bold: opts?.bold,
    underline: opts?.underline ? {} : undefined,
    rightToLeft: true,
  });
}

function p(runs: TextRun[], align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.RIGHT, sp?: { before?: number; after?: number }): Paragraph {
  return new Paragraph({
    children: runs,
    alignment: align,
    bidirectional: true,
    spacing: { before: sp?.before ?? 30, after: sp?.after ?? 30 },
  });
}

function gap(size = 30): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "", size: 2 })], spacing: { before: size, after: size } });
}

function dots(n = 70): string { return ".".repeat(n); }

const bdr = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const borders = { top: bdr, bottom: bdr, left: bdr, right: bdr };

function c(text: string, opts?: { bold?: boolean; width?: number; shading?: string; size?: number; align?: typeof AlignmentType[keyof typeof AlignmentType]; colspan?: number }): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [t(text, { bold: opts?.bold, size: opts?.size || S })],
      alignment: opts?.align || AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 20, after: 20 },
    })],
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    borders,
    shading: opts?.shading ? { fill: opts.shading } : undefined,
    verticalAlign: "center" as any,
    columnSpan: opts?.colspan,
  });
}

// page properties for single-page A4 portrait, tight margins
const PAGE_A4 = { size: { width: 12240, height: 15840 }, margin: { top: 500, bottom: 400, left: 700, right: 700 } };

// ═══════════════════════════════════════════════════════════════
// 1. نموذج استجواب
// ═══════════════════════════════════════════════════════════════
export interface InterrogationData {
  school: string;
  directorate: string;
  employeeName: string;
  category: string;
  jobTitle: string;
  previousPenalties: string;
  subject: string;
  details: string;
  directorName: string;
}

export async function fillInterrogationForm(data: InterrogationData) {
  const logo = await getLogoBuffer();
  const SH = "E8EDF5";

  const part1 = new Table({
    rows: [
      new TableRow({ children: [
        c("الوظيفة", { bold: true, width: 25, shading: SH }),
        c("الفئة / الدرجة", { bold: true, width: 25, shading: SH }),
        c("اسم الموظف من أربع مقاطع", { bold: true, width: 50, shading: SH }),
      ]}),
      new TableRow({ children: [
        c(data.jobTitle || "", { width: 25 }),
        c(data.category || "", { width: 25 }),
        c(data.employeeName, { width: 50 }),
      ]}),
      new TableRow({ children: [
        c(`القسم: ${data.school}`, { width: 25, align: AlignmentType.RIGHT }),
        c(`المديرية: ${data.directorate || "لواءي الطيبة والوسطية"}`, { width: 25, align: AlignmentType.RIGHT }),
        c("مكان العمل: وزارة التربية والتعليم", { width: 50, align: AlignmentType.RIGHT }),
      ]}),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: { page: PAGE_A4 },
      children: [
        logoHeader(logo),
        p([t("ديوان الخدمة المدنية", { bold: true, size: L }), t("                                        "), t("الدائرة وزارة التربية والتعليم", { bold: true, size: L })], AlignmentType.CENTER),
        p([t("نموذج استجواب", { bold: true, size: XXL, underline: true })], AlignmentType.CENTER),
        p([t("عن المخالفة المرتكبة من قبل الموظف", { bold: true, size: M })], AlignmentType.CENTER),
        p([t("(سنداً لأحكام المادة 72/أ/1 من نظام إدارة الموارد البشرية للقطاع العام رقم (33) لسنة 2024)", { size: S })], AlignmentType.CENTER),
        gap(20),
        p([t("الجزء الأول: (يعبأ من قبل مسؤول شؤون الموظفين)", { bold: true, size: M, underline: true })], AlignmentType.CENTER),
        gap(10),
        part1,
        p([t(`العقوبات التأديبية السابقة المتخذة بحق الموظف: ${data.previousPenalties || dots(50)}`, { size: S })]),
        gap(10),
        p([t("الجزء الثاني: (يعبأ من قبل الرئيس المباشر للموظف)", { bold: true, size: M, underline: true })], AlignmentType.CENTER),
        p([t(`موضوع الاستفسار: ${data.subject || ""}`, { size: M })]),
        p([t(data.details || "", { size: S })]),
        gap(80),
        p([t("التوقيع:", { bold: true, size: M })]),
        gap(10),
        p([t("الجزء الثالث: (يعبأ من قبل الموظف المستجوب)", { bold: true, size: M, underline: true })], AlignmentType.CENTER),
        p([t("الإجابة:", { size: M })]),
        gap(120),
        p([t("التوقيع:", { bold: true, size: M })]),
        gap(10),
        p([t("الجزء الرابع: القرار متخذ وفقاً للصلاحيات المنصوص عليها في المادة (68/أ) من إدارة الموارد البشرية رقم (33) لسنة 2024", { size: S })], AlignmentType.RIGHT),
        p([t(`تنسيب / قرار مدير المدرسة: ${dots(50)}`, { size: S })]),
        p([t("التوقيع:", { size: S })]),
        p([t(`تنسيب / قرار مدير التربية والتعليم: ${dots(50)}`, { size: S })]),
        p([t("التوقيع:                              التاريخ:    /    /", { size: S })]),
        p([t(`تنسيب / قرار الأمين العام: ${dots(50)}`, { size: S })]),
        p([t("التوقيع:                              التاريخ:    /    /", { size: S })]),
        p([t(`تنسيب /قرار الرئيس: ${dots(50)}`, { size: S })]),
        p([t("التوقيع:                              التاريخ:    /    /", { size: S })]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `استجواب_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════════════════════════════
// 2. نموذج إجازة عرضية
// ═══════════════════════════════════════════════════════════════
export interface CasualLeaveData {
  school: string;
  directorate: string;
  employeeName: string;
  employeeNumber: string;
  jobTitle: string;
  section: string;
  department: string;
  leaveReason: string;
  deathRelation: string;
  otherReasons: string;
  daysEntitled: string;
  totalLeavesThisYear: string;
  startDate: string;
  endDate: string;
  notes: string;
  directorName: string;
}

export async function fillCasualLeaveForm(data: CasualLeaveData) {
  const logo = await getLogoBuffer();
  const H = "D6E4F0";

  const infoTable = new Table({
    rows: [
      new TableRow({ children: [c("بيانات الموظف/ الموظفة", { bold: true, colspan: 3, shading: H, size: M })] }),
      new TableRow({ children: [
        c(`المسمى الوظيفي: ${data.jobTitle || ""}`, { width: 33, align: AlignmentType.RIGHT }),
        c(`الرقم الوزاري: ${data.employeeNumber || ""}`, { width: 34, align: AlignmentType.RIGHT }),
        c(`الاسم: ${data.employeeName}`, { width: 33, align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        c(`الشعبة: ${data.department || data.school}`, { width: 33, align: AlignmentType.RIGHT }),
        c(`القسم: ${data.section || ""}`, { width: 34, align: AlignmentType.RIGHT }),
        c(`الإدارة:`, { width: 33, align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        c("", { width: 33 }),
        c(`المديرية: ${data.directorate || "لواءي الطيبة والوسطية"}`, { width: 34, align: AlignmentType.RIGHT }),
        c("", { width: 33 }),
      ]}),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const leaveHeader = new Table({
    rows: [new TableRow({ children: [
      c("بيانات الإجازة (تعبأ من قبل الموظف المعني في الوحدة التنظيمية المعنية بالموارد البشرية والتطوير المؤسسي)", { bold: true, shading: H, size: S }),
    ]})],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: { page: PAGE_A4 },
      children: [
        logoHeader(logo),
        p([t("المملكة الأردنية الهاشمية", { bold: true, size: L })], AlignmentType.CENTER),
        p([t("نموذج إجازة عرضية", { bold: true, size: XXL, underline: true })], AlignmentType.CENTER),
        gap(10),
        infoTable,
        gap(10),
        leaveHeader,
        p([t("سبب الإجازة:", { bold: true, size: M })]),
        p([t("وفاة أحد الأقارب:  ☐  من الدرجة الأولى    من الدرجة الثانية    من الدرجة الثالثة    زوجة/ زوج", { size: S })]),
        p([t("☐ أسباب أخرى ( خاص بمن تنطبق عليهم أحكام المادة (35-ج) من نظام إدارة الموارد البشرية في القطاع العام):", { size: S })]),
        p([t(data.otherReasons || data.leaveReason || dots(60), { size: S })]),
        p([t(dots(80), { size: S })]),
        p([t(`عدد الأيام المستحقة بموجب أحكام المواد (53) و(54) من نظام إدارة الموارد البشرية في القطاع العام: ( ${data.daysEntitled || "  "} ) يوم`, { size: S })]),
        p([t(`مجموع الإجازات العرضية التي تم منحها للموظف خلال العام: ( ${data.totalLeavesThisYear || "  "} ) يوم`, { size: S })]),
        p([t(`تاريخ ابتداء الإجازة: ${data.startDate || "  /  /  "}                    تاريخ انتهاء الإجازة: ${data.endDate || "  /  /  "}`, { size: S })]),
        p([t(`ملاحظات: ${data.notes || dots(60)}`, { size: S })]),
        p([t(dots(80), { size: S })]),
        gap(20),
        p([t("الأسم:                    المسمى الوظيفي:                    التوقيع:", { size: M })]),
        gap(10),
        new Table({
          rows: [new TableRow({ children: [c("قرار الأمين العام", { bold: true, shading: H, size: M })] })],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        p([t(dots(80), { size: S })]),
        p([t(dots(80), { size: S })]),
        p([t(dots(80), { size: S })]),
        gap(20),
        p([t("التاريخ:    /    /                                                    التوقيع", { size: M })]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `إجازة_عرضية_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════════════════════════════
// 3. نموذج عدم صرف
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
  const logo = await getLogoBuffer();

  const doc = new Document({
    sections: [{
      properties: { page: PAGE_A4 },
      children: [
        logoHeader(logo),
        p([t("وزارة التربية والتعليم", { bold: true, size: XL })], AlignmentType.CENTER),
        p([t(`مديرية التربية والتعليم ${data.directorate || "للواءي الطيبة والوسطية"}/محافظة اربد`, { bold: true, size: L })], AlignmentType.CENTER),
        p([t(data.school, { bold: true, size: L })], AlignmentType.CENTER),
        gap(20),
        p([t("━".repeat(70), { size: 14 })], AlignmentType.CENTER),
        gap(20),
        p([t(`الرقم:`, { size: M })]),
        p([t(`التاريخ: ${data.date || ""}`, { size: M })]),
        p([t(`الموافق:`, { size: M })]),
        gap(40),
        p([t(`السيد / ${data.employeeName}`, { bold: true, size: L })], AlignmentType.CENTER),
        p([t(`المعلم في ${data.school}`, { bold: true, size: M })], AlignmentType.CENTER),
        p([t("الموضوع / التغيب عن العمل", { bold: true, size: L, underline: true })], AlignmentType.CENTER),
        gap(30),
        p([t("السلام عليكم ورحمة الله وبركاته   ،،،", { size: M })], AlignmentType.CENTER),
        gap(30),
        p([t(`إشارة إلى جوابك المؤرخ    /    / رقم              ، واستناداً إلى أحكام المادة (22) من نظام الخدمة المدنية لسنة 2020 وتعديلاته ودلالة المادة (143).`, { size: S })]),
        p([t(`وبموجب الصلاحيات المفوضة الى بكتاب وزير التربية والتعليم رقم 1/70/7886 تاريخ 10/2/2020.`, { size: S })]),
        p([t(`قررت عدم صرف راتبك عن يوم / الأيام  ${data.reason || dots(40)} بسبب تغيبك عن العمل دون إجازة قانونية أو عذر مشروع بعد انتهاء اجازتك مباشرة.`, { bold: true, size: M })]),
        gap(60),
        p([t("وتفضلوا بقبول فائق الاحترام", { bold: true, size: M })], AlignmentType.CENTER),
        gap(60),
        p([t("مدير المدرسة", { bold: true, size: M })]),
        p([t(data.directorName, { bold: true, size: M })]),
        gap(150),
        p([t(`نسخة / مدير التربية والتعليم ${data.directorate || "للواءي الطيبة والوسطية"}/محافظة اربد`, { bold: true, size: S })]),
        p([t("نسخة/للملف", { bold: true, size: S })]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `عدم_صرف_${data.employeeName}.docx`);
}

// ═══════════════════════════════════════════════════════════════
// 4. نموذج جرد عهدة - 9 items per page
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
  custodian: string;
  date: string;
}

export async function exportInventoryCustodyDocx(data: InventoryCustodyData) {
  const logo = await getLogoBuffer();
  const ITEMS_PER_PAGE = 9;
  const H = "D6E4F0";

  // Split items into pages
  const pages: InventoryCustodyItem[][] = [];
  for (let i = 0; i < data.items.length; i += ITEMS_PER_PAGE) {
    pages.push(data.items.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const splitPrice = (n: number) => {
    const d = Math.floor(n);
    const f = Math.round((n - d) * 1000);
    return { d: d > 0 ? String(d) : "", f: f > 0 ? String(f) : "" };
  };

  function buildPage(pageItems: InventoryCustodyItem[], pageNum: number, totalPages: number) {
    const headerRow = new TableRow({
      children: [
        c("ملاحظات", { bold: true, width: 8, shading: H }),
        c("السعر الإجمالي", { bold: true, width: 10, shading: H, colspan: 2 }),
        c("السعر الإفرادي", { bold: true, width: 10, shading: H, colspan: 2 }),
        c("الزيادة", { bold: true, width: 7, shading: H }),
        c("النقص", { bold: true, width: 7, shading: H }),
        c("الموجود", { bold: true, width: 8, shading: H }),
        c("رصيد الفعلي", { bold: true, width: 8, shading: H }),
        c("اللوازم", { bold: true, width: 20, shading: H }),
        c("رقم صفحة السجل", { bold: true, width: 8, shading: H }),
      ],
      tableHeader: true,
    });

    const dataRows = pageItems.map(item => {
      const up = splitPrice(item.unitPrice);
      const tp = splitPrice(item.totalPrice);
      return new TableRow({ children: [
        c(item.notes || ""),
        c(tp.d), c(tp.f),
        c(up.d), c(up.f),
        c(item.surplus ? String(item.surplus) : ""),
        c(item.shortage ? String(item.shortage) : ""),
        c(String(item.existing)),
        c(String(item.actualBalance)),
        c(item.itemName, { align: AlignmentType.RIGHT }),
        c(String(item.serialNumber)),
      ]});
    });

    // Fill empty rows to always have 9
    for (let i = pageItems.length; i < ITEMS_PER_PAGE; i++) {
      dataRows.push(new TableRow({ children: Array(11).fill(null).map(() => c("")) }));
    }

    const table = new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const pageLabel = totalPages > 1 ? ` - صفحة ${pageNum} من ${totalPages}` : "";

    return [
      logoHeader(logo),
      p([t("وزارة التربية والتعليم", { bold: true, size: L })], AlignmentType.CENTER),
      p([t(`نموذج جرد مستودعات المدارس ( ${data.categoryLabel} )${pageLabel}`, { bold: true, size: XL, underline: true })], AlignmentType.CENTER),
      gap(10),
      p([t(`اسم المدرسة : ${data.school}                              مديرية التربية والتعليم : ${data.directorate || dots(20)}`, { size: S })]),
      gap(10),
      table,
      gap(20),
      p([t("أقر أنا المسؤول عن العهدة بأن الجرد تم بحضوري ومعرفتي وأوافق على صحة القوائم ونتائجها من حيث النقص أو الزيادة ولا توجد أية مستودعات أخرى للوازم بالمدرسة غير التي جرى عليها الجرد وعليه أوقع على هذا المحضر", { size: 16 })]),
      gap(10),
      p([t(`عضو:                    اسم المعني بالعهدة: ${data.custodian || ""}                    اسم مدير المدرسة: ${data.directorName}`, { size: S })]),
      p([t("                                                والختم الرسمي", { size: S })]),
      p([t(`الاسم :                    الاسم : ${data.custodian || ""}                    الاسم : ${data.directorName}`, { size: S })]),
      p([t("التوقيع :                    التوقيع :                    التوقيع :", { size: S })]),
      p([t(`التاريخ : ${data.date}`, { size: S })]),
      p([t("Form#QF72-4-24 rev.a", { size: 14 })], AlignmentType.LEFT),
    ];
  }

  const sections = pages.map((pageItems, idx) => ({
    properties: { page: { ...PAGE_A4, margin: { top: 400, bottom: 300, left: 500, right: 500 } } },
    children: buildPage(pageItems, idx + 1, pages.length),
  }));

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `جرد_${data.categoryLabel}_${data.school}.docx`);
}
