import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ClassTimetable } from "@/types/timetable";
import { DAYS, parseClassKey, compareClassKeys } from "@/types/timetable";

/**
 * جدول ترتيب الدروس (النموذج الرسمي المصدق من المديرية)
 * يطابق النموذج الورقي: الصفوف كأعمدة (الموضوع + المعلم) والأيام/الحصص كصفوف،
 * مع ترويسة (المديرية / المدرسة / المدينة) وتذييل التصديق والتواقيع.
 * اسم المعلم يُكتب بالاسم الأول فقط كما في النموذج الرسمي.
 */

const FONT = "Traditional Arabic";
const PERIOD_NAMES = [
  "الاولى", "الثانية", "الثالثة", "الرابعة",
  "الخامسة", "السادسة", "السابعة", "الثامنة",
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

/** الاسم الأول فقط للمعلم */
export function firstName(name: string) {
  return (name || "").trim().split(/\s+/)[0] || "";
}

export async function exportOfficialTimetableExcel(
  timetable: ClassTimetable,
  periodsPerDay: number,
  info: OfficialTimetableInfo
) {
  const classKeys = Object.keys(timetable).sort(compareClassKeys);
  if (classKeys.length === 0) throw new Error("لا يوجد جدول لتصديره");

  const totalCols = 2 + classKeys.length * 2;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("جدول ترتيب الدروس");
  ws.views = [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 5 }];
  ws.pageSetup = {
    paperSize: 8 as any, // A3
    orientation: "landscape" as any,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
  };

  const set = (row: number, col: number, value: string) => {
    const c = ws.getCell(row, col);
    c.value = value;
    return c;
  };

  // Row 1: العنوان
  ws.mergeCells(1, 1, 1, totalCols);
  const title = set(1, 1, "جدول ترتيب الدروس");
  title.font = { name: FONT, bold: true, size: 22 };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 38;

  // Row 2: العام الدراسي
  ws.mergeCells(2, 1, 2, totalCols);
  const year = set(2, 1, `للعام الدراسي ${info.academicYear || ""}`.trim());
  year.font = { name: FONT, bold: true, size: 16 };
  year.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 34;

  // Row 3: المديرية / المدرسة / المدينة
  const third = Math.max(2, Math.floor(totalCols / 3));
  ws.mergeCells(3, 1, 3, third);
  ws.mergeCells(3, third + 1, 3, third * 2);
  ws.mergeCells(3, third * 2 + 1, 3, totalCols);
  const infoCells: [number, string][] = [
    [1, `مديرية التربية والتعليم: ${info.directorateName || ""}`],
    [third + 1, `مدرسة: ${info.schoolName || ""}`],
    [third * 2 + 1, `المدينة/ القرية: ${info.cityName || ""}`],
  ];
  infoCells.forEach(([col, text]) => {
    const c = set(3, col, text);
    c.font = { name: FONT, bold: true, size: 13 };
    c.alignment = { horizontal: "right", vertical: "middle" };
  });
  ws.getRow(3).height = 30;

  // Row 4: أسماء الصفوف (عمودان لكل صف)
  ws.mergeCells(4, 1, 5, 1);
  ws.mergeCells(4, 2, 5, 2);
  classKeys.forEach((key, i) => {
    const col = 3 + i * 2;
    ws.mergeCells(4, col, 4, col + 1);
    const { className, section } = parseClassKey(key);
    const c = set(4, col, `${className} ${section}`);
    c.font = { name: FONT, bold: true, size: 12 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  // Row 5: الموضوع / المعلم
  classKeys.forEach((_, i) => {
    const col = 3 + i * 2;
    const a = set(5, col, "الموضوع");
    const b = set(5, col + 1, "المعلم");
    [a, b].forEach(c => {
      c.font = { name: FONT, bold: true, size: 11 };
      c.alignment = { horizontal: "center", vertical: "middle" };
    });
  });
  ws.getRow(4).height = 26;
  ws.getRow(5).height = 20;

  // Body: الأيام والحصص
  let row = 6;
  for (let di = 0; di < DAYS.length; di++) {
    const startRow = row;
    for (let p = 0; p < periodsPerDay; p++) {
      const pc = set(row, 2, PERIOD_NAMES[p] || `${p + 1}`);
      pc.font = { name: FONT, bold: true, size: 11 };
      pc.alignment = { horizontal: "center", vertical: "middle" };

      classKeys.forEach((key, i) => {
        const col = 3 + i * 2;
        const cell = timetable[key]?.[di]?.[p];
        const subj = set(row, col, cell ? cell.subjectName : "");
        const teach = set(row, col + 1, cell ? firstName(cell.teacherName) : "");
        [subj, teach].forEach(c => {
          c.font = { name: FONT, size: 10 };
          c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        });
      });
      ws.getRow(row).height = 20;
      row++;
    }
    ws.mergeCells(startRow, 1, row - 1, 1);
    const dc = ws.getCell(startRow, 1);
    dc.value = DAYS[di];
    dc.font = { name: FONT, bold: true, size: 12 };
    dc.alignment = { horizontal: "center", vertical: "middle", textRotation: 90 };
  }

  // حدود لكل الجدول
  for (let r = 4; r < row; r++) {
    for (let c = 1; c <= totalCols; c++) ws.getCell(r, c).border = thin;
  }

  // التذييل الرسمي
  const f1 = row + 1;
  ws.mergeCells(f1, 1, f1, Math.max(2, Math.floor(totalCols / 2)));
  set(f1, 1, "جرى تدقيقه في قسم التعليم العام من قبل : ..............................................");
  ws.mergeCells(f1, Math.floor(totalCols / 2) + 1, f1, totalCols);
  set(f1, Math.floor(totalCols / 2) + 1, `اسم مدير المدرسة : ${info.directorName || ""}`);

  const f2 = f1 + 1;
  set(f2, 1, "التاريخ :");
  set(f2, 4, "مصدق");
  set(f2, 8, "توقيعه :");
  ws.mergeCells(f2, Math.floor(totalCols / 2) + 1, f2, totalCols);
  set(f2, Math.floor(totalCols / 2) + 1, "توقيعه :");

  const f3 = f2 + 1;
  set(f3, 4, "الخاتم الرسمي");
  set(f3, 8, "مدير التربية والتعليم :");
  ws.mergeCells(f3, Math.floor(totalCols / 2) + 1, f3, totalCols);
  set(f3, Math.floor(totalCols / 2) + 1, "خاتم المدرسة :");

  [f1, f2, f3].forEach(r => {
    ws.getRow(r).height = 28;
    ws.getRow(r).eachCell(c => {
      c.font = { name: FONT, bold: true, size: 12 };
      c.alignment = { horizontal: "right", vertical: "middle" };
    });
  });

  // عرض الأعمدة
  ws.getColumn(1).width = 7;
  ws.getColumn(2).width = 10;
  for (let c = 3; c <= totalCols; c++) ws.getColumn(c).width = 11;

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `جدول_مصدق_${info.schoolName || "المدرسة"}.xlsx`);
}
