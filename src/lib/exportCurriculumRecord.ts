import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, VerticalAlign, ShadingType, BorderStyle, PageBreak,
} from "docx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Teacher } from "@/types/timetable";

/**
 * سجل متابعة ما قطع من المنهاج (نموذج QF71-1-54rev.a)
 * صفحة/ورقة مستقلة لكل معلمة من معلمي الجدول المدرسي.
 * أعمدة (من اليمين لليسار): التاريخ | المبحث | الصف | الصفحات المقررة |
 * الصفحات المقطوعة | الصفحات المتبقية | ملاحظات
 * اسم المديرة يؤخذ من إعدادات النظام (directorName).
 */

const FONT = "Traditional Arabic";
const NAVY = "FF2B3A55";
const GOLD = "FFD4A84B";
// عدد الصفوف لكل معلم/ة — مضبوط ليتسع السجل كاملاً في صفحة واحدة
const ROWS_PER_TEACHER = 14;

const HEADERS = [
  "التاريخ", "المبحث", "الصف", "الصفحات المقررة",
  "الصفحات المقطوعة", "الصفحات المتبقية", "ملاحظات",
];
const WIDTHS = [14, 20, 12, 14, 14, 14, 24];

export interface CurriculumRecordInfo {
  schoolName: string;
  directorName: string;
  academicYear?: string;
}

function defaultYear(): string {
  const now = new Date();
  const y = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

function safeSheetName(name: string, index: number) {
  const clean = name.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 26);
  return clean ? `${index + 1}-${clean}`.slice(0, 31) : `معلم ${index + 1}`;
}

/* ------------------------------ Excel ------------------------------ */

function thin(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
}

export async function exportCurriculumRecordExcel(
  teachers: Teacher[],
  info: CurriculumRecordInfo,
) {
  const wb = new ExcelJS.Workbook();
  const year = info.academicYear || defaultYear();

  teachers.forEach((t, idx) => {
    const ws = wb.addWorksheet(safeSheetName(t.name, idx), {
      views: [{ rightToLeft: true }],
      pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = WIDTHS.map(w => ({ width: w }));

    const title = ws.addRow(["سجل متابعة ما قطع من المنهاج"]);
    ws.mergeCells(title.number, 1, title.number, HEADERS.length);
    const tc = title.getCell(1);
    tc.font = { name: FONT, bold: true, size: 16, color: { argb: NAVY } };
    tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    tc.alignment = { horizontal: "center", vertical: "middle" };
    title.height = 28;

    const infoRow = ws.addRow([
      `اسم المعلم/ة: ${t.name}`, "", "",
      `للعام الدراسي: ${year}`, "",
      `مدرسة: ${info.schoolName}`, "",
    ]);
    ws.mergeCells(infoRow.number, 1, infoRow.number, 3);
    ws.mergeCells(infoRow.number, 4, infoRow.number, 5);
    ws.mergeCells(infoRow.number, 6, infoRow.number, 7);
    infoRow.eachCell(c => {
      c.font = { name: FONT, bold: true, size: 12 };
      c.alignment = { horizontal: "right", vertical: "middle" };
    });
    infoRow.height = 22;
    ws.addRow([]);

    const head = ws.addRow(HEADERS);
    head.eachCell(c => {
      c.font = { name: FONT, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = thin();
    });
    head.height = 24;

    for (let i = 0; i < ROWS_PER_TEACHER; i++) {
      const r = ws.addRow(new Array(HEADERS.length).fill(""));
      r.height = 20;
      r.eachCell({ includeEmpty: true }, c => {
        c.font = { name: FONT, size: 11 };
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.border = thin();
      });
    }

    ws.addRow([]);
    const notes = ws.addRow(["ملاحظات :"]);
    ws.mergeCells(notes.number, 1, notes.number, HEADERS.length);
    notes.getCell(1).font = { name: FONT, bold: true, size: 12 };
    notes.getCell(1).alignment = { horizontal: "right" };
    ws.addRow([]);
    const sign = ws.addRow([`مديرة المدرسة : ${info.directorName || ""}`]);
    ws.mergeCells(sign.number, 1, sign.number, HEADERS.length);
    sign.getCell(1).font = { name: FONT, bold: true, size: 12 };
    sign.getCell(1).alignment = { horizontal: "right" };
    const form = ws.addRow(["FormQF71-1-54rev.a"]);
    ws.mergeCells(form.number, 1, form.number, HEADERS.length);
    form.getCell(1).font = { name: FONT, size: 10, italic: true };
    form.getCell(1).alignment = { horizontal: "left" };
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `سجل ما قطع من المنهاج - ${info.schoolName}.xlsx`);
}

/* ------------------------------ Word ------------------------------ */
/* تصدير منسّق بالكامل باتجاه من اليمين لليسار:
   - عنوان ذهبي/كحلي واضح، معلومات المعلم/ة والسنة والمدرسة في سطر واحد
   - جدول بحدود واضحة، صف رأس ثابت، ارتفاعات صفوف مريحة للكتابة اليدوية */

const WORD_BORDER = { style: BorderStyle.SINGLE, size: 8, color: "2B3A55" };
const WORD_BORDERS = { top: WORD_BORDER, bottom: WORD_BORDER, left: WORD_BORDER, right: WORD_BORDER };

function p(text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; color?: string; before?: number; after?: number } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 60 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 24, font: FONT, rightToLeft: true, color: opts.color })],
  });
}

function cell(text: string, opts: { header?: boolean; width: number }) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    borders: WORD_BORDERS,
    shading: opts.header ? { fill: "2B3A55", type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      children: [new TextRun({
        text, bold: opts.header, size: opts.header ? 22 : 20, font: FONT, rightToLeft: true,
        color: opts.header ? "FFFFFF" : "000000",
      })],
    })],
  });
}

export async function exportCurriculumRecordDocx(
  teachers: Teacher[],
  info: CurriculumRecordInfo,
) {
  const year = info.academicYear || defaultYear();
  const total = 9360;
  const cols = [1100, 1600, 900, 1300, 1400, 1400, 1660];
  const sum = cols.reduce((a, b) => a + b, 0);
  const colWidths = cols.map(c => Math.round((c / sum) * total));

  const children: (Paragraph | Table)[] = [];

  teachers.forEach((t, idx) => {
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(p("سجل متابعة ما قطع من المنهاج", {
      bold: true, size: 36, align: AlignmentType.CENTER, color: "2B3A55", after: 160,
    }));

    // سطر المعلومات: جدول بثلاث خانات بلا حدود لمحاذاة دقيقة من اليمين لليسار
    const infoW = [3120, 3120, 3120];
    const infoTable = new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: infoW,
      visuallyRightToLeft: true,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      rows: [new TableRow({
        children: [
          `اسم المعلم/ة: ${t.name}`,
          `للعام الدراسي: ${year}`,
          `مدرسة: ${info.schoolName}`,
        ].map((txt, i) => new TableCell({
          width: { size: infoW[i], type: WidthType.DXA },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            children: [new TextRun({ text: txt, bold: true, size: 24, font: FONT, rightToLeft: true })],
          })],
        })),
      })],
    });
    children.push(infoTable);
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        height: { value: 500, rule: "atLeast" },
        children: HEADERS.map((h, i) => cell(h, { header: true, width: colWidths[i] })),
      }),
    ];
    for (let i = 0; i < ROWS_PER_TEACHER; i++) {
      rows.push(new TableRow({
        height: { value: 420, rule: "atLeast" },
        children: colWidths.map(w => cell("", { width: w })),
      }));
    }

    children.push(new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: colWidths,
      visuallyRightToLeft: true,
      rows,
    }));

    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    children.push(p("ملاحظات :", { bold: true }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    children.push(p(`مدير/ة المدرسة : ${info.directorName || ""}`, { bold: true }));
    children.push(p("FormQF71-1-54rev.a", { size: 18, align: AlignmentType.LEFT }));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `سجل ما قطع من المنهاج - ${info.schoolName}.docx`);
}

