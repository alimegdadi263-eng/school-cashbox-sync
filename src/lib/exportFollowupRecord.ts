import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, VerticalAlign, PageOrientation, PageBreak } from "docx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Teacher } from "@/types/timetable";
import { DAYS } from "@/types/timetable";

/**
 * سجل المتابعة للمعلمات
 * يحتوي على صفحات: التحضير اليومي (25 خانة) / الخطط (5 خانات) / المناوبة الأسبوعية
 * / سجل الحضور والغياب (شهر 8 حتى شهر 6) / سجل الأداء والعلامات (فصلان × 4 أعمدة)
 * الأسماء تؤخذ من معلمي الجدول المدرسي.
 */

const FONT_NAME = "Traditional Arabic";
const NAVY = "FF2B3A55";
const GOLD = "FFD4A84B";

const MONTHS = [
  "آب (8)", "أيلول (9)", "تشرين أول (10)", "تشرين ثاني (11)", "كانون أول (12)",
  "كانون ثاني (1)", "شباط (2)", "آذار (3)", "نيسان (4)", "أيار (5)", "حزيران (6)",
];

const MARK_COLS = ["الشهر الأول", "الشهر الثاني", "الشهر الثالث", "النهائي"];

function border(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
}

function styleHeader(cell: ExcelJS.Cell, fill = NAVY) {
  cell.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = border();
}

function styleBody(cell: ExcelJS.Cell, bold = false) {
  cell.font = { name: FONT_NAME, size: 11, bold };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = border();
}

function addTitle(ws: ExcelJS.Worksheet, text: string, span: number) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const c = row.getCell(1);
  c.font = { name: FONT_NAME, bold: true, size: 15, color: { argb: NAVY } };
  c.alignment = { horizontal: "center", vertical: "middle" };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
  row.height = 26;
  ws.addRow([]);
}

/** صفحة بسيطة: م + الاسم + عدد من الخانات الفارغة */
function addGridSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  names: string[],
  colHeaders: string[],
  nameColWidth = 26,
) {
  const ws = wb.addWorksheet(sheetName);
  ws.views = [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 4 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const span = colHeaders.length + 2;
  addTitle(ws, title, span);

  const header = ws.addRow(["م", "اسم المعلمة", ...colHeaders]);
  header.eachCell(c => styleHeader(c));
  header.height = 34;

  names.forEach((name, i) => {
    const row = ws.addRow([i + 1, name, ...colHeaders.map(() => "")]);
    row.eachCell({ includeEmpty: true }, (c, idx) => styleBody(c, idx === 2));
    row.getCell(2).alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    row.height = 22;
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = nameColWidth;
  for (let i = 3; i <= span; i++) ws.getColumn(i).width = Math.max(6, Math.min(16, colHeaders[i - 3].length + 3));
  return ws;
}

/** صفحة بعناوين مجمّعة (مجموعتان أو أكثر فوق أعمدة فرعية) */
function addGroupedSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  names: string[],
  groups: { label: string; cols: string[] }[],
) {
  const ws = wb.addWorksheet(sheetName);
  ws.views = [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 5 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const totalCols = 2 + groups.reduce((s, g) => s + g.cols.length, 0);
  addTitle(ws, title, totalCols);

  const topRow = ws.addRow([]);
  const subRow = ws.addRow([]);

  ws.mergeCells(topRow.number, 1, subRow.number, 1);
  ws.mergeCells(topRow.number, 2, subRow.number, 2);
  styleHeader(topRow.getCell(1));
  styleHeader(topRow.getCell(2));
  topRow.getCell(1).value = "م";
  topRow.getCell(2).value = "اسم المعلمة";

  let col = 3;
  groups.forEach(g => {
    const start = col;
    const end = col + g.cols.length - 1;
    topRow.getCell(start).value = g.label;
    if (end > start) ws.mergeCells(topRow.number, start, topRow.number, end);
    for (let c = start; c <= end; c++) styleHeader(topRow.getCell(c), GOLD);
    topRow.getCell(start).font = { name: FONT_NAME, bold: true, size: 12, color: { argb: NAVY } };
    g.cols.forEach((cn, i) => {
      const cell = subRow.getCell(start + i);
      cell.value = cn;
      styleHeader(cell);
    });
    col = end + 1;
  });
  topRow.height = 24;
  subRow.height = 34;

  names.forEach((name, i) => {
    const row = ws.addRow([i + 1, name]);
    for (let c = 3; c <= totalCols; c++) row.getCell(c).value = "";
    row.eachCell({ includeEmpty: true }, (c, idx) => styleBody(c, idx === 2));
    row.getCell(2).alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    row.height = 22;
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 26;
  for (let c = 3; c <= totalCols; c++) ws.getColumn(c).width = 13;
  return ws;
}

/** صفحة التحضير: صف للتاريخ فوق أرقام الخانات */
function addPrepSheet(wb: ExcelJS.Workbook, title: string, names: string[], boxes = 25) {
  const ws = wb.addWorksheet("التحضير");
  ws.views = [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 5 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const span = boxes + 2;
  addTitle(ws, title, span);

  const dateRow = ws.addRow([]);
  const numRow = ws.addRow([]);
  ws.mergeCells(dateRow.number, 1, numRow.number, 1);
  ws.mergeCells(dateRow.number, 2, numRow.number, 2);
  dateRow.getCell(1).value = "م";
  dateRow.getCell(2).value = "اسم المعلمة";
  styleHeader(dateRow.getCell(1));
  styleHeader(dateRow.getCell(2));

  for (let i = 0; i < boxes; i++) {
    const c = i + 3;
    const dc = dateRow.getCell(c);
    dc.value = "";
    styleHeader(dc, GOLD);
    dc.font = { name: FONT_NAME, bold: true, size: 10, color: { argb: NAVY } };
    dc.numFmt = "dd/mm";
    const nc = numRow.getCell(c);
    nc.value = i + 1;
    styleHeader(nc);
  }
  dateRow.getCell(3).note = "اكتب تاريخ التحضير هنا";
  dateRow.height = 24;
  numRow.height = 20;

  names.forEach((name, i) => {
    const row = ws.addRow([i + 1, name]);
    for (let c = 3; c <= span; c++) row.getCell(c).value = "";
    row.eachCell({ includeEmpty: true }, (c, idx) => styleBody(c, idx === 2));
    row.getCell(2).alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    row.height = 22;
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 26;
  for (let c = 3; c <= span; c++) ws.getColumn(c).width = 7;
  return ws;
}

/** التخصص الأساسي للمعلمة (المادة صاحبة أكبر عدد حصص) */
function mainSubject(t: Teacher): string {
  const counts = new Map<string, number>();
  (t.subjects || []).forEach(s => {
    const n = (s.subjectName || "").trim();
    if (!n) return;
    counts.set(n, (counts.get(n) || 0) + (s.periodsPerWeek || 1));
  });
  let best = "";
  let max = -1;
  counts.forEach((v, k) => { if (v > max) { max = v; best = k; } });
  return best || "غير محدد";
}

/** فترات المناوبة المطلوبة */
const DUTY_SLOTS = ["الحصة الأولى", "الفرصة", "الحصة الخامسة", "الحصة السابعة"];

/**
 * صفحة المناوبة: كل يوم 8 مناوبات، مع عمودي «ناوب ✓» و«لم يناوب ✗» لكل فترة مناوبة.
 * يتم توزيع المعلمات على الأيام بحيث تجتمع معلمات التخصص الواحد في يوم واحد،
 * ويُكمَّل النقص من تخصصات أخرى.
 */
function dutyDistribution(teachers: Teacher[], perDay = 8) {
  const bySubject = new Map<string, string[]>();
  teachers.forEach(t => {
    const name = t.name.trim();
    if (!name) return;
    const subj = mainSubject(t);
    if (!bySubject.has(subj)) bySubject.set(subj, []);
    if (!bySubject.get(subj)!.includes(name)) bySubject.get(subj)!.push(name);
  });
  const queue: { name: string; subject: string }[] = [];
  [...bySubject.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([subj, list]) => list.forEach(name => queue.push({ name, subject: subj })));
  const days: { name: string; subject: string }[][] = DAYS.map(() => []);
  queue.forEach((entry, i) => days[Math.floor(i / perDay) % DAYS.length].push(entry));
  return days;
}

function addDutySheet(wb: ExcelJS.Workbook, title: string, teachers: Teacher[], perDay = 8, slots = DUTY_SLOTS) {

  const ws = wb.addWorksheet("المناوبة");
  ws.views = [{ rightToLeft: true, state: "frozen", xSplit: 3, ySplit: 5 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const days = dutyDistribution(teachers, perDay);

  const totalCols = 3 + slots.length * 2;
  addTitle(ws, title, totalCols);

  const topRow = ws.addRow([]);
  const subRow = ws.addRow([]);
  ["اليوم", "اسم المعلمة", "التخصص"].forEach((h, i) => {
    ws.mergeCells(topRow.number, i + 1, subRow.number, i + 1);
    topRow.getCell(i + 1).value = h;
    styleHeader(topRow.getCell(i + 1));
  });
  slots.forEach((slot, w) => {
    const start = 4 + w * 2;
    topRow.getCell(start).value = slot;
    ws.mergeCells(topRow.number, start, topRow.number, start + 1);
    styleHeader(topRow.getCell(start), GOLD);
    styleHeader(topRow.getCell(start + 1), GOLD);
    topRow.getCell(start).font = { name: FONT_NAME, bold: true, size: 12, color: { argb: NAVY } };
    const c1 = subRow.getCell(start);
    c1.value = "ناوب ✓";
    styleHeader(c1);
    const c2 = subRow.getCell(start + 1);
    c2.value = "لم يناوب ✗";
    styleHeader(c2);
  });

  topRow.height = 24;
  subRow.height = 26;

  DAYS.forEach((day, di) => {
    const startRow = ws.rowCount + 1;
    for (let i = 0; i < perDay; i++) {
      const entry = days[di][i];
      const row = ws.addRow(["", entry?.name || "", entry?.subject || ""]);
      for (let c = 4; c <= totalCols; c++) row.getCell(c).value = "";
      row.eachCell({ includeEmpty: true }, (c, idx) => styleBody(c, idx === 2));
      row.getCell(2).alignment = { horizontal: "right", vertical: "middle", indent: 1 };
      row.height = 22;
    }
    const endRow = ws.rowCount;
    ws.mergeCells(startRow, 1, endRow, 1);
    const dc = ws.getCell(startRow, 1);
    dc.value = day;
    styleBody(dc, true);
    dc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  });

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 18;
  for (let c = 4; c <= totalCols; c++) ws.getColumn(c).width = 11;
  return ws;
}

/** أسماء الخطط المطلوبة */
const PLAN_NAMES = ["خطط الأنشطة", "خطط فصلية", "خطة نمو مهني", "خطة 4", "خطة 5"];

export async function exportFollowupRecordExcel(teachers: Teacher[], schoolName: string) {
  const names = [...new Set(teachers.map(t => t.name.trim()).filter(Boolean))];
  if (names.length === 0) throw new Error("لا يوجد معلمات في الجدول المدرسي");

  const wb = new ExcelJS.Workbook();
  wb.creator = schoolName;

  // 1) التحضير اليومي — 25 خانة مع صف التاريخ
  addPrepSheet(wb, `${schoolName} — سجل المتابعة / متابعة التحضير اليومي`, names, 25);

  // 2) الخطط — بأسمائها
  addGridSheet(
    wb, "الخطط", `${schoolName} — سجل المتابعة / متابعة الخطط`,
    names, PLAN_NAMES,
  );

  // 3) المناوبة الأسبوعية — 8 مناوبات لكل يوم حسب التخصص
  addDutySheet(wb, `${schoolName} — سجل المتابعة / جدول المناوبة الأسبوعي`, teachers);

  // 4) الحضور والغياب — من شهر 8 إلى شهر 6
  addGridSheet(
    wb, "الحضور والغياب", `${schoolName} — سجل المتابعة / سجل الحضور والغياب`,
    names, MONTHS, 26,
  );

  // 5) الأداء والعلامات — الفصلان
  addGroupedSheet(
    wb, "العلامات", `${schoolName} — سجل المتابعة / سجل الأداء والعلامات`,
    names,
    [
      { label: "الفصل الدراسي الأول", cols: MARK_COLS },
      { label: "الفصل الدراسي الثاني", cols: MARK_COLS },
    ],
  );

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `سجل المتابعة - ${schoolName}.xlsx`);
}


/* ============================ تصدير Word (سجل المتابعة) ============================ */

const PAGE_W = 15840; // عرض صفحة أفقية (Letter landscape)
const CONTENT_W = 15840 - 1440; // بهوامش 0.5 بوصة على الجانبين

function dtxt(text: string, opts?: { bold?: boolean; size?: number; color?: string }) {
  return new TextRun({ text, font: FONT_NAME, size: opts?.size ?? 20, bold: opts?.bold, color: opts?.color, rightToLeft: true });
}

function dCellBorders() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  return { top: b, bottom: b, left: b, right: b };
}

function dCell(text: string, width: number, opts?: { header?: boolean; bold?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType]; fill?: string }) {
  return new TableCell({
    borders: dCellBorders(),
    width: { size: width, type: WidthType.DXA },
    shading: { fill: opts?.header ? "2B3A55" : (opts?.fill || "FFFFFF"), type: ShadingType.CLEAR },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      bidirectional: true,
      alignment: opts?.align || AlignmentType.CENTER,
      children: [dtxt(text, { bold: opts?.header || opts?.bold, color: opts?.header ? "FFFFFF" : undefined })],
    })],
  });
}

function dTitle(text: string) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [dtxt(text, { bold: true, size: 30 })],
  });
}

/** جدول: م + الاسم + أعمدة فارغة */
function dGridTable(names: string[], colHeaders: string[]) {
  const numW = 500;
  const nameW = 2200;
  const colW = Math.floor((CONTENT_W - numW - nameW) / colHeaders.length);
  const widths = [numW, nameW, ...colHeaders.map(() => colW)];
  const total = widths.reduce((a, b) => a + b, 0);

  const rows = [
    new TableRow({
      tableHeader: true,
      children: ["م", "اسم المعلمة", ...colHeaders].map((h, i) => dCell(h, widths[i], { header: true })),
    }),
    ...names.map((n, i) => new TableRow({
      children: [
        dCell(String(i + 1), widths[0]),
        dCell(n, widths[1], { bold: true, align: AlignmentType.RIGHT }),
        ...colHeaders.map((_, ci) => dCell("", widths[ci + 2])),
      ],
    })),
  ];
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows });
}

export async function exportFollowupRecordDocx(teachers: Teacher[], schoolName: string) {
  const names = [...new Set(teachers.map(t => t.name.trim()).filter(Boolean))];
  if (names.length === 0) throw new Error("لا يوجد معلمات في الجدول المدرسي");

  const days = dutyDistribution(teachers, 8);

  // جدول المناوبة (اليوم / الاسم / التخصص + فترات المناوبة)
  const dutyWidths = [1100, 2200, 1600, ...DUTY_SLOTS.flatMap(() => {
    const w = Math.floor((CONTENT_W - 1100 - 2200 - 1600) / (DUTY_SLOTS.length * 2));
    return [w, w];
  })];
  const dutyTotal = dutyWidths.reduce((a, b) => a + b, 0);
  const dutyRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        dCell("اليوم", dutyWidths[0], { header: true }),
        dCell("اسم المعلمة", dutyWidths[1], { header: true }),
        dCell("التخصص", dutyWidths[2], { header: true }),
        ...DUTY_SLOTS.flatMap((s, i) => [
          dCell(`${s} — ناوب ✓`, dutyWidths[3 + i * 2], { header: true }),
          dCell(`${s} — لم يناوب ✗`, dutyWidths[4 + i * 2], { header: true }),
        ]),
      ],
    }),
  ];
  DAYS.forEach((day, di) => {
    for (let i = 0; i < 8; i++) {
      const e = days[di][i];
      dutyRows.push(new TableRow({
        children: [
          dCell(i === 0 ? day : "", dutyWidths[0], { bold: i === 0, fill: "F2F2F2" }),
          dCell(e?.name || "", dutyWidths[1], { align: AlignmentType.RIGHT }),
          dCell(e?.subject || "", dutyWidths[2]),
          ...DUTY_SLOTS.flatMap((_, si) => [dCell("", dutyWidths[3 + si * 2]), dCell("", dutyWidths[4 + si * 2])]),
        ],
      }));
    }
  });

  const sectionProps = {
    page: {
      size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
      margin: { top: 720, right: 720, bottom: 720, left: 720 },
    },
  };

  const prepCols = Array.from({ length: 25 }, (_, i) => String(i + 1));

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT_NAME, size: 20 } } } },
    sections: [
      {
        properties: sectionProps,
        children: [
          dTitle(`${schoolName} — سجل المتابعة / متابعة التحضير اليومي (التاريخ فوق رقم الخانة)`),
          dGridTable(names, prepCols),
          new Paragraph({ children: [new PageBreak()] }),
          dTitle(`${schoolName} — سجل المتابعة / متابعة الخطط`),
          dGridTable(names, PLAN_NAMES),
          new Paragraph({ children: [new PageBreak()] }),
          dTitle(`${schoolName} — سجل المتابعة / جدول المناوبة`),
          new Table({ width: { size: dutyTotal, type: WidthType.DXA }, columnWidths: dutyWidths, rows: dutyRows }),
          new Paragraph({ children: [new PageBreak()] }),
          dTitle(`${schoolName} — سجل المتابعة / سجل الحضور والغياب`),
          dGridTable(names, MONTHS),
          new Paragraph({ children: [new PageBreak()] }),
          dTitle(`${schoolName} — سجل المتابعة / سجل الأداء والعلامات (الفصل الأول ثم الثاني)`),
          dGridTable(names, [...MARK_COLS.map(c => `أول: ${c}`), ...MARK_COLS.map(c => `ثاني: ${c}`)]),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `سجل المتابعة - ${schoolName}.docx`);
}
