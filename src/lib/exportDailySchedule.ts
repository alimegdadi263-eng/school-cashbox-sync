import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  Document, Packer, Table as DocxTable, TableRow as DocxTR, TableCell as DocxTC,
  Paragraph, TextRun, WidthType, AlignmentType, BorderStyle,
  ShadingType, VerticalAlign,
} from "docx";
import type { ClassTimetable } from "@/types/timetable";
import { DAYS, parseClassKey } from "@/types/timetable";

const FONT_NAME = "Traditional Arabic";
const HEADER_BG = "2B3A55";
const ACCENT_BG = "D4A84B";
const ABSENT_BG = "C0392B";
const PAGE_BORDER = {
  pageBorderTop: { style: BorderStyle.SINGLE, size: 6, color: "2B3A55", space: 24 },
  pageBorderBottom: { style: BorderStyle.SINGLE, size: 6, color: "2B3A55", space: 24 },
  pageBorderLeft: { style: BorderStyle.SINGLE, size: 6, color: "2B3A55", space: 24 },
  pageBorderRight: { style: BorderStyle.SINGLE, size: 6, color: "2B3A55", space: 24 },
};

interface DutyTeacher {
  name: string;
  location: string;
}

// =================== Shared helpers ===================

function excelBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
}

function setupWorksheet(ws: ExcelJS.Worksheet) {
  ws.views = [{ rightToLeft: true }];
  ws.pageSetup = {
    orientation: "landscape" as any,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 },
  };
}

function addExcelHeader(
  ws: ExcelJS.Worksheet,
  schoolName: string,
  dayName: string,
  totalCols: number,
  absentTeacherNames: string[],
  border: Partial<ExcelJS.Borders>
) {
  // Row 1: School name
  const schoolRow = ws.addRow([schoolName]);
  ws.mergeCells(1, 1, 1, totalCols);
  const schoolCell = schoolRow.getCell(1);
  schoolCell.font = { name: FONT_NAME, bold: true, size: 18, color: { argb: "FF2B3A55" } };
  schoolCell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" as any };
  schoolCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  schoolRow.height = 35;

  // Row 2: Day title
  const titleRow = ws.addRow([`الجدول اليومي - يوم ${dayName}`]);
  ws.mergeCells(2, 1, 2, totalCols);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: FONT_NAME, bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" as any };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
  titleRow.height = 30;

  // Row 3: Absent teachers
  if (absentTeacherNames.length > 0) {
    const absentRow = ws.addRow([`المعلمون الغائبون: ${absentTeacherNames.join(" ، ")}`]);
    ws.mergeCells(3, 1, 3, totalCols);
    const absentCell = absentRow.getCell(1);
    absentCell.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    absentCell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" as any };
    absentCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC0392B" } };
    absentRow.height = 25;
  }

  ws.addRow([]); // spacing
}

function addDutyTeachersExcel(
  ws: ExcelJS.Worksheet,
  dutyTeachers: DutyTeacher[],
  totalCols: number,
  border: Partial<ExcelJS.Borders>
) {
  if (dutyTeachers.length === 0 || !dutyTeachers.some(dt => dt.name)) return;

  ws.addRow([]); // spacing
  const dutyTitleRow = ws.addRow(["المناوبون"]);
  ws.mergeCells(dutyTitleRow.number, 1, dutyTitleRow.number, totalCols);
  const dtCell = dutyTitleRow.getCell(1);
  dtCell.font = { name: FONT_NAME, bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  dtCell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" as any };
  dtCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
  dutyTitleRow.height = 28;

  const dutyHeaderRow = ws.addRow(["م", "اسم المناوب", "المكان"]);
  ws.mergeCells(dutyHeaderRow.number, 2, dutyHeaderRow.number, Math.max(2, Math.ceil(totalCols / 2)));
  ws.mergeCells(dutyHeaderRow.number, Math.max(2, Math.ceil(totalCols / 2)) + 1, dutyHeaderRow.number, totalCols);
  dutyHeaderRow.height = 25;
  dutyHeaderRow.eachCell(c => {
    c.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "FF2B3A55" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
    c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" as any };
    c.border = border;
  });

  dutyTeachers.forEach((dt, i) => {
    if (!dt.name) return;
    const dutyRow = ws.addRow([`${i + 1}`, dt.name, dt.location || "—"]);
    ws.mergeCells(dutyRow.number, 2, dutyRow.number, Math.max(2, Math.ceil(totalCols / 2)));
    ws.mergeCells(dutyRow.number, Math.max(2, Math.ceil(totalCols / 2)) + 1, dutyRow.number, totalCols);
    dutyRow.height = 25;
    dutyRow.eachCell(c => {
      c.font = { name: FONT_NAME, size: 11 };
      c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" as any };
      c.border = border;
    });
  });
}

// =================== EXCEL (Normal) ===================

export async function exportDailyScheduleExcel(
  dailyTT: ClassTimetable,
  dayIndex: number,
  periodsPerDay: number,
  schoolName: string,
  absentTeacherNames: string[],
  dutyTeachers: DutyTeacher[]
) {
  const wb = new ExcelJS.Workbook();
  const dayName = DAYS[dayIndex];
  const ws = wb.addWorksheet(`جدول يوم ${dayName}`);
  setupWorksheet(ws);

  const border = excelBorder();
  const sortedKeys = Object.keys(dailyTT).sort();
  const totalCols = periodsPerDay + 1;

  addExcelHeader(ws, schoolName, dayName, totalCols, absentTeacherNames, border);

  // Headers
  const headerData = ["الصف / الشعبة"];
  for (let p = 0; p < periodsPerDay; p++) headerData.push(`الحصة ${p + 1}`);
  const headerRow = ws.addRow(headerData);
  headerRow.height = 30;
  headerRow.eachCell(c => {
    c.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" as any };
    c.border = border;
  });

  // Data rows
  for (const key of sortedKeys) {
    const { className, section } = parseClassKey(key);
    const periods = dailyTT[key][0] || [];
    const rowData = [`${className} / ${section}`];
    for (let p = 0; p < periodsPerDay; p++) {
      const cell = periods[p];
      rowData.push(cell ? `${cell.subjectName}\n${cell.teacherName}` : "");
    }
    const row = ws.addRow(rowData);
    row.height = 40;
    row.eachCell((c, colNum) => {
      c.border = border;
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" as any };
      if (colNum === 1) {
        c.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
      } else {
        c.font = { name: FONT_NAME, size: 11 };
        if (!rowData[colNum - 1]) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        }
      }
    });
  }

  addDutyTeachersExcel(ws, dutyTeachers, totalCols, border);

  // Column widths
  ws.getColumn(1).width = 16;
  for (let i = 2; i <= totalCols; i++) ws.getColumn(i).width = 20;

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `الجدول_اليومي_${dayName}.xlsx`);
}

// =================== EXCEL (Inverted) ===================

export async function exportDailyScheduleExcelInverted(
  dailyTT: ClassTimetable,
  dayIndex: number,
  periodsPerDay: number,
  schoolName: string,
  absentTeacherNames: string[],
  dutyTeachers: DutyTeacher[]
) {
  const wb = new ExcelJS.Workbook();
  const dayName = DAYS[dayIndex];
  const ws = wb.addWorksheet(`جدول يوم ${dayName} (معكوس)`);
  setupWorksheet(ws);

  const border = excelBorder();
  const sortedKeys = Object.keys(dailyTT).sort();
  const totalCols = sortedKeys.length + 1; // 1 for period label

  addExcelHeader(ws, schoolName, dayName, totalCols, absentTeacherNames, border);

  // Headers: الحصة | صف1 | صف2 | ...
  const headerData = ["الحصة"];
  for (const key of sortedKeys) {
    const { className, section } = parseClassKey(key);
    headerData.push(`${className} / ${section}`);
  }
  const headerRow = ws.addRow(headerData);
  headerRow.height = 30;
  headerRow.eachCell(c => {
    c.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" as any };
    c.border = border;
  });

  // Data rows: each row is a period
  for (let p = 0; p < periodsPerDay; p++) {
    const rowData = [`الحصة ${p + 1}`];
    for (const key of sortedKeys) {
      const periods = dailyTT[key][0] || [];
      const cell = periods[p];
      rowData.push(cell ? `${cell.subjectName}\n${cell.teacherName}` : "");
    }
    const row = ws.addRow(rowData);
    row.height = 40;
    row.eachCell((c, colNum) => {
      c.border = border;
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" as any };
      if (colNum === 1) {
        c.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
      } else {
        c.font = { name: FONT_NAME, size: 11 };
        if (!rowData[colNum - 1]) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        }
      }
    });
  }

  addDutyTeachersExcel(ws, dutyTeachers, totalCols, border);

  // Column widths
  ws.getColumn(1).width = 14;
  for (let i = 2; i <= totalCols; i++) ws.getColumn(i).width = 18;

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `الجدول_اليومي_معكوس_${dayName}.xlsx`);
}

// =================== WORD helpers ===================

function hdrCell(text: string, width?: number): DocxTC {
  return new DocxTC({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      children: [new TextRun({ text, font: FONT_NAME, bold: true, size: 22, color: "FFFFFF", rightToLeft: true })],
    })],
  });
}

function dCell(lines: string[], empty = false): DocxTC {
  return new DocxTC({
    shading: empty ? { type: ShadingType.SOLID, color: "F5F5F5" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: lines.length > 0 ? lines.map(l => new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: l, font: FONT_NAME, size: 20, rightToLeft: true })],
    })) : [new Paragraph({ alignment: AlignmentType.CENTER, children: [] })],
  });
}

function buildDocxHeader(schoolName: string, dayName: string, absentTeacherNames: string[]): Paragraph[] {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 100 },
      children: [new TextRun({ text: schoolName, font: FONT_NAME, bold: true, size: 32, color: HEADER_BG, rightToLeft: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 100 },
      children: [new TextRun({ text: `الجدول اليومي - يوم ${dayName}`, font: FONT_NAME, bold: true, size: 28, color: ACCENT_BG, rightToLeft: true })],
    }),
  ];

  if (absentTeacherNames.length > 0) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "المعلمون الغائبون: ", font: FONT_NAME, bold: true, size: 22, color: ABSENT_BG, rightToLeft: true }),
        new TextRun({ text: absentTeacherNames.join(" ، "), font: FONT_NAME, size: 22, color: ABSENT_BG, rightToLeft: true }),
      ],
    }));
  }

  return children;
}

function buildDutyTeachersDocx(dutyTeachers: DutyTeacher[]): any[] {
  if (dutyTeachers.length === 0 || !dutyTeachers.some(dt => dt.name)) return [];

  const children: any[] = [];
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text: "المناوبون", font: FONT_NAME, bold: true, size: 24, color: HEADER_BG, rightToLeft: true })],
  }));

  const dutyHeaderRow = new DocxTR({
    tableHeader: true,
    children: [
      hdrCell("م", 500),
      new DocxTC({
        shading: { type: ShadingType.SOLID, color: ACCENT_BG },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          children: [new TextRun({ text: "اسم المناوب", font: FONT_NAME, bold: true, size: 22, color: HEADER_BG, rightToLeft: true })],
        })],
      }),
      new DocxTC({
        shading: { type: ShadingType.SOLID, color: ACCENT_BG },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          children: [new TextRun({ text: "المكان", font: FONT_NAME, bold: true, size: 22, color: HEADER_BG, rightToLeft: true })],
        })],
      }),
    ],
  });

  const dutyRows = dutyTeachers
    .filter(dt => dt.name)
    .map((dt, i) => new DocxTR({
      children: [
        dCell([`${i + 1}`]),
        dCell([dt.name]),
        dCell([dt.location || "—"]),
      ],
    }));

  const dutyTable = new DocxTable({
    width: { size: 60, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [dutyHeaderRow, ...dutyRows],
  });

  children.push(dutyTable);
  return children;
}

// =================== WORD (Normal) ===================

export async function exportDailyScheduleDocx(
  dailyTT: ClassTimetable,
  dayIndex: number,
  periodsPerDay: number,
  schoolName: string,
  absentTeacherNames: string[],
  dutyTeachers: DutyTeacher[]
) {
  const dayName = DAYS[dayIndex];
  const sortedKeys = Object.keys(dailyTT).sort();

  const headerRow = new DocxTR({
    tableHeader: true,
    children: [
      hdrCell("الصف / الشعبة", 1200),
      ...Array.from({ length: periodsPerDay }, (_, i) => hdrCell(`الحصة ${i + 1}`)),
    ],
  });

  const dataRows = sortedKeys.map(key => {
    const { className, section } = parseClassKey(key);
    const periods = dailyTT[key][0] || [];
    return new DocxTR({
      children: [
        hdrCell(`${className} / ${section}`, 1200),
        ...Array.from({ length: periodsPerDay }, (_, pi) => {
          const cell = periods[pi];
          if (cell) return dCell([cell.subjectName, cell.teacherName]);
          return dCell([], true);
        }),
      ],
    });
  });

  const mainTable = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [headerRow, ...dataRows],
  });

  const children: any[] = [
    ...buildDocxHeader(schoolName, dayName, absentTeacherNames),
    mainTable,
    ...buildDutyTeachersDocx(dutyTeachers),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { orientation: "landscape" as any }, borders: PAGE_BORDER },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `الجدول_اليومي_${dayName}.docx`);
}

// =================== WORD (Inverted) ===================

export async function exportDailyScheduleDocxInverted(
  dailyTT: ClassTimetable,
  dayIndex: number,
  periodsPerDay: number,
  schoolName: string,
  absentTeacherNames: string[],
  dutyTeachers: DutyTeacher[]
) {
  const dayName = DAYS[dayIndex];
  const sortedKeys = Object.keys(dailyTT).sort();

  // Header row: الحصة | صف1 | صف2 | ...
  const headerRow = new DocxTR({
    tableHeader: true,
    children: [
      hdrCell("الحصة", 900),
      ...sortedKeys.map(key => {
        const { className, section } = parseClassKey(key);
        return hdrCell(`${className} / ${section}`);
      }),
    ],
  });

  // Data rows: each row is a period
  const dataRows = Array.from({ length: periodsPerDay }, (_, pi) => {
    return new DocxTR({
      children: [
        hdrCell(`الحصة ${pi + 1}`, 900),
        ...sortedKeys.map(key => {
          const periods = dailyTT[key][0] || [];
          const cell = periods[pi];
          if (cell) return dCell([cell.subjectName, cell.teacherName]);
          return dCell([], true);
        }),
      ],
    });
  });

  const mainTable = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [headerRow, ...dataRows],
  });

  const children: any[] = [
    ...buildDocxHeader(schoolName, dayName, absentTeacherNames),
    mainTable,
    ...buildDutyTeachersDocx(dutyTeachers),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { orientation: "landscape" as any }, borders: PAGE_BORDER },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `الجدول_اليومي_معكوس_${dayName}.docx`);
}
