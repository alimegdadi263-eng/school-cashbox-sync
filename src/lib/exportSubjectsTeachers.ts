import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Teacher } from "@/types/timetable";
import { compareClassKeys, getClassKey, parseClassKey } from "@/types/timetable";
import templateAsset from "@/assets/subjects-teachers-template.xlsx.asset.json";
import emblemAsset from "@/assets/ministry-emblem.png.asset.json";
import type { OfficialTimetableInfo } from "@/lib/exportOfficialTimetable";

const FIRST_CLASS_COL = 9;
const CLASSES_PER_SHEET = 19;
const FIRST_TEACHER_ROW = 16;
const LAST_TEACHER_ROW = 74;

function safeName(value: string) {
  return (value || "المدرسة").replace(/[\\/:*?"<>|]/g, "_");
}

function classLabel(key: string) {
  const { className, section } = parseClassKey(key);
  return `${className} ${section}`.trim();
}

function copyWorksheet(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) {
  target.properties = { ...source.properties };
  target.pageSetup = { ...source.pageSetup };
  target.pageMargins = source.pageMargins ? { ...source.pageMargins } : undefined;
  target.views = source.views.map(view => ({ ...view }));
  target.autoFilter = source.autoFilter;
  for (let col = 1; col <= source.columnCount; col++) {
    target.getColumn(col).width = source.getColumn(col).width;
    target.getColumn(col).hidden = source.getColumn(col).hidden;
  }
  source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = target.getRow(rowNumber);
    targetRow.height = row.height;
    targetRow.hidden = row.hidden;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cell.value;
      targetCell.style = { ...cell.style };
      targetCell.numFmt = cell.numFmt;
    });
  });
  const merges = (source.model as unknown as { merges?: string[] }).merges || [];
  merges.forEach(range => target.mergeCells(range));
}

function resetTeacherArea(ws: ExcelJS.Worksheet) {
  const merges = ((ws.model as unknown as { merges?: string[] }).merges || []).slice();
  merges.forEach(range => {
    const match = range.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
    if (!match) return;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start <= LAST_TEACHER_ROW && end >= FIRST_TEACHER_ROW) ws.unMergeCells(range);
  });
  for (let row = FIRST_TEACHER_ROW; row <= LAST_TEACHER_ROW; row++) {
    for (let col = 1; col <= 48; col++) ws.getCell(row, col).value = null;
    ws.getCell(row, 1).value = row - FIRST_TEACHER_ROW + 1;
  }
}

function populateSheet(
  ws: ExcelJS.Worksheet,
  teachers: Teacher[],
  classKeys: string[],
  info: OfficialTimetableInfo,
  emblemId: number,
) {
  resetTeacherArea(ws);
  ws.name = classKeys.length ? `المباحث ${classLabel(classKeys[0])}`.slice(0, 31) : "جدول المباحث";
  ws.views = [{ rightToLeft: true, showGridLines: false }];

  ws.getCell("B8").value = `جدول توزيع المباحث بين المعلمين اعتباراً من ${info.academicYear || ""}`;
  ws.getCell("B10").value = `مديرية التربية والتعليم ${info.directorateName || ""}`.trim();
  ws.getCell("AB10").value = `مدرسة ${info.schoolName || ""}`.trim();
  ws.getCell("AF10").value = `المدينة / القرية : ${info.cityName || ""}`.trim();
  ws.getCell("AE76").value = `اسم مدير المدرسة وتوقيعه وخاتم المدرسة : ${info.directorName || ""}`.trim();

  for (let index = 0; index < CLASSES_PER_SHEET; index++) {
    const subjectCol = FIRST_CLASS_COL + index * 2;
    const countCol = subjectCol + 1;
    const key = classKeys[index];
    ws.getCell(13, subjectCol).value = key ? classLabel(key) : "";
    ws.getCell(14, subjectCol).value = key ? "المبحث" : "";
    ws.getCell(14, countCol).value = key ? "عدد الحصص" : "";
  }

  teachers.slice(0, LAST_TEACHER_ROW - FIRST_TEACHER_ROW + 1).forEach((teacher, index) => {
    const row = FIRST_TEACHER_ROW + index;
    ws.getCell(row, 1).value = index + 1;
    ws.getCell(row, 2).value = teacher.name;
    let total = 0;
    classKeys.forEach((key, classIndex) => {
      const assignments = teacher.subjects.filter(subject =>
        getClassKey(subject.className, subject.section) === key
      );
      if (assignments.length === 0) return;
      const subjectCol = FIRST_CLASS_COL + classIndex * 2;
      const countCol = subjectCol + 1;
      ws.getCell(row, subjectCol).value = [...new Set(assignments.map(item => item.subjectName))].join(" / ");
      const count = assignments.reduce((sum, item) => sum + item.periodsPerWeek, 0);
      ws.getCell(row, countCol).value = count;
      total += count;
    });
    ws.getCell(row, 47).value = total;
    for (let col = 1; col <= 48; col++) {
      ws.getCell(row, col).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
  });

  ws.addImage(emblemId, { tl: { col: 0.3, row: 1 }, ext: { width: 115, height: 115 } });
}

export async function exportSubjectsTeachersExcel(
  teachers: Teacher[],
  info: OfficialTimetableInfo,
) {
  if (teachers.length === 0) throw new Error("لا يوجد معلمون لتصديرهم");
  const [templateResponse, emblemResponse] = await Promise.all([
    fetch(templateAsset.url),
    fetch(emblemAsset.url),
  ]);
  if (!templateResponse.ok || !emblemResponse.ok) throw new Error("تعذر تحميل نموذج جدول المباحث أو الشعار");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await templateResponse.arrayBuffer());
  const source = workbook.worksheets[0];
  if (!source) throw new Error("نموذج جدول المباحث غير صالح");
  const emblemId = workbook.addImage({ buffer: await emblemResponse.arrayBuffer(), extension: "png" });
  const classKeys = [...new Set(teachers.flatMap(teacher =>
    teacher.subjects.map(subject => getClassKey(subject.className, subject.section))
  ))].sort(compareClassKeys);
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(classKeys.length / CLASSES_PER_SHEET)) },
    (_, index) => classKeys.slice(index * CLASSES_PER_SHEET, (index + 1) * CLASSES_PER_SHEET),
  );

  const sheets = [source];
  for (let index = 1; index < chunks.length; index++) {
    const sheet = workbook.addWorksheet(`المباحث ${index + 1}`);
    copyWorksheet(source, sheet);
    sheets.push(sheet);
  }
  sheets.forEach((sheet, index) => populateSheet(sheet, teachers, chunks[index], info, emblemId));

  workbook.creator = "الإدارة المدرسية";
  workbook.created = new Date();
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `جدول_مباحث_مع_معلمين_${safeName(info.schoolName)}.xlsx`);
}