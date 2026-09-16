import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Teacher } from "@/types/timetable";
import { ACTIVITY_SUBJECT, compareClassKeys, getClassKey, parseClassKey } from "@/types/timetable";
import { addEmblem, type OfficialTimetableInfo } from "@/lib/exportOfficialTimetable";

/**
 * جدول توزيع المباحث بين المعلمين — النموذج الرسمي للمديرية.
 * - المعلمات مرتبات بحيث يكون معلمو المبحث الواحد تحت بعضهم.
 * - حصص النشاط تُدوّن في الملاحظات وتُحسب ضمن مجموع النصاب.
 * - صفوف فارغة في نهاية الجدول لإضافة الإداريات يدوياً.
 */

const FONT = "Arial";
const EMPTY_ROWS = 15;

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

/** المبحث الرئيسي للمعلم (الأكثر حصصاً) لاستخدامه في الترتيب والتجميع */
function mainSubject(teacher: Teacher) {
  const totals = new Map<string, number>();
  for (const s of teacher.subjects || []) {
    if (s.subjectName === ACTIVITY_SUBJECT) continue;
    totals.set(s.subjectName, (totals.get(s.subjectName) || 0) + (s.periodsPerWeek || 0));
  }
  let best = "";
  let bestCount = -1;
  for (const [name, count] of totals) {
    if (count > bestCount) { best = name; bestCount = count; }
  }
  return best;
}

export async function exportOfficialSubjectsTeachersExcel(
  teachers: Teacher[],
  info: OfficialTimetableInfo,
) {
  if (!teachers || teachers.length === 0) throw new Error("لا يوجد معلمون لتصديرهم");

  const classKeys = [...new Set(
    teachers.flatMap(t => (t.subjects || [])
      .filter(s => s.subjectName !== ACTIVITY_SUBJECT)
      .map(s => getClassKey(s.className, s.section)))
  )].sort(compareClassKeys);

  // ترتيب المعلمات: كل مبحث تحت بعضه، وداخل المبحث ترتيب أبجدي
  const order: string[] = [];
  for (const t of teachers) {
    const subj = mainSubject(t);
    if (!order.includes(subj)) order.push(subj);
  }
  const sorted = [...teachers].sort((a, b) => {
    const sa = mainSubject(a), sb = mainSubject(b);
    if (sa !== sb) return order.indexOf(sa) - order.indexOf(sb);
    return a.name.localeCompare(b.name, "ar");
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "الإدارة المدرسية";
  wb.created = new Date();
  const ws = wb.addWorksheet("جدول المباحث", { views: [{ rightToLeft: true, showGridLines: false }] });

  const NO = 1, NAME = 2, EXP = 3, CERT = 4, SPEC = 5, SRC = 6, GRAD = 7, COURSES = 8;
  const FIRST_CLASS = 9;
  const TOTAL = FIRST_CLASS + classKeys.length * 2;
  const NOTES = TOTAL + 1;

  ws.pageSetup = {
    paperSize: 8 as never, // A3
    orientation: "landscape" as never,
    fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
  };

  const set = (row: number, col: number, value: string | number) => {
    const c = ws.getCell(row, col);
    c.value = value;
    return c;
  };

  // الشعار أعلى الوسط كما في النموذج المعتمد
  const emblemCol = Math.min(27, Math.max(1, NOTES - 6));
  addEmblem(wb, ws, emblemCol, 0, 190);

  // العنوان (الصف 5) واسم الوزارة يمين الشعار
  ws.mergeCells(5, NO, 5, Math.min(8, NOTES));
  const title = set(5, NO, `جدول توزيع المباحث بين المعلمين اعتباراً من ${info.academicYear || "    /    / 202  م"}`);
  title.font = { name: FONT, bold: true, size: 12 };
  title.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  const minS = Math.min(25, NOTES), minE = Math.min(32, NOTES);
  ws.mergeCells(5, minS, 5, minE);
  const ministry = set(5, minS, "وزارة التربية والتعليم ");
  ministry.font = { name: FONT, bold: true, size: 14 };
  ministry.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(5).height = 34;

  // ترويسة المدرسة (الصف 6)
  const third = Math.max(6, Math.floor(NOTES / 3));
  ws.mergeCells(6, NO, 6, Math.min(5, third));
  set(6, NO, `مديرية التربية والتعليم : ${info.directorateName || ""}`.trim());
  ws.mergeCells(6, third + 1, 6, third * 2);
  set(6, third + 1, `مدرسة : ${info.schoolName || ""}`.trim());
  ws.mergeCells(6, third * 2 + 1, 6, NOTES);
  set(6, third * 2 + 1, `المدينة / القرية : ${info.cityName || ""}`.trim());
  ws.getRow(6).eachCell(c => {
    c.font = { name: FONT, bold: true, size: 11 };
    c.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  });
  ws.getRow(6).height = 22;

  // رؤوس الأعمدة (4 مستويات: 8..11)
  const H1 = 8, H2 = 9, H3 = 10, H4 = 11;

  const spanAll = (col: number, text: string) => {
    ws.mergeCells(H1, col, H4, col);
    const c = set(H1, col, text);
    c.font = { name: FONT, bold: true, size: 11 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true, textRotation: 0 };
    return c;
  };
  spanAll(NO, "الرقم");
  spanAll(NAME, "اسم المعلم الكامل");
  spanAll(EXP, "عدد سنوات الخبرة");
  spanAll(TOTAL, "مجموع الحصص");
  spanAll(NOTES, "ملاحظــــات");

  ws.mergeCells(H1, CERT, H2, GRAD);
  const qual = set(H1, CERT, "المؤهل العلمي");
  qual.font = { name: FONT, bold: true, size: 11 };
  qual.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  ws.mergeCells(H1, COURSES, H1, TOTAL - 1);
  const dist = set(H1, COURSES, "توزيع حصص المباحث في كل صف وشعبة");
  dist.font = { name: FONT, bold: true, size: 12 };
  dist.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const rowsLabel = set(H2, COURSES, "الصفوف");
  rowsLabel.font = { name: FONT, bold: true, size: 11 };
  rowsLabel.alignment = { horizontal: "center", vertical: "middle" };

  const sub = (col: number, text: string) => {
    ws.mergeCells(H3, col, H4, col);
    const c = set(H3, col, text);
    c.font = { name: FONT, bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  };
  sub(CERT, "الشهادة");
  sub(SPEC, "التخصص");
  sub(SRC, "المصدر");
  sub(GRAD, "سنة التخرج");
  sub(COURSES, "الدورات الرئيسية التي حضرها المعلم");

  classKeys.forEach((key, i) => {
    const col = FIRST_CLASS + i * 2;
    ws.mergeCells(H2, col, H2, col + 1);
    const head = set(H2, col, classLabel(key));
    head.font = { name: FONT, bold: true, size: 10 };
    head.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sub(col, "المبحث");
    sub(col + 1, "عدد الحصص");
  });

  for (let r = H1; r <= H4; r++) {
    ws.getRow(r).height = r === H1 ? 22 : r === H2 ? 20 : 18;
    for (let col = 1; col <= NOTES; col++) {
      ws.getCell(r, col).border = medium;
    }
  }

  // صفوف المعلمات
  const FIRST_ROW = H4 + 1;
  let index = 0;
  for (const teacher of sorted) {
    const row = FIRST_ROW + index;
    index++;
    set(row, NO, index);
    set(row, NAME, teacher.name);

    let total = 0;
    classKeys.forEach((key, ci) => {
      const assignments = (teacher.subjects || []).filter(
        s => s.subjectName !== ACTIVITY_SUBJECT && getClassKey(s.className, s.section) === key
      );
      if (assignments.length === 0) return;
      const col = FIRST_CLASS + ci * 2;
      set(row, col, [...new Set(assignments.map(a => a.subjectName))].join(" / "));
      const count = assignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
      set(row, col + 1, count);
      total += count;
    });

    // حصص النشاط: في الملاحظات وتُحسب مع النصاب
    const activity = (teacher.subjects || [])
      .filter(s => s.subjectName === ACTIVITY_SUBJECT)
      .reduce((sum, s) => sum + (s.periodsPerWeek || 0), 0);
    if (activity > 0) {
      total += activity;
      set(row, NOTES, `نشاط : ${activity} حصة (محتسبة ضمن النصاب)`);
    }

    set(row, TOTAL, total);
  }

  // صفوف فارغة للإداريات (لا يقل مجموع الصفوف عن 55 كما في النموذج)
  const totalRows = Math.max(index + EMPTY_ROWS, 55);
  for (let i = index; i < totalRows; i++) {
    set(FIRST_ROW + i, NO, i + 1);
  }

  const lastRow = FIRST_ROW + totalRows - 1;
  for (let r = FIRST_ROW; r <= lastRow; r++) {
    ws.getRow(r).height = 20;
    for (let col = 1; col <= NOTES; col++) {
      const c = ws.getCell(r, col);
      c.font = { name: FONT, bold: col === TOTAL, size: col === NAME ? 9 : 10 };
      c.alignment = {
        horizontal: col === NAME || col === NOTES ? "right" : "center",
        vertical: "middle", wrapText: true,
      };
      c.border = thin;
    }
  }

  // صف المجموع العام: مجموع حصص كل شعبة + المجموع العام لحصص المدرسة
  const SUM_ROW = lastRow + 1;
  ws.getRow(SUM_ROW).height = 22;
  ws.mergeCells(SUM_ROW, NO, SUM_ROW, COURSES);
  const sumLabel = set(SUM_ROW, NO, "       المجموع العام للحصص كل شعبة والمجموع العام لحصص المدرسة ");
  sumLabel.font = { name: FONT, bold: true, size: 11 };
  sumLabel.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  const letter = (col: number) => ws.getColumn(col).letter;
  for (let i = 0; i < classKeys.length; i++) {
    const col = FIRST_CLASS + i * 2 + 1;
    const c = ws.getCell(SUM_ROW, col);
    c.value = { formula: `SUM(${letter(col)}${FIRST_ROW}:${letter(col)}${lastRow})` } as never;
  }
  const grand = ws.getCell(SUM_ROW, TOTAL);
  grand.value = { formula: `SUM(${letter(TOTAL)}${FIRST_ROW}:${letter(TOTAL)}${lastRow})` } as never;
  for (let col = 1; col <= NOTES; col++) {
    const c = ws.getCell(SUM_ROW, col);
    c.font = { name: FONT, bold: true, size: col === NO ? 11 : 10 };
    if (col > COURSES) c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = medium;
  }

  // الملاحظات والتذييل كما في النموذج المعتمد (4 كتل في نفس الصفوف)
  const fr = SUM_ROW + 1;

  const pos = (f: number) => Math.min(NOTES, Math.max(1, Math.round(NOTES * f)));
  const n1 = pos(0.276);
  const s1 = pos(0.328), s1e = pos(0.5);
  const s2 = pos(0.569), s2e = pos(0.741);
  const s3 = pos(0.776), s3e = Math.max(pos(0.776) + 1, NOTES - 1);

  const noteLines = [
    " يدون اسم المدير أولاً، كما تدون أسماء جميع الهيئة التدريسية ولو لم يكن لهم حصص مقررة، ثم ترتب أسماء معلمي المباحث بتسلسل يطابق ترتيب المباحث في جداول العلامات",
    " يبين في حقل الملاحظات : أ- عدد الحصص الزائدة عن النصاب ويجري تدريسها على حساب التعليم الإضافي مع بيان المبحث والصف والشعبة. ب- نشاطاته الأخرى (غير التدريس) بما في ذلك النشاطات الحرة",
    " يشار في حقل الملاحظات للمعلم المشترك والمدرسة التي يكمل نصابه فيها وعدد تلك الحصص",
  ];
  noteLines.forEach((text, i) => {
    const r = fr + i;
    ws.mergeCells(r, NO, r, n1);
    const c = set(r, NO, text);
    c.font = { name: FONT, size: 10 };
    c.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
    ws.getRow(r).height = 18;
  });

  const block = (row: number, startCol: number, endCol: number, text: string) => {
    ws.mergeCells(row, startCol, row, endCol);
    const c = set(row, startCol, text);
    c.font = { name: FONT, bold: true, size: 10 };
    c.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  };
  block(fr, s1, s1e, "جرى تدقيقه في : 1- قسم الإشراف التربوي     2- التعليم العام");
  block(fr + 1, s1, s1e, "اسم المدقق وتوقيعه : ..................    ");
  block(fr + 2, s1, s1e, "التاريخ       /      /   202م");
  block(fr, s2, s2e, "توقيع مدير التربية والتعليم  ................................");
  block(fr + 2, s2, s2e, "التاريخ       /      /   202م");
  block(fr, s3, s3e, `اسم مدير/ة المدرسة وتوقيعه وخاتم المدرسة : ${info.directorName || "..................................."}`);
  block(fr + 2, s3, s3e, "التاريخ       /      /   202م");

  // عروض الأعمدة
  const many = classKeys.length;
  const subjW = many > 30 ? 8 : many > 22 ? 9 : many > 16 ? 11 : 13;
  const countW = many > 22 ? 5 : 6;
  ws.getColumn(NO).width = 4;
  ws.getColumn(NAME).width = 20;
  ws.getColumn(EXP).width = 7;
  ws.getColumn(CERT).width = 13;
  ws.getColumn(SPEC).width = 11;
  ws.getColumn(SRC).width = 9;
  ws.getColumn(GRAD).width = 7;
  ws.getColumn(COURSES).width = 14;
  for (let i = 0; i < classKeys.length; i++) {
    ws.getColumn(FIRST_CLASS + i * 2).width = subjW;
    ws.getColumn(FIRST_CLASS + i * 2 + 1).width = countW;
  }
  ws.getColumn(TOTAL).width = 8;
  ws.getColumn(NOTES).width = 20;


  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `جدول_توزيع_المباحث_الرسمي_${safeName(info.schoolName)}.xlsx`);
}
