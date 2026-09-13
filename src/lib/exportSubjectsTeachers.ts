import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Teacher } from "@/types/timetable";
import { compareClassKeys, getClassKey, parseClassKey } from "@/types/timetable";
import { addEmblem, type OfficialTimetableInfo } from "@/lib/exportOfficialTimetable";

/**
 * جدول توزيع المباحث بين المعلمين.
 * يُبنى بالكامل برمجياً (بدون قالب خارجي) لضمان نجاح التصدير في كل البيئات:
 * الويب، والمعاينة، وبرنامج سطح المكتب.
 */

const CLASSES_PER_SHEET = 19;

const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, bottom: { style: "thin" },
  left: { style: "thin" }, right: { style: "thin" },
};

const medium: Partial<ExcelJS.Borders> = {
  top: { style: "medium" }, bottom: { style: "medium" },
  left: { style: "medium" }, right: { style: "medium" },
};

function safeName(value: string) {
  return (value || "المدرسة").replace(/[\\/:*?"<>|]/g, "_");
}

function classLabel(key: string) {
  const { className, section } = parseClassKey(key);
  return `${className} ${section}`.trim();
}

function buildSheet(
  wb: ExcelJS.Workbook,
  sheetIndex: number,
  teachers: Teacher[],
  classKeys: string[],
  info: OfficialTimetableInfo,
) {
  const name = sheetIndex === 0 ? "جدول المباحث" : `جدول المباحث ${sheetIndex + 1}`;
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, showGridLines: false }] });

  const NO_COL = 1;          // الرقم
  const NAME_COL = 2;        // اسم المعلم
  const FIRST_CLASS_COL = 3; // عمودان لكل صف (المبحث / عدد الحصص)
  const totalCols = FIRST_CLASS_COL + classKeys.length * 2;
  const TOTAL_COL = totalCols; // مجموع النصاب

  ws.pageSetup = {
    paperSize: 9 as never,
    orientation: "landscape" as never,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };

  const set = (row: number, col: number, value: string | number) => {
    const c = ws.getCell(row, col);
    c.value = value;
    return c;
  };

  // العنوان
  ws.mergeCells(1, NO_COL, 1, totalCols);
  const title = set(1, NO_COL, `جدول توزيع المباحث بين المعلمين${info.academicYear ? ` اعتباراً من ${info.academicYear}` : ""}`);
  title.font = { name: "Arial", bold: true, size: 20 };
  title.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(1).height = 30;

  // بيانات المدرسة
  const third = Math.max(4, Math.floor(totalCols / 3));
  ws.mergeCells(3, NO_COL, 3, third);
  set(3, NO_COL, `مديرية التربية والتعليم ${info.directorateName || ""}`.trim());
  ws.mergeCells(3, third + 1, 3, third * 2);
  set(3, third + 1, `مدرسة ${info.schoolName || ""}`.trim());
  ws.mergeCells(3, third * 2 + 1, 3, totalCols);
  set(3, third * 2 + 1, `المدينة / القرية : ${info.cityName || ""}`.trim());
  ws.getRow(3).eachCell(c => {
    c.font = { name: "Arial", bold: true, size: 13 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(3).height = 24;

  // رؤوس الأعمدة
  const HEAD1 = 5;
  const HEAD2 = 6;
  ws.mergeCells(HEAD1, NO_COL, HEAD2, NO_COL);
  ws.mergeCells(HEAD1, NAME_COL, HEAD2, NAME_COL);
  ws.mergeCells(HEAD1, TOTAL_COL, HEAD2, TOTAL_COL);
  const noCell = set(HEAD1, NO_COL, "الرقم");
  const nameCell = set(HEAD1, NAME_COL, "اسم المعلم / المعلمة");
  const totalCell = set(HEAD1, TOTAL_COL, "مجموع النصاب");
  [noCell, nameCell, totalCell].forEach(c => {
    c.font = { name: "Arial", bold: true, size: 13 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = medium;
  });

  classKeys.forEach((key, i) => {
    const col = FIRST_CLASS_COL + i * 2;
    ws.mergeCells(HEAD1, col, HEAD1, col + 1);
    const head = set(HEAD1, col, classLabel(key));
    head.font = { name: "Arial", bold: true, size: 13 };
    head.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    head.border = medium;
    const a = set(HEAD2, col, "المبحث");
    const b = set(HEAD2, col + 1, "عدد الحصص");
    [a, b].forEach(c => {
      c.font = { name: "Arial", bold: true, size: 11 };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = thin;
    });
  });
  ws.getRow(HEAD1).height = 28;
  ws.getRow(HEAD2).height = 28;

  // صفوف المعلمين
  const FIRST_ROW = HEAD2 + 1;
  teachers.forEach((teacher, index) => {
    const row = FIRST_ROW + index;
    set(row, NO_COL, index + 1);
    set(row, NAME_COL, teacher.name);
    let total = 0;
    classKeys.forEach((key, classIndex) => {
      const assignments = teacher.subjects.filter(
        subject => getClassKey(subject.className, subject.section) === key
      );
      if (assignments.length === 0) return;
      const col = FIRST_CLASS_COL + classIndex * 2;
      set(row, col, [...new Set(assignments.map(item => item.subjectName))].join(" / "));
      const count = assignments.reduce((sum, item) => sum + (item.periodsPerWeek || 0), 0);
      set(row, col + 1, count);
      total += count;
    });
    set(row, TOTAL_COL, total);
    ws.getRow(row).height = 22;
    for (let col = 1; col <= totalCols; col++) {
      const c = ws.getCell(row, col);
      c.font = { name: "Arial", bold: col === NAME_COL || col === TOTAL_COL, size: 11 };
      c.alignment = { horizontal: col === NAME_COL ? "right" : "center", vertical: "middle", wrapText: true };
      c.border = thin;
    }
  });

  // حدود رؤوس الأعمدة الفارغة
  for (let col = 1; col <= totalCols; col++) {
    ws.getCell(HEAD1, col).border = ws.getCell(HEAD1, col).border || medium;
    ws.getCell(HEAD2, col).border = ws.getCell(HEAD2, col).border || thin;
  }

  // التذييل
  const footerRow = FIRST_ROW + teachers.length + 2;
  ws.mergeCells(footerRow, NO_COL, footerRow, Math.min(totalCols, NAME_COL + 6));
  set(footerRow, NO_COL, `اسم مدير/ة المدرسة وتوقيعه وخاتم المدرسة : ${info.directorName || ""}`.trim());
  ws.getRow(footerRow).eachCell(c => {
    c.font = { name: "Arial", bold: true, size: 12 };
    c.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  });
  ws.getRow(footerRow).height = 24;

  // عروض الأعمدة
  ws.getColumn(NO_COL).width = 5;
  ws.getColumn(NAME_COL).width = 24;
  for (let i = 0; i < classKeys.length; i++) {
    ws.getColumn(FIRST_CLASS_COL + i * 2).width = 14;
    ws.getColumn(FIRST_CLASS_COL + i * 2 + 1).width = 7;
  }
  ws.getColumn(TOTAL_COL).width = 10;
}

export async function exportSubjectsTeachersExcel(
  teachers: Teacher[],
  info: OfficialTimetableInfo,
) {
  if (!teachers || teachers.length === 0) throw new Error("لا يوجد معلمون لتصديرهم");

  const classKeys = [...new Set(
    teachers.flatMap(teacher =>
      (teacher.subjects || []).map(subject => getClassKey(subject.className, subject.section))
    )
  )].sort(compareClassKeys);

  if (classKeys.length === 0) throw new Error("لا توجد مباحث مسندة للمعلمين");

  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(classKeys.length / CLASSES_PER_SHEET)) },
    (_, index) => classKeys.slice(index * CLASSES_PER_SHEET, (index + 1) * CLASSES_PER_SHEET),
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "الإدارة المدرسية";
  workbook.created = new Date();
  chunks.forEach((chunk, index) => buildSheet(workbook, index, teachers, chunk, info));

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `جدول_مباحث_مع_معلمين_${safeName(info.schoolName)}.xlsx`);
}
