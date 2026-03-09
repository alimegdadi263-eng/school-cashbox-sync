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
