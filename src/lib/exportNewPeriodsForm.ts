import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ClassTimetable, Teacher } from "@/types/timetable";
import { DAYS, parseClassKey } from "@/types/timetable";

const FONT = "Arial";
const thin = { style: "thin" as const };
const border = { top: thin, bottom: thin, left: thin, right: thin };

function mainSubject(t: Teacher): string {
  const totals = new Map<string, number>();
  t.subjects.forEach(s => totals.set(s.subjectName, (totals.get(s.subjectName) || 0) + s.periodsPerWeek));
  let best = "بدون مبحث"; let max = -1;
  totals.forEach((v, k) => { if (v > max) { max = v; best = k; } });
  return best;
}

/** نموذج الحصص الجديد: صف لكل معلم، أعمدة الأيام × الحصص، مجمّعة حسب المادة */
export async function exportNewPeriodsFormExcel(
  teachers: Teacher[],
  timetable: ClassTimetable,
  periodsPerDay: number,
  info: { schoolName: string; academicYear?: string },
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("نموذج الحصص الجديد", {
    views: [{ rightToLeft: true, state: "frozen", xSplit: 3, ySplit: 4 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
  });

  // grid[teacherId][day][period] = class label
  const grid = new Map<string, string[][]>();
  Object.entries(timetable).forEach(([key, days]) => {
    const { className, section } = parseClassKey(key);
    const label = `${className} ${section}`;
    days?.forEach((periods, d) => periods?.forEach((cell, p) => {
      if (!cell) return;
      if (!grid.has(cell.teacherId)) grid.set(cell.teacherId, DAYS.map(() => Array(periodsPerDay).fill("")));
      const g = grid.get(cell.teacherId)!;
      if (g[d] && p < periodsPerDay) g[d][p] = g[d][p] ? `${g[d][p]}/${label}` : label;
    }));
  });

  const dayCols = DAYS.length * periodsPerDay;
  const lastCol = 3 + dayCols + 1;
  const year = info.academicYear || (() => { const y = new Date().getFullYear(); return new Date().getMonth() >= 7 ? `${y} /${y + 1}` : `${y - 1} /${y}`; })();

  const title = (r: number, text: string, size: number) => {
    ws.mergeCells(r, 1, r, lastCol);
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = { name: FONT, bold: true, size };
    c.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r).height = size * 1.8;
  };
  title(1, info.schoolName || "المدرسة", 16);
  title(2, `برنامج الحصص الاسبوعية ${year}`, 14);

  const head = (c: ExcelJS.Cell, v: string | number) => {
    c.value = v;
    c.font = { name: FONT, bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
  };
  ws.mergeCells(3, 1, 4, 1); head(ws.getCell(3, 1), "المواد");
  ws.mergeCells(3, 2, 4, 2); head(ws.getCell(3, 2), "رقم المعلم");
  ws.mergeCells(3, 3, 4, 3); head(ws.getCell(3, 3), "إسم المعلم");
  DAYS.forEach((d, di) => {
    const s = 4 + di * periodsPerDay;
    ws.mergeCells(3, s, 3, s + periodsPerDay - 1); head(ws.getCell(3, s), d);
    for (let p = 0; p < periodsPerDay; p++) head(ws.getCell(4, s + p), p + 1);
  });
  ws.mergeCells(3, lastCol, 4, lastCol); head(ws.getCell(3, lastCol), "مجموع الحصص");
  ws.getRow(3).height = 22; ws.getRow(4).height = 18;

  // group teachers by main subject (keep first-appearance order)
  const groups = new Map<string, Teacher[]>();
  teachers.forEach(t => { const s = mainSubject(t); if (!groups.has(s)) groups.set(s, []); groups.get(s)!.push(t); });
  if (groups.has("بدون مبحث")) { const g = groups.get("بدون مبحث")!; groups.delete("بدون مبحث"); groups.set("بدون مبحث", g); }

  let r = 5; let n = 1;
  groups.forEach((list, subject) => {
    const start = r;
    list.forEach(t => {
      const g = grid.get(t.id) || DAYS.map(() => Array(periodsPerDay).fill(""));
      const row = ws.getRow(r);
      row.getCell(2).value = n++;
      row.getCell(3).value = t.name;
      DAYS.forEach((_, di) => g[di].forEach((v, p) => { row.getCell(4 + di * periodsPerDay + p).value = v || null; }));
      const periodCount = g.reduce((sum, day) => sum + day.filter(Boolean).length, 0);
      const a = ws.getCell(r, 4).address, b = ws.getCell(r, 3 + dayCols).address;
      row.getCell(lastCol).value = { formula: `COUNTA(${a}:${b})`, result: periodCount };
      for (let c = 1; c <= lastCol; c++) {
        const cell = row.getCell(c);
        cell.border = border;
        cell.font = { name: FONT, size: c === 3 ? 10 : 8, bold: c === 3 || c === lastCol };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, shrinkToFit: c > 3 };
      }
      row.height = 24;
      r++;
    });
    if (r - 1 > start) ws.mergeCells(start, 1, r - 1, 1);
    const sc = ws.getCell(start, 1);
    sc.value = subject;
    sc.font = { name: FONT, bold: true, size: 10 };
    sc.alignment = { horizontal: "center", vertical: "middle", wrapText: true, textRotation: 0 };
    sc.border = border;
  });

  ws.getColumn(1).width = 14; ws.getColumn(2).width = 7; ws.getColumn(3).width = 22;
  for (let c = 4; c < lastCol; c++) ws.getColumn(c).width = 6.5;
  ws.getColumn(lastCol).width = 9;
  ws.pageSetup.printTitlesRow = "3:4";

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `نموذج الحصص الجديد - ${info.schoolName || "المدرسة"}.xlsx`);
}
