import {
  AlignmentType, BorderStyle, Document, Packer, PageBreak, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Teacher } from "@/types/timetable";
import { addOfficialLogoToExcel, officialLogoParagraph } from "@/lib/officialBranding";

const FONT = "Traditional Arabic";
const BLACK = "FF000000";
const TRACK_HEADERS = ["الصف", "المبحث", "عدد الصفحات الكلي", "عدد الصفحات المقطوعة", "نسبة ما قطع من المنهاج", "متقدم", "مطابق", "متأخر"];
const VISIT_HEADERS = ["المباحث التي يدرسها", "الصف", "عدد الحصص الأسبوعية", "عدد الشعب"];

export interface CurriculumRecordInfo {
  schoolName: string;
  directorName: string;
  academicYear?: string;
  directorateName?: string;
  supervisorName?: string;
  semester?: string;
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

function assignments(teacher: Teacher) {
  const grouped = new Map<string, { subject: string; className: string; periods: number; sections: Set<string> }>();
  for (const item of teacher.subjects || []) {
    const key = `${item.subjectName}|${item.className}`;
    const found = grouped.get(key) || { subject: item.subjectName, className: item.className, periods: 0, sections: new Set<string>() };
    found.periods += item.periodsPerWeek || 0;
    if (item.section) found.sections.add(item.section);
    grouped.set(key, found);
  }
  return [...grouped.values()];
}

const xBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
};

function styleExcelCell(cell: ExcelJS.Cell, bold = false) {
  cell.font = { name: FONT, size: 11, bold, color: { argb: BLACK } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" as never };
  cell.border = xBorder;
}

export async function exportCurriculumRecordExcel(teachers: Teacher[], info: CurriculumRecordInfo) {
  const wb = new ExcelJS.Workbook();
  const year = info.academicYear || defaultYear();
  for (const [idx, teacher] of teachers.entries()) {
    const ws = wb.addWorksheet(safeSheetName(teacher.name, idx), { views: [{ rightToLeft: true, showGridLines: false }] });
    ws.pageSetup = { paperSize: 9 as never, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { top: 0.25, bottom: 0.25, left: 0.3, right: 0.3, header: 0.1, footer: 0.1 } };
    ws.columns = [13, 16, 17, 18, 20, 9, 9, 9].map(width => ({ width }));
    addOfficialLogoToExcel(wb, ws, 3.2, 0, 76);
    ws.getRow(1).height = 58;
    const merged = (row: number, text: string, size: number, bold = false) => {
      ws.mergeCells(row, 1, row, 8);
      const c = ws.getCell(row, 1); c.value = text;
      c.font = { name: FONT, size, bold }; c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" as never };
    };
    merged(4, `إدارة الإشراف والتدريب التربوي / مديرية ${info.directorateName || "الإشراف والإسناد التربوي"}`, 12);
    merged(5, "قسم إدارة أداء الإسناد التربوي", 12);
    merged(6, "سجل ما قطع من المنهاج الدراسي", 15, true);
    merged(7, `مديرية التربية والتعليم: ${info.directorateName || "...................."}     مدرسة: ${info.schoolName || "...................."}     العام الدراسي: ${year}`, 11, true);
    merged(8, `اسم المعلم/ة: ${teacher.name}     اسم المشرف المتابع للمعلم: ${info.supervisorName || "...................."}     الفصل الدراسي: ${info.semester || "الأول / الثاني"}`, 11, true);
    merged(9, "رقم المتابعة للمنهاج وتاريخها: ............................................................", 11);

    const a = assignments(teacher);
    const visitStart = 11;
    VISIT_HEADERS.forEach((h, i) => { const c = ws.getCell(visitStart, i + 1); c.value = h; styleExcelCell(c, true); });
    ws.mergeCells(visitStart, 4, visitStart, 8);
    const visitRows = Math.max(3, Math.min(4, a.length || 3));
    for (let i = 0; i < visitRows; i++) {
      const item = a[i]; const r = visitStart + 1 + i;
      ws.getCell(r, 1).value = item?.subject || "";
      ws.getCell(r, 2).value = item?.className || "";
      ws.getCell(r, 3).value = item?.periods || "";
      ws.getCell(r, 4).value = item?.sections.size || "";
      ws.mergeCells(r, 4, r, 8);
      for (let c = 1; c <= 8; c++) styleExcelCell(ws.getCell(r, c));
      ws.getRow(r).height = 22;
    }

    const trackStart = visitStart + visitRows + 2;
    TRACK_HEADERS.forEach((h, i) => { const c = ws.getCell(trackStart, i + 1); c.value = h; styleExcelCell(c, true); });
    ws.getRow(trackStart).height = 32;
    const trackRows = Math.max(10, a.length);
    for (let i = 0; i < trackRows; i++) {
      const item = a[i]; const r = trackStart + 1 + i;
      ws.getCell(r, 1).value = item?.className || "";
      ws.getCell(r, 2).value = item?.subject || "";
      for (let c = 1; c <= 8; c++) styleExcelCell(ws.getCell(r, c));
      ws.getRow(r).height = 22;
    }
    let r = trackStart + trackRows + 2;
    merged(r++, "تم نتيجة التحليل التقني في الغرف بوجود إجراء تم اتخاذه: ( حفل / تقديم / تأخر ) على تنفيذ الوحدات المتسلسلة ( نعم / لا )", 10);
    merged(r++, "الإجراءات المتخذة لمعالجة التأخر: ................................................................................................................", 10);
    merged(r++, "توقيع المعلم وتاريخه: ..............................        توقيع مدير المدرسة وخاتمه: ..............................        توقيع المشرف وتاريخه: ..............................", 10, true);
    merged(r++, "* يحسب ما تم قطعه من المنهاج: عدد الصفحات المقطوعة ÷ عدد الصفحات الكلية × 100.", 9);
    merged(r++, "* يطبع السجل من النظام ويحفظ لدى الإدارة للاطلاع والمتابعة.", 9);
    ws.getRow(r - 1).height = 18;
  }
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `سجل ما قطع من المنهاج - ${info.schoolName}.xlsx`);
}

const border = { style: BorderStyle.SINGLE, size: 5, color: "666666" };
const borders = { top: border, bottom: border, left: border, right: border };
function run(text: string, size = 21, bold = false) { return new TextRun({ text, font: FONT, size, bold, rightToLeft: true }); }
function para(text: string, size = 21, bold = false, align = AlignmentType.CENTER, after = 45) {
  return new Paragraph({ alignment: align, bidirectional: true, spacing: { after }, children: [run(text, size, bold)] });
}
function cell(text: string, width: number, bold = false) {
  return new TableCell({ width: { size: width, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER, margins: { top: 45, bottom: 45, left: 55, right: 55 }, children: [para(text, 19, bold, AlignmentType.CENTER, 0)] });
}
function row(values: string[], widths: number[], bold = false, height = 320) {
  return new TableRow({ height: { value: height, rule: "atLeast" }, children: values.map((v, i) => cell(v, widths[i], bold)) });
}

export async function exportCurriculumRecordDocx(teachers: Teacher[], info: CurriculumRecordInfo) {
  const year = info.academicYear || defaultYear();
  const total = 10000;
  const visitWidths = [2400, 1900, 2800, 2900];
  const trackWidths = [1100, 1450, 1500, 1600, 1900, 800, 800, 850];
  const children: (Paragraph | Table)[] = [];
  teachers.forEach((teacher, index) => {
    if (index) children.push(new Paragraph({ children: [new PageBreak()] }));
    const a = assignments(teacher);
    children.push(
      officialLogoParagraph(72, 25),
      para(`إدارة الإشراف والتدريب التربوي / مديرية ${info.directorateName || "الإشراف والإسناد التربوي"}`, 21),
      para("قسم إدارة أداء الإسناد التربوي", 21),
      para("سجل ما قطع من المنهاج الدراسي", 28, true, AlignmentType.CENTER, 90),
      para(`مديرية التربية والتعليم: ${info.directorateName || "...................."}     مدرسة: ${info.schoolName || "...................."}     العام الدراسي: ${year}`, 20, true, AlignmentType.LEFT),
      para(`اسم المعلم/ة: ${teacher.name}     اسم المشرف المتابع للمعلم: ${info.supervisorName || "...................."}     الفصل الدراسي: ${info.semester || "الأول / الثاني"}`, 20, true, AlignmentType.LEFT),
      para("رقم المتابعة للمنهاج وتاريخها: ............................................................", 20, false, AlignmentType.LEFT, 80),
    );
    const visitRows = [row(VISIT_HEADERS, visitWidths, true, 360)];
    for (let i = 0; i < Math.max(3, Math.min(4, a.length || 3)); i++) {
      const item = a[i];
      visitRows.push(row([item?.subject || "", item?.className || "", item ? String(item.periods) : "", item ? String(item.sections.size) : ""], visitWidths, false, 330));
    }
    children.push(new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: visitWidths, visuallyRightToLeft: true, rows: visitRows }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    const trackingRows = [row(TRACK_HEADERS, trackWidths, true, 470)];
    for (let i = 0; i < Math.max(10, a.length); i++) {
      const item = a[i];
      trackingRows.push(row([item?.className || "", item?.subject || "", "", "", "", "", "", ""], trackWidths, false, 300));
    }
    children.push(new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: trackWidths, visuallyRightToLeft: true, rows: trackingRows }));
    children.push(
      para("تم نتيجة التحليل التقني في الغرف بوجود إجراء تم اتخاذه: ( حفل / تقديم / تأخر ) على تنفيذ الوحدات المتسلسلة ( نعم / لا )", 17, false, AlignmentType.LEFT, 25),
      para("الإجراءات المتخذة لمعالجة التأخر: ................................................................................................................", 17, false, AlignmentType.LEFT, 35),
      para("توقيع المعلم وتاريخه: ....................     توقيع مدير المدرسة وخاتمه: ....................     توقيع المشرف وتاريخه: ....................", 18, true, AlignmentType.CENTER, 45),
      para("* يحسب ما تم قطعه من المنهاج: عدد الصفحات المقطوعة ÷ عدد الصفحات الكلية × 100.", 16, false, AlignmentType.LEFT, 15),
      para("* يطبع السجل من النظام ويحفظ لدى الإدارة للاطلاع والمتابعة.", 16, false, AlignmentType.LEFT, 0),
    );
  });
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 320, right: 700, bottom: 320, left: 700 } } }, children],
  });
  saveAs(await Packer.toBlob(doc), `سجل ما قطع من المنهاج - ${info.schoolName}.docx`);
}
