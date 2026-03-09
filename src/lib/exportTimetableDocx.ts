import {
  Document, Packer, Table as DocxTable, TableRow as DocxTR, TableCell as DocxTC,
  Paragraph, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle,
  ShadingType, VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";
import type { ClassTimetable, TimetableCell, Teacher } from "@/types/timetable";
import { DAYS, parseClassKey } from "@/types/timetable";

const FONT = "Traditional Arabic";
const HEADER_BG = "2B3A55";
const ACCENT_BG = "D4A84B";

function headerCell(text: string, width?: number): DocxTC {
  return new DocxTC({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, font: FONT, bold: true, size: 22, color: "FFFFFF" })],
    })],
  });
}

function dataCell(lines: string[], empty = false): DocxTC {
  return new DocxTC({
    shading: empty ? { type: ShadingType.SOLID, color: "F5F5F5" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: lines.length > 0 ? lines.map(l => new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: l, font: FONT, size: 20 })],
    })) : [new Paragraph({ alignment: AlignmentType.CENTER, children: [] })],
  });
}

function buildClassTable(
  days: (TimetableCell | null)[][],
  periodsPerDay: number
): DocxTable {
  const headerRow = new DocxTR({
    tableHeader: true,
    children: [headerCell("الحصة", 800), ...DAYS.map(d => headerCell(d))],
  });

  const dataRows = Array.from({ length: periodsPerDay }, (_, pi) => {
    return new DocxTR({
      children: [
        headerCell(`${pi + 1}`, 800),
        ...DAYS.map((_, di) => {
          const cell = days[di]?.[pi];
          if (cell) return dataCell([cell.subjectName, cell.teacherName]);
          return dataCell([], true);
        }),
      ],
    });
  });

  return new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

export async function exportClassTimetableDocx(
  classKey: string,
  days: (TimetableCell | null)[][],
  periodsPerDay: number,
  schoolName: string
) {
  const { className, section } = parseClassKey(classKey);
  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: "landscape" as any } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: schoolName, font: FONT, bold: true, size: 32, color: HEADER_BG })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({
            text: `الجدول الأسبوعي - الصف ${className} / شعبة ${section}`,
            font: FONT, bold: true, size: 28, color: ACCENT_BG,
          })],
        }),
        buildClassTable(days, periodsPerDay),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `جدول_${className}_${section}.docx`);
}

export async function exportTeacherTimetableDocx(
  teacher: Teacher,
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const grid: (string[] | null)[][] = Array.from({ length: DAYS.length }, () => Array(periodsPerDay).fill(null));
  for (const [key, days] of Object.entries(timetable)) {
    days.forEach((periods, di) => {
      periods.forEach((cell, pi) => {
        if (cell && cell.teacherId === teacher.id) {
          const { className, section } = parseClassKey(key);
          grid[di][pi] = [cell.subjectName, `${className}/${section}`];
        }
      });
    });
  }

  const headerRow = new DocxTR({
    tableHeader: true,
    children: [headerCell("الحصة", 800), ...DAYS.map(d => headerCell(d))],
  });

  const dataRows = Array.from({ length: periodsPerDay }, (_, pi) => {
    return new DocxTR({
      children: [
        headerCell(`${pi + 1}`, 800),
        ...DAYS.map((_, di) => {
          const item = grid[di][pi];
          if (item) return dataCell(item);
          return dataCell([], true);
        }),
      ],
    });
  });

  const table = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: "landscape" as any } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: schoolName, font: FONT, bold: true, size: 32, color: HEADER_BG })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({
            text: `الجدول الأسبوعي للمعلم/ة: ${teacher.name}`,
            font: FONT, bold: true, size: 28, color: ACCENT_BG,
          })],
        }),
        table,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `جدول_${teacher.name}.docx`);
}

export async function exportFullSchoolTimetableDocx(
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const sortedKeys = Object.keys(timetable).sort();
  const sections = sortedKeys.map(key => {
    const { className, section } = parseClassKey(key);
    return {
      properties: { page: { size: { orientation: "landscape" as any } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: schoolName, font: FONT, bold: true, size: 32, color: HEADER_BG })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({
            text: `الصف ${className} / شعبة ${section}`,
            font: FONT, bold: true, size: 28, color: ACCENT_BG,
          })],
        }),
        buildClassTable(timetable[key], periodsPerDay),
      ],
    };
  });

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `الجدول_المدرسي_الكامل.docx`);
}

/** ملحفة - جدول شامل لجميع الصفوف في صفحة واحدة */
export async function exportMalhafaDocx(
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const sortedKeys = Object.keys(timetable).sort();

  // Build day header row with merged cells
  const dayHeaderCells: DocxTC[] = [headerCell("الصف", 1200)];
  for (const day of DAYS) {
    dayHeaderCells.push(new DocxTC({
      columnSpan: periodsPerDay,
      shading: { type: ShadingType.SOLID, color: HEADER_BG },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: day, font: FONT, bold: true, size: 20, color: "FFFFFF" })],
      })],
    }));
  }
  const dayHeaderRow = new DocxTR({ tableHeader: true, children: dayHeaderCells });

  // Period number sub-header
  const periodHeaderCells: DocxTC[] = [headerCell("", 1200)];
  for (let di = 0; di < DAYS.length; di++) {
    for (let p = 0; p < periodsPerDay; p++) {
      periodHeaderCells.push(new DocxTC({
        shading: { type: ShadingType.SOLID, color: ACCENT_BG },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `${p + 1}`, font: FONT, bold: true, size: 18, color: HEADER_BG })],
        })],
      }));
    }
  }
  const periodHeaderRow = new DocxTR({ tableHeader: true, children: periodHeaderCells });

  // Data rows
  const dataRows = sortedKeys.map(key => {
    const { className, section } = parseClassKey(key);
    const days = timetable[key];
    const cells: DocxTC[] = [headerCell(`${className}/${section}`, 1200)];
    for (let di = 0; di < DAYS.length; di++) {
      for (let p = 0; p < periodsPerDay; p++) {
        const cell = days[di]?.[p];
        if (cell) {
          cells.push(dataCell([cell.subjectName, cell.teacherName]));
        } else {
          cells.push(dataCell([], true));
        }
      }
    }
    return new DocxTR({ children: cells });
  });

  const table = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [dayHeaderRow, periodHeaderRow, ...dataRows],
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: "landscape" as any } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
          children: [new TextRun({ text: `${schoolName} - الملحفة الدراسية`, font: FONT, bold: true, size: 28, color: HEADER_BG })],
        }),
        table,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `ملحفة_${schoolName}.docx`);
}

/** ملحفة معكوسة - الصفوف كأعمدة واليوم/الحصة كصفوف */
export async function exportMalhafaTransposedDocx(
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const sortedKeys = Object.keys(timetable).sort();

  // Header row: اليوم | الحصة | classes...
  const headerCells: DocxTC[] = [
    headerCell("اليوم", 1000),
    headerCell("الحصة", 600),
    ...sortedKeys.map(key => {
      const { className, section } = parseClassKey(key);
      return headerCell(`${className}/${section}`);
    }),
  ];
  const headerRow = new DocxTR({ tableHeader: true, children: headerCells });

  // Data rows
  const dataRows: DocxTR[] = [];
  for (let di = 0; di < DAYS.length; di++) {
    for (let p = 0; p < periodsPerDay; p++) {
      const cells: DocxTC[] = [];
      // Day cell (only show on first period, use rowSpan)
      if (p === 0) {
        cells.push(new DocxTC({
          rowSpan: periodsPerDay,
          width: { size: 1000, type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: HEADER_BG },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: DAYS[di], font: FONT, bold: true, size: 20, color: "FFFFFF" })],
          })],
        }));
      } else {
        cells.push(new DocxTC({
          rowSpan: undefined,
          width: { size: 1000, type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, color: HEADER_BG },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [] })],
        }));
      }
      // Period number
      cells.push(headerCell(`${p + 1}`, 600));
      // Class data
      for (const key of sortedKeys) {
        const cell = timetable[key][di]?.[p];
        if (cell) {
          cells.push(dataCell([cell.subjectName, cell.teacherName]));
        } else {
          cells.push(dataCell([], true));
        }
      }
      dataRows.push(new DocxTR({ children: cells }));
    }
  }

  const table = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: "landscape" as any } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
          children: [new TextRun({ text: `${schoolName} - الملحفة الدراسية (عرض بديل)`, font: FONT, bold: true, size: 28, color: HEADER_BG })],
        }),
        table,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `ملحفة_معكوسة_${schoolName}.docx`);
}
