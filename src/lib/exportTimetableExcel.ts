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

/** ملحفة - جدول شامل لجميع الصفوف في صفحة واحدة A3 */
export async function exportMalhafaExcel(
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الملحفة");
  ws.views = [{ rightToLeft: true }];

  // A3 paper setup
  ws.pageSetup = {
    paperSize: 8 as any, // A3
    orientation: "landscape" as any,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
  };

  const sortedKeys = Object.keys(timetable).sort();
  const totalCols = DAYS.length * periodsPerDay + 1;
  const classCount = sortedKeys.length;

  // Dynamic font sizes based on class count
  const titleSize = classCount > 15 ? 12 : 14;
  const headerSize = classCount > 15 ? 8 : 9;
  const cellSize = classCount > 15 ? 7 : 8;
  const rowHeight = classCount > 20 ? 28 : classCount > 15 ? 32 : 36;
  const colWidth = classCount > 15 ? 10 : 12;

  // Title row
  const titleRow = ws.addRow([`${schoolName} - الملحفة الدراسية`]);
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: FONT_NAME, bold: true, size: titleSize, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
  titleRow.height = 28;

  // Day header row
  const dayHeaderData: string[] = ["الصف / الشعبة"];
  for (const day of DAYS) {
    dayHeaderData.push(day);
    for (let i = 1; i < periodsPerDay; i++) dayHeaderData.push("");
  }
  const dayRow = ws.addRow(dayHeaderData);
  dayRow.height = 22;
  for (let di = 0; di < DAYS.length; di++) {
    const startCol = 2 + di * periodsPerDay;
    const endCol = startCol + periodsPerDay - 1;
    ws.mergeCells(2, startCol, 2, endCol);
  }
  dayRow.eachCell((c, colNum) => {
    c.font = { name: FONT_NAME, bold: true, size: headerSize, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  // Period number sub-header
  const periodHeaderData: string[] = [""];
  for (let di = 0; di < DAYS.length; di++) {
    for (let p = 0; p < periodsPerDay; p++) periodHeaderData.push(`${p + 1}`);
  }
  const periodRow = ws.addRow(periodHeaderData);
  periodRow.height = 18;
  periodRow.eachCell((c, colNum) => {
    if (colNum === 1) {
      styleHeader(c);
    } else {
      c.font = { name: FONT_NAME, bold: true, size: 7, color: { argb: "FF2B3A55" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    }
  });

  // Data rows
  for (const key of sortedKeys) {
    const { className, section } = parseClassKey(key);
    const rowData: string[] = [`${className}/${section}`];
    const days = timetable[key];
    for (let di = 0; di < DAYS.length; di++) {
      for (let p = 0; p < periodsPerDay; p++) {
        const cell = days[di]?.[p];
        rowData.push(cell ? `${cell.subjectName}\n${cell.teacherName}` : "");
      }
    }
    const row = ws.addRow(rowData);
    row.height = rowHeight;
    row.eachCell((c, colNum) => {
      if (colNum === 1) {
        c.font = { name: FONT_NAME, bold: true, size: cellSize, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      } else {
        c.font = { name: FONT_NAME, size: cellSize };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        if (!rowData[colNum - 1]) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        }
      }
    });
  }

  // Column widths - fit A3
  ws.getColumn(1).width = 12;
  for (let i = 2; i <= totalCols; i++) {
    ws.getColumn(i).width = colWidth;
  }

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `ملحفة_${schoolName}.xlsx`);
}

/** ملحفة معكوسة - الأيام/الحصص أفقياً والصفوف عمودياً بشكل مختلف: الصفوف كأعمدة واليوم/الحصة كصفوف */
export async function exportMalhafaTransposedExcel(
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الملحفة المعكوسة");
  ws.views = [{ rightToLeft: true }];

  const sortedKeys = Object.keys(timetable).sort();
  const totalCols = sortedKeys.length + 2; // day col + period col + classes

  // Title row
  const titleRow = ws.addRow([`${schoolName} - الملحفة الدراسية (عرض بديل)`]);
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: FONT_NAME, bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
  titleRow.height = 35;

  // Header row: اليوم | الحصة | class1 | class2 | ...
  const headerData: string[] = ["اليوم", "الحصة"];
  for (const key of sortedKeys) {
    const { className, section } = parseClassKey(key);
    headerData.push(`${className}/${section}`);
  }
  const headerRow = ws.addRow(headerData);
  headerRow.height = 30;
  headerRow.eachCell(c => styleHeader(c));

  // Data rows: one row per day/period combination
  for (let di = 0; di < DAYS.length; di++) {
    for (let p = 0; p < periodsPerDay; p++) {
      const rowData: string[] = [p === 0 ? DAYS[di] : "", `${p + 1}`];
      for (const key of sortedKeys) {
        const cell = timetable[key][di]?.[p];
        rowData.push(cell ? `${cell.subjectName}\n${cell.teacherName}` : "");
      }
      const row = ws.addRow(rowData);
      row.height = 35;
      row.eachCell((c, colNum) => {
        if (colNum <= 2) {
          styleHeader(c);
        } else {
          styleCell(c, !rowData[colNum - 1]);
        }
      });
    }
    // Merge day cells
    const startRow = 3 + di * periodsPerDay;
    const endRow = startRow + periodsPerDay - 1;
    if (periodsPerDay > 1) {
      ws.mergeCells(startRow, 1, endRow, 1);
    }
  }

  // Column widths
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 8;
  for (let i = 3; i <= totalCols; i++) {
    ws.getColumn(i).width = 18;
  }

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `ملحفة_معكوسة_${schoolName}.xlsx`);
}

/** كشف أنصبة المعلمين - Teacher Workload Report */
export async function exportTeacherWorkloadExcel(
  teachers: Teacher[],
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("كشف الأنصبة");
  ws.views = [{ rightToLeft: true }];

  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };

  // Title
  const titleRow = ws.addRow([`${schoolName} - كشف أنصبة المعلمين`]);
  ws.mergeCells(1, 1, 1, 6);
  titleRow.getCell(1).font = { name: FONT_NAME, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  titleRow.height = 35;

  ws.addRow([]);

  // Headers
  const headerRow = ws.addRow(["م", "اسم المعلم/ة", "المادة", "الصف/الشعبة", "الحصص الأسبوعية", "إجمالي الأنصبة"]);
  headerRow.height = 30;
  headerRow.eachCell(c => styleHeader(c));

  let rowNum = 0;
  for (const teacher of teachers) {
    const totalPeriods = teacher.subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);
    
    // Count actual scheduled periods from timetable
    let actualPeriods = 0;
    for (const [, days] of Object.entries(timetable)) {
      for (const periods of days) {
        for (const cell of periods) {
          if (cell && cell.teacherId === teacher.id) actualPeriods++;
        }
      }
    }

    if (teacher.subjects.length === 0) {
      rowNum++;
      const row = ws.addRow([rowNum, teacher.name, "—", "—", 0, 0]);
      row.eachCell(c => { c.font = { name: FONT_NAME, size: 11 }; c.border = border; c.alignment = { horizontal: "center", vertical: "middle" }; });
      continue;
    }

    for (let si = 0; si < teacher.subjects.length; si++) {
      const s = teacher.subjects[si];
      const isFirst = si === 0;
      if (isFirst) rowNum++;
      const row = ws.addRow([
        isFirst ? rowNum : "",
        isFirst ? teacher.name : "",
        s.subjectName,
        `${s.className}/${s.section}`,
        s.periodsPerWeek,
        isFirst ? actualPeriods : "",
      ]);
      row.eachCell((c, colNum) => {
        c.font = { name: FONT_NAME, size: 11, bold: (colNum === 6 && isFirst) };
        c.border = border;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
    }

    // Merge teacher name and number cells if multiple subjects
    if (teacher.subjects.length > 1) {
      const startR = ws.rowCount - teacher.subjects.length + 1;
      const endR = ws.rowCount;
      ws.mergeCells(startR, 1, endR, 1);
      ws.mergeCells(startR, 2, endR, 2);
      ws.mergeCells(startR, 6, endR, 6);
    }
  }

  // Summary row
  ws.addRow([]);
  const totalTeachers = teachers.length;
  let grandTotal = 0;
  for (const [, days] of Object.entries(timetable)) {
    for (const periods of days) {
      for (const cell of periods) {
        if (cell) grandTotal++;
      }
    }
  }
  // Count unique - each period counted once per teacher
  const summaryRow = ws.addRow(["", `إجمالي المعلمين: ${totalTeachers}`, "", "", "", `إجمالي الحصص: ${grandTotal}`]);
  summaryRow.eachCell(c => {
    c.font = { name: FONT_NAME, bold: true, size: 12 };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Column widths
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 25;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 18;
  ws.getColumn(6).width = 18;

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `كشف_أنصبة_المعلمين_${schoolName}.xlsx`);
}
