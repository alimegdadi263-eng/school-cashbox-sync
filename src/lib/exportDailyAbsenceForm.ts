import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, AlignmentType, VerticalAlign, PageBreak,
} from "docx";
import type { StudentInfo } from "@/types/studentAbsence";
import { CLASS_NAMES, SECTIONS } from "@/types/timetable";

/** عدد الأسطر الفارغة عندما لا يوجد طلبة مسجلون */
const BLANK_ROWS = 40;

/**
 * نموذج الغياب اليومي للطلبة:
 * صفحة مستقلة لكل صف/شعبة، مروّسة باسم المدرسة والصف،
 * وتحتوي 5 أعمدة للأيام من الأحد إلى الخميس.
 */

const FONT = "Traditional Arabic";
const NAVY = "FF2B3A55";
const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

function groupByClass(students: StudentInfo[]) {
  const map = new Map<string, StudentInfo[]>();
  students.forEach(s => {
    const key = (s.className || "بدون شعبة").trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  });
  return [...map.entries()].map(([cls, list]) => ({
    cls,
    list: list.slice().sort((a, b) => a.name.localeCompare(b.name, "ar")),
  }));
}

/** نماذج فارغة لجميع الصفوف والشعب عندما لا يوجد طلبة مسجلون */
function blankData(filterClass?: string) {
  const classes = filterClass
    ? [filterClass]
    : CLASS_NAMES.flatMap(c => SECTIONS.map(s => `${c} ${s}`));
  return classes.map(cls => ({
    cls,
    list: Array.from({ length: BLANK_ROWS }, () => ({ name: "" }) as StudentInfo),
  }));
}

/* ------------------------------- Excel ------------------------------- */

function xBorder(): Partial<ExcelJS.Borders> {
  const t = { style: "thin" as const };
  return { top: t, bottom: t, left: t, right: t };
}

export async function exportDailyAbsenceFormExcel(
  students: StudentInfo[],
  schoolName: string,
  filterClass?: string,
) {
  const data = groupByClass(filterClass ? students.filter(s => s.className === filterClass) : students);
  if (data.length === 0) throw new Error("لا يوجد طلبة للتصدير");

  const wb = new ExcelJS.Workbook();
  wb.creator = schoolName;

  data.forEach(({ cls, list }) => {
    const ws = wb.addWorksheet(cls.substring(0, 28));
    ws.views = [{ rightToLeft: true, state: "frozen", ySplit: 4 }];
    ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    const totalCols = 2 + WEEK_DAYS.length;

    const titleRow = ws.addRow([`${schoolName} — نموذج الغياب اليومي للطلبة`]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
    titleRow.getCell(1).font = { name: FONT, bold: true, size: 15, color: { argb: NAVY } };
    titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 24;

    const clsRow = ws.addRow([`الصف والشعبة: ${cls}`]);
    ws.mergeCells(clsRow.number, 1, clsRow.number, totalCols);
    clsRow.getCell(1).font = { name: FONT, bold: true, size: 13 };
    clsRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    clsRow.height = 22;

    const dateRow = ws.addRow(["", "الأسبوع من: ____ / ____ / ______   إلى: ____ / ____ / ______"]);
    ws.mergeCells(dateRow.number, 1, dateRow.number, totalCols);
    dateRow.getCell(1).value = "الأسبوع من: ____ / ____ / ______   إلى: ____ / ____ / ______";
    dateRow.getCell(1).font = { name: FONT, size: 11 };
    dateRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    const header = ws.addRow(["م", "اسم الطالب", ...WEEK_DAYS]);
    header.eachCell(c => {
      c.font = { name: FONT, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = xBorder();
    });
    header.height = 26;

    list.forEach((s, i) => {
      const row = ws.addRow([i + 1, s.name, ...WEEK_DAYS.map(() => "")]);
      row.eachCell({ includeEmpty: true }, (c, idx) => {
        c.font = { name: FONT, size: 12 };
        c.alignment = { horizontal: idx === 2 ? "right" : "center", vertical: "middle", indent: idx === 2 ? 1 : 0 };
        c.border = xBorder();
      });
      row.height = 21;
    });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 30;
    for (let c = 3; c <= totalCols; c++) ws.getColumn(c).width = 12;
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `نموذج الغياب اليومي${filterClass ? ` - ${filterClass}` : ""}.xlsx`,
  );
}

/* -------------------------------- Word -------------------------------- */

function dtxt(text: string, opts?: { bold?: boolean; size?: number; color?: string }) {
  return new TextRun({ text, font: FONT, size: opts?.size ?? 22, bold: opts?.bold, color: opts?.color, rightToLeft: true });
}

function borders() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  return { top: b, bottom: b, left: b, right: b };
}

function cell(text: string, width: number, opts?: { header?: boolean; bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }) {
  return new TableCell({
    borders: borders(),
    width: { size: width, type: WidthType.DXA },
    shading: { fill: opts?.header ? "2B3A55" : "FFFFFF", type: ShadingType.CLEAR },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      bidirectional: true,
      alignment: opts?.align || AlignmentType.CENTER,
      children: [dtxt(text, { bold: opts?.header || opts?.bold, color: opts?.header ? "FFFFFF" : undefined })],
    })],
  });
}

export async function exportDailyAbsenceFormDocx(
  students: StudentInfo[],
  schoolName: string,
  filterClass?: string,
) {
  const data = groupByClass(filterClass ? students.filter(s => s.className === filterClass) : students);
  if (data.length === 0) throw new Error("لا يوجد طلبة للتصدير");

  const numW = 600;
  const nameW = 3160;
  const dayW = Math.floor((9360 - numW - nameW) / WEEK_DAYS.length);
  const widths = [numW, nameW, ...WEEK_DAYS.map(() => dayW)];
  const total = widths.reduce((a, b) => a + b, 0);

  const children: (Paragraph | Table)[] = [];
  data.forEach(({ cls, list }, idx) => {
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 80 },
      children: [dtxt(`${schoolName} — نموذج الغياب اليومي للطلبة`, { bold: true, size: 30 })],
    }));
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 60 },
      children: [dtxt(`الصف والشعبة: ${cls}`, { bold: true, size: 26 })],
    }));
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [dtxt("الأسبوع من: ____ / ____ / ______     إلى: ____ / ____ / ______", { size: 20 })],
    }));

    const rows = [
      new TableRow({
        tableHeader: true,
        children: ["م", "اسم الطالب", ...WEEK_DAYS].map((h, i) => cell(h, widths[i], { header: true })),
      }),
      ...list.map((s, i) => new TableRow({
        children: [
          cell(String(i + 1), widths[0]),
          cell(s.name, widths[1], { align: AlignmentType.RIGHT }),
          ...WEEK_DAYS.map((_, di) => cell("", widths[di + 2])),
        ],
      })),
    ];
    children.push(new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows }));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `نموذج الغياب اليومي${filterClass ? ` - ${filterClass}` : ""}.docx`);
}
