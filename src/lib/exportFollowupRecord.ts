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

/** صفحة المناوبة الأسبوعية: أيام الأسبوع × عدد من المعلمات المناوبات */
function addDutySheet(wb: ExcelJS.Workbook, title: string, names: string[], weeks = 8, perDay = 4) {
  const ws = wb.addWorksheet("المناوبة");
  ws.views = [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 4 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const span = DAYS.length + 2;
  addTitle(ws, title, span);

  const header = ws.addRow(["الأسبوع", "المناوبة", ...DAYS]);
  header.eachCell(c => styleHeader(c));
  header.height = 30;

  for (let w = 1; w <= weeks; w++) {
    const startRow = ws.rowCount + 1;
    for (let d = 1; d <= perDay; d++) {
      const row = ws.addRow([w === 1 && d === 1 ? "" : "", `معلمة ${d}`, ...DAYS.map(() => "")]);
      row.eachCell({ includeEmpty: true }, c => styleBody(c));
      row.height = 22;
    }
    const endRow = ws.rowCount;
    ws.mergeCells(startRow, 1, endRow, 1);
    const wc = ws.getCell(startRow, 1);
    wc.value = `الأسبوع ${w}`;
    styleBody(wc, true);
    wc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  }

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 12;
  for (let c = 3; c <= span; c++) ws.getColumn(c).width = 20;

  // قائمة أسماء المعلمات كمرجع
  ws.addRow([]);
  const ref = ws.addRow(["أسماء المعلمات: " + names.join(" - ")]);
  ws.mergeCells(ref.number, 1, ref.number, span);
  ref.getCell(1).font = { name: FONT_NAME, size: 10, italic: true };
  ref.getCell(1).alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  return ws;
}

export async function exportFollowupRecordExcel(teachers: Teacher[], schoolName: string) {
  const names = [...new Set(teachers.map(t => t.name.trim()).filter(Boolean))];
  if (names.length === 0) throw new Error("لا يوجد معلمات في الجدول المدرسي");

  const wb = new ExcelJS.Workbook();
  wb.creator = schoolName;

  // 1) التحضير اليومي — 25 خانة
  addGridSheet(
    wb, "التحضير", `${schoolName} — سجل المتابعة / متابعة التحضير اليومي`,
    names, Array.from({ length: 25 }, (_, i) => String(i + 1)),
  );

  // 2) الخطط — 5 خانات
  addGridSheet(
    wb, "الخطط", `${schoolName} — سجل المتابعة / متابعة الخطط`,
    names, Array.from({ length: 5 }, (_, i) => `الخطة ${i + 1}`),
  );

  // 3) المناوبة الأسبوعية
  addDutySheet(wb, `${schoolName} — سجل المتابعة / جدول المناوبة الأسبوعي`, names);

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
