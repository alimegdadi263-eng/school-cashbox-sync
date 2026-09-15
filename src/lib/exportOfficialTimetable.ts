import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ClassTimetable } from "@/types/timetable";
import { DAYS, parseClassKey, compareClassKeys } from "@/types/timetable";
import { MINISTRY_EMBLEM_BASE64 } from "@/lib/ministryEmblem";

/** إدراج شعار الوزارة أعلى النموذج (مضمّن داخل الكود، لا يحتاج إنترنت). */
export function addEmblem(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  col: number,
  row: number,
  size = 85,
) {
  try {
    const imageId = wb.addImage({ base64: MINISTRY_EMBLEM_BASE64, extension: "png" });
    ws.addImage(imageId, {
      tl: { col, row } as never,
      ext: { width: size, height: size },
      editAs: "oneCell",
    });
  } catch {
    /* تجاهل أي خطأ في الصورة حتى لا يتوقف التصدير */
  }
}

/** نموذج المباحث الرسمي المطابق لملف المديرية المرفق. */

const FONT = "Traditional Arabic";
const PERIOD_NAMES = [
  "الحصة الأولى", "الحصة الثانية", "الحصة الثالثة", "الحصة الرابعة",
  "الحصة الخامسة", "الحصة السادسة", "الحصة السابعة", "الحصة الثامنة",
];

export interface OfficialTimetableInfo {
  schoolName: string;
  directorateName?: string;
  cityName?: string;
  academicYear?: string;
  directorName?: string;
}

const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, bottom: { style: "thin" },
  left: { style: "thin" }, right: { style: "thin" },
};

const medium: Partial<ExcelJS.Borders> = {
  top: { style: "medium" }, bottom: { style: "medium" },
  left: { style: "medium" }, right: { style: "medium" },
};

/** الاسم الأول فقط للمعلم */
export function firstName(name: string) {
  return (name || "").trim().split(/\s+/)[0] || "";
}

export function buildSubjectsTemplateWorkbook(
  timetable: ClassTimetable,
  info: OfficialTimetableInfo
) {
  const classKeys = Object.keys(timetable).sort(compareClassKeys);
  if (classKeys.length === 0) throw new Error("لا يوجد جدول لتصديره");

  // النموذج الأصلي يبدأ من العمود C: اليوم، الحصة، ثم عمودان لكل صف.
  const dayCol = 3;
  const periodCol = 4;
  const firstClassCol = 5;
  const totalCols = 4 + classKeys.length * 2;

  const wb = new ExcelJS.Workbook();
  wb.creator = "الإدارة المدرسية";
  wb.created = new Date();
  const ws = wb.addWorksheet("نموذج المباحث", { views: [{ rightToLeft: true, showGridLines: false }] });
  ws.properties.defaultRowHeight = 18;
  ws.pageSetup = {
    paperSize: 9 as any, // A4 كما في الملف المرفق
    orientation: "landscape" as any,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    printArea: `C1:${ws.getColumn(totalCols).letter}55`,
  };

  const set = (row: number, col: number, value: string) => {
    const c = ws.getCell(row, col);
    c.value = value;
    return c;
  };

  // شعار الوزارة أعلى يمين النموذج (الاتجاه RTL يضعه على اليمين بصرياً).
  addEmblem(wb, ws, dayCol - 1, 0, 90);

  // عنوان النموذج في أعلى مساحة الصفوف، بنفس الفراغ الجانبي للنموذج الأصلي.
  ws.mergeCells(1, firstClassCol, 1, totalCols);
  const title = set(1, firstClassCol, "جدول ترتيب الدروس");
  title.font = { name: "Arial", bold: true, size: 26 };
  title.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(1).height = 32.5;

  ws.mergeCells(3, firstClassCol, 3, totalCols);
  const year = set(3, firstClassCol, `للعام الدراسي     ${info.academicYear || ""}`);
  year.font = { name: "Arial", bold: true, size: 20 };
  year.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(3).height = 25;

  const schoolEnd = Math.min(totalCols, dayCol + Math.max(8, Math.floor(classKeys.length * 0.75)));
  ws.mergeCells(5, dayCol, 5, schoolEnd);
  const school = set(5, dayCol, `مدرسة ${info.schoolName || ""}`.trim());
  school.font = { name: "Arial", bold: true, size: 20 };
  school.alignment = { horizontal: "center", vertical: "middle" };
  const cityStart = Math.max(schoolEnd + 1, totalCols - Math.max(4, Math.floor(classKeys.length / 2)));
  ws.mergeCells(5, cityStart, 5, totalCols);
  const location = set(5, cityStart, `المدينة / القرية : ${info.cityName || ""}`.trim());
  location.font = { name: "Arial", bold: true, size: 20 };
  location.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(5).height = 28;

  // الصفان 7 و8: اليوم والحصة، ثم الموضوع والمعلم لكل صف موجود فعلياً.
  ws.mergeCells(7, dayCol, 8, dayCol);
  ws.mergeCells(7, periodCol, 8, periodCol);
  const dayHeader = set(7, dayCol, "اليوم");
  const periodHeader = set(7, periodCol, "الحصة");
  [dayHeader, periodHeader].forEach(c => {
    c.font = { name: "Arial", bold: true, size: 14 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = thin;
  });
  classKeys.forEach((key, i) => {
    const col = firstClassCol + i * 2;
    ws.mergeCells(7, col, 7, col + 1);
    const { className, section } = parseClassKey(key);
    const c = set(7, col, `${className} ${section}`.trim());
    c.font = { name: "Arial", bold: true, size: 16 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = medium;
  });
  classKeys.forEach((_, i) => {
    const col = firstClassCol + i * 2;
    const a = set(8, col, "الموضوع");
    const b = set(8, col + 1, "المعلم");
    [a, b].forEach(c => {
      c.font = { name: "Arial", bold: true, size: 13 };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = thin;
    });
  });
  ws.getRow(7).height = 30;
  ws.getRow(8).height = 30;

  // النموذج ثابت على ثماني حصص؛ الجداول ذات 5–7 حصص تترك آخر الخانات فارغة.
  let row = 9;
  for (let di = 0; di < DAYS.length; di++) {
    const startRow = row;
    for (let p = 0; p < 8; p++) {
      const pc = set(row, periodCol, PERIOD_NAMES[p]);
      pc.font = { name: "Arial", bold: true, size: 14 };
      pc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

      classKeys.forEach((key, i) => {
        const col = firstClassCol + i * 2;
        const cell = timetable[key]?.[di]?.[p];
        const subj = set(row, col, cell ? cell.subjectName : "");
        const teach = set(row, col + 1, cell ? firstName(cell.teacherName) : "");
        subj.font = { name: "Arial", bold: true, size: 12 };
        teach.font = { name: "Arial", bold: true, size: 12, color: { argb: "FFFF0000" } };
        [subj, teach].forEach(c => {
          c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        });
      });
      ws.getRow(row).height = 30;
      row++;
    }
    ws.mergeCells(startRow, dayCol, row - 1, dayCol);
    const dc = ws.getCell(startRow, dayCol);
    dc.value = DAYS[di];
    dc.font = { name: "Arial", bold: true, size: 14 };
    dc.alignment = { horizontal: "center", vertical: "middle", textRotation: 90 };
  }

  for (let r = 7; r < row; r++) {
    for (let c = dayCol; c <= totalCols; c++) ws.getCell(r, c).border = thin;
  }

  // تذييل مطابق لترتيب النصوص في الملف المرفق.
  const middle = Math.max(dayCol + 4, Math.floor((dayCol + totalCols) / 2));
  ws.mergeCells(49, dayCol + 3, 49, middle);
  set(49, dayCol + 3, "جرى تدقيقه في قسم التعليم العام من قبل ...........................................................");
  ws.mergeCells(50, middle - 3, 50, middle + 3);
  set(50, middle - 3, "توقيعــــــــــه");
  ws.mergeCells(52, middle - 3, 52, middle + 3);
  set(52, middle - 3, `مدير التربية والتعليم${info.directorateName ? ` / ${info.directorateName}` : ""}`);
  const directorStart = Math.min(totalCols, middle + 4);
  if (directorStart <= totalCols) {
    ws.mergeCells(52, directorStart, 52, totalCols);
    set(52, directorStart, `مدير/ة المدرسة ${info.directorName || ""}`.trim());
  }
  ws.mergeCells(53, dayCol + 3, 53, Math.min(totalCols, dayCol + 7));
  set(53, dayCol + 3, "التاريخ        /      /           مصدق");
  ws.mergeCells(55, dayCol + 3, 55, Math.min(totalCols, dayCol + 6));
  set(55, dayCol + 3, "الخاتم الرسمي");

  [49, 50, 52, 53, 55].forEach(r => {
    ws.getRow(r).height = 18;
    ws.getRow(r).eachCell(c => {
      c.font = { name: "Arial", bold: true, size: 12 };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
  });

  ws.getColumn(dayCol).width = 10.73;
  ws.getColumn(periodCol).width = 17;
  for (let c = firstClassCol; c <= totalCols; c += 2) {
    ws.getColumn(c).width = 14.45;
    ws.getColumn(c + 1).width = 8.82;
  }

  return wb;
}

export async function exportSubjectsTemplateExcel(
  timetable: ClassTimetable,
  info: OfficialTimetableInfo
) {
  const wb = buildSubjectsTemplateWorkbook(timetable, info);
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `نموذج_المباحث_${info.schoolName || "المدرسة"}.xlsx`);
}

/** ===== النموذج المصدق (جدول ترتيب الدروس المعتمد من المديرية) ===== */

const CERT_PERIOD_NAMES = [
  "الاولى", "الثانية", "الثالثة", "الرابعة",
  "الخامسة", "السادسة", "السابعة", "الثامنة",
];

export function buildCertifiedTimetableWorkbook(
  timetable: ClassTimetable,
  info: OfficialTimetableInfo
) {
  const classKeys = Object.keys(timetable).sort(compareClassKeys);
  if (classKeys.length === 0) throw new Error("لا يوجد جدول لتصديره");

  const dayCol = 1;      // A
  const periodCol = 2;   // B
  const firstClassCol = 3; // C
  const totalCols = 2 + classKeys.length * 2;
  const mid = Math.max(6, Math.round(totalCols / 2));

  const wb = new ExcelJS.Workbook();
  wb.creator = "الإدارة المدرسية";
  wb.created = new Date();
  const ws = wb.addWorksheet("جدول ترتيب الدروس", {
    views: [{ rightToLeft: true, showGridLines: false }],
  });
  ws.pageSetup = {
    paperSize: 8 as any, // A3
    orientation: "landscape" as any,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.3, footer: 0.3 },
  };

  const set = (row: number, col: number, value: string) => {
    const c = ws.getCell(row, col);
    c.value = value;
    return c;
  };
  const style = (
    c: ExcelJS.Cell,
    size: number,
    bold: boolean,
    horizontal: "center" | "right" = "center",
    rotation = 0,
    color?: string,
  ) => {
    c.font = { name: FONT, size, bold, ...(color ? { color: { argb: color } } : {}) };
    c.alignment = {
      horizontal,
      vertical: "middle",
      wrapText: true,
      ...(rotation ? { textRotation: rotation } : {}),
    };
  };

  // شعار الوزارة أعلى منتصف الصفحة
  addEmblem(wb, ws, Math.max(0, mid - 2), 0, 132);

  ws.mergeCells(6, 1, 6, totalCols);
  style(set(6, 1, "جدول ترتيب الدروس"), 22, true);
  ws.getRow(6).height = 38;

  ws.mergeCells(7, 1, 7, totalCols);
  style(set(7, 1, `للعام الدراسي   ${info.academicYear || ""}`.trimEnd()), 16, true);
  ws.getRow(7).height = 34;

  const third = Math.max(2, Math.floor(totalCols / 3));
  ws.mergeCells(8, 1, 8, third);
  style(set(8, 1, `مديرية التربية والتعليم: ${info.directorateName || ""}`.trimEnd()), 13, true, "right");
  ws.mergeCells(8, third + 1, 8, third * 2);
  style(set(8, third + 1, `مدرسة: ${info.schoolName || ""}`.trimEnd()), 13, true, "right");
  ws.mergeCells(8, third * 2 + 1, 8, totalCols);
  style(set(8, third * 2 + 1, `المدينة/ القرية: ${info.cityName || ""}`.trimEnd()), 13, true, "right");
  ws.getRow(8).height = 30;

  // رؤوس الجدول
  ws.mergeCells(9, dayCol, 10, dayCol);
  ws.mergeCells(9, periodCol, 10, periodCol);
  classKeys.forEach((key, i) => {
    const col = firstClassCol + i * 2;
    ws.mergeCells(9, col, 9, col + 1);
    const { className, section } = parseClassKey(key);
    style(set(9, col, `${className} ${section}`.trim()), 12, true);
    style(set(10, col, "الموضوع"), 11, true);
    style(set(10, col + 1, "المعلم"), 11, true);
  });
  ws.getRow(9).height = 26;
  ws.getRow(10).height = 20;

  // صفوف الأيام: ثماني حصص لكل يوم
  let row = 11;
  for (let di = 0; di < DAYS.length; di++) {
    const startRow = row;
    for (let p = 0; p < 8; p++) {
      style(set(row, periodCol, CERT_PERIOD_NAMES[p]), 11, true);
      classKeys.forEach((key, i) => {
        const col = firstClassCol + i * 2;
        const cell = timetable[key]?.[di]?.[p];
        style(set(row, col, cell ? cell.subjectName : ""), 10, false);
        style(set(row, col + 1, cell ? firstName(cell.teacherName) : ""), 10, false);
      });
      ws.getRow(row).height = 20;
      row++;
    }
    ws.mergeCells(startRow, dayCol, row - 1, dayCol);
    style(ws.getCell(startRow, dayCol), 12, true, "center", 90);
  }

  for (let r = 9; r < row; r++) {
    for (let c = dayCol; c <= totalCols; c++) ws.getCell(r, c).border = thin;
  }

  // التذييل
  const footStart = row + 1;
  ws.mergeCells(footStart, 1, footStart, mid - 1);
  style(set(footStart, 1, "جرى تدقيقه في قسم التعليم العام من قبل : .............................................."), 12, true, "right");
  ws.mergeCells(footStart, mid, footStart, totalCols);
  style(set(footStart, mid, `اسم مدير المدرسة : ${info.directorName || ""}`.trimEnd()), 12, true, "right");

  style(set(footStart + 1, 1, "التاريخ :"), 12, true, "right");
  style(set(footStart + 1, 4, "مصدق"), 12, true, "right");
  style(set(footStart + 1, 8, "توقيعه :"), 12, true, "right");
  ws.mergeCells(footStart + 1, mid, footStart + 1, totalCols);
  style(set(footStart + 1, mid, "توقيعه :"), 12, true, "right");

  style(set(footStart + 2, 4, "الخاتم الرسمي"), 12, true, "right");
  style(set(footStart + 2, 8, `مدير التربية والتعليم : ${info.directorateName || ""}`.trimEnd()), 12, true, "right");
  ws.mergeCells(footStart + 2, mid, footStart + 2, totalCols);
  style(set(footStart + 2, mid, "خاتم المدرسة :"), 12, true, "right");

  [footStart, footStart + 1, footStart + 2].forEach(r => { ws.getRow(r).height = 28; });

  ws.getColumn(dayCol).width = 7;
  ws.getColumn(periodCol).width = 10;
  for (let c = firstClassCol; c <= totalCols; c++) ws.getColumn(c).width = 11;

  return wb;
}

export async function exportOfficialTimetableExcel(
  timetable: ClassTimetable,
  _periodsPerDay: number,
  info: OfficialTimetableInfo
) {
  const wb = buildCertifiedTimetableWorkbook(timetable, info);
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `جدول_مصدق_${info.schoolName || "المدرسة"}.xlsx`);
}
