import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ClassTimetable, TimetableCell, Teacher } from "@/types/timetable";
import { DAYS, parseClassKey } from "@/types/timetable";

const FONT_NAME = "Traditional Arabic";

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
}

function styleCell(cell: ExcelJS.Cell, isEmpty = false) {
  cell.font = { name: FONT_NAME, size: 10 };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
  if (isEmpty) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
  }
}

function addClassSheet(
  wb: ExcelJS.Workbook,
  classKey: string,
  days: (TimetableCell | null)[][],
  periodsPerDay: number,
  schoolName: string
) {
  const { className, section } = parseClassKey(classKey);
  const sheetName = `${className}-${section}`;
  const ws = wb.addWorksheet(sheetName);
  ws.views = [{ rightToLeft: true }];

  // Title
  const titleRow = ws.addRow([`${schoolName} - الجدول الأسبوعي للصف ${className} / شعبة ${section}`]);
  ws.mergeCells(1, 1, 1, DAYS.length + 1);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: FONT_NAME, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };

  ws.addRow([]);

  // Headers
  const headerRow = ws.addRow(["الحصة", ...DAYS]);
  headerRow.eachCell(c => styleHeader(c));
  headerRow.height = 30;

  // Data
  for (let p = 0; p < periodsPerDay; p++) {
    const rowData = [`${p + 1}`];
    DAYS.forEach((_, di) => {
      const cell = days[di]?.[p];
      rowData.push(cell ? `${cell.subjectName}\n${cell.teacherName}` : "");
    });
    const row = ws.addRow(rowData);
    row.height = 35;
    row.eachCell((c, colNum) => {
      if (colNum === 1) {
        styleHeader(c);
      } else {
        styleCell(c, !rowData[colNum - 1]);
      }
    });
  }

  // Column widths
  ws.getColumn(1).width = 10;
  for (let i = 2; i <= DAYS.length + 1; i++) {
    ws.getColumn(i).width = 22;
  }
}

export async function exportClassTimetableExcel(
  classKey: string,
  days: (TimetableCell | null)[][],
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  addClassSheet(wb, classKey, days, periodsPerDay, schoolName);
  const buffer = await wb.xlsx.writeBuffer();
  const { className, section } = parseClassKey(classKey);
  saveAs(new Blob([buffer]), `جدول_${className}_${section}.xlsx`);
}

export async function exportTeacherTimetableExcel(
  teacher: Teacher,
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(teacher.name);
  ws.views = [{ rightToLeft: true }];

  const titleRow = ws.addRow([`${schoolName} - الجدول الأسبوعي للمعلم/ة: ${teacher.name}`]);
  ws.mergeCells(1, 1, 1, DAYS.length + 1);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: FONT_NAME, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };

  ws.addRow([]);

  const headerRow = ws.addRow(["الحصة", ...DAYS]);
  headerRow.eachCell(c => styleHeader(c));
  headerRow.height = 30;

  // Build grid
  const grid: (string | null)[][] = Array.from({ length: DAYS.length }, () => Array(periodsPerDay).fill(null));
  for (const [key, days] of Object.entries(timetable)) {
    days.forEach((periods, di) => {
      periods.forEach((cell, pi) => {
        if (cell && cell.teacherId === teacher.id) {
          const { className, section } = parseClassKey(key);
          grid[di][pi] = `${cell.subjectName}\n${className}/${section}`;
        }
      });
    });
  }

  for (let p = 0; p < periodsPerDay; p++) {
    const rowData = [`${p + 1}`];
    DAYS.forEach((_, di) => {
      rowData.push(grid[di][p] || "");
    });
    const row = ws.addRow(rowData);
    row.height = 35;
    row.eachCell((c, colNum) => {
      if (colNum === 1) styleHeader(c);
      else styleCell(c, !rowData[colNum - 1]);
    });
  }

  ws.getColumn(1).width = 10;
  for (let i = 2; i <= DAYS.length + 1; i++) ws.getColumn(i).width = 22;

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `جدول_${teacher.name}.xlsx`);
}

export async function exportFullSchoolTimetableExcel(
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const sortedKeys = Object.keys(timetable).sort();
  for (const key of sortedKeys) {
    addClassSheet(wb, key, timetable[key], periodsPerDay, schoolName);
  }
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `الجدول_المدرسي_الكامل.xlsx`);
}

/** ملحفة - جدول شامل لجميع الصفوف في صفحة واحدة */
export async function exportMalhafaExcel(
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الملحفة");
  ws.views = [{ rightToLeft: true }];

  const sortedKeys = Object.keys(timetable).sort();
  const totalCols = DAYS.length * periodsPerDay + 1;

  // Title row
  const titleRow = ws.addRow([`${schoolName} - الملحفة الدراسية`]);
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: FONT_NAME, bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
  titleRow.height = 35;

  // Day header row (merged across periods)
  const dayHeaderData: string[] = ["الصف / الشعبة"];
  for (const day of DAYS) {
    dayHeaderData.push(day);
    for (let i = 1; i < periodsPerDay; i++) dayHeaderData.push("");
  }
  const dayRow = ws.addRow(dayHeaderData);
  dayRow.height = 28;
  // Merge day cells
  for (let di = 0; di < DAYS.length; di++) {
    const startCol = 2 + di * periodsPerDay;
    const endCol = startCol + periodsPerDay - 1;
    ws.mergeCells(2, startCol, 2, endCol);
  }
  dayRow.eachCell((c, colNum) => {
    if (colNum === 1) {
      styleHeader(c);
    } else {
      c.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    }
  });

  // Period number sub-header
  const periodHeaderData: string[] = [""];
  for (let di = 0; di < DAYS.length; di++) {
    for (let p = 0; p < periodsPerDay; p++) {
      periodHeaderData.push(`${p + 1}`);
    }
  }
  const periodRow = ws.addRow(periodHeaderData);
  periodRow.height = 22;
  periodRow.eachCell((c, colNum) => {
    if (colNum === 1) {
      styleHeader(c);
    } else {
      c.font = { name: FONT_NAME, bold: true, size: 9, color: { argb: "FF2B3A55" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    }
  });

  // Data rows - one per class
  for (const key of sortedKeys) {
    const { className, section } = parseClassKey(key);
    const rowData: string[] = [`${className} / ${section}`];
    const days = timetable[key];
    for (let di = 0; di < DAYS.length; di++) {
      for (let p = 0; p < periodsPerDay; p++) {
        const cell = days[di]?.[p];
        rowData.push(cell ? `${cell.subjectName}\n${cell.teacherName}` : "");
      }
    }
    const row = ws.addRow(rowData);
    row.height = 38;
    row.eachCell((c, colNum) => {
      if (colNum === 1) {
        c.font = { name: FONT_NAME, bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      } else {
        styleCell(c, !rowData[colNum - 1]);
      }
    });
  }

  // Column widths
  ws.getColumn(1).width = 16;
  for (let i = 2; i <= totalCols; i++) {
    ws.getColumn(i).width = 14;
  }

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `ملحفة_${schoolName}.xlsx`);
}
