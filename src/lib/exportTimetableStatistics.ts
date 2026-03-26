import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ClassTimetable, Teacher } from "@/types/timetable";
import { DAYS, parseClassKey } from "@/types/timetable";

const FONT = "Traditional Arabic";

const border: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, bottom: { style: "thin" },
  left: { style: "thin" }, right: { style: "thin" },
};

function hdr(cell: ExcelJS.Cell) {
  cell.font = { name: FONT, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = border;
}

function dat(cell: ExcelJS.Cell, bold = false) {
  cell.font = { name: FONT, size: 11, bold };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = border;
}

function subHdr(cell: ExcelJS.Cell) {
  cell.font = { name: FONT, bold: true, size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = border;
}

interface TeacherStat {
  name: string;
  totalPeriods: number;
  sixthCount: number;
  seventhCount: number;
  dailyCounts: number[];
}

function getTeacherStats(teachers: Teacher[], timetable: ClassTimetable, periodsPerDay: number): TeacherStat[] {
  return teachers.map(t => {
    const schedule: { day: number; period: number }[] = [];
    for (const [, days] of Object.entries(timetable)) {
      days.forEach((periods, dayIdx) => {
        periods.forEach((cell, periodIdx) => {
          if (cell && cell.teacherId === t.id) {
            schedule.push({ day: dayIdx, period: periodIdx });
          }
        });
      });
    }
    return {
      name: t.name,
      totalPeriods: schedule.length,
      sixthCount: schedule.filter(s => s.period === periodsPerDay - 2).length,
      seventhCount: schedule.filter(s => s.period === periodsPerDay - 1).length,
      dailyCounts: DAYS.map((_, di) => schedule.filter(s => s.day === di).length),
    };
  });
}

/** تصدير إحصائيات الصفوف */
export async function exportClassStatisticsExcel(
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("إحصائيات الصفوف");
  ws.views = [{ rightToLeft: true }];

  // Title
  const allSubjects = new Set<string>();
  const classStats: { key: string; className: string; section: string; subjects: Record<string, number>; total: number }[] = [];
  for (const [classKey, days] of Object.entries(timetable)) {
    const { className, section } = parseClassKey(classKey);
    const subjects: Record<string, number> = {};
    let total = 0;
    days.forEach(periods => {
      periods.forEach(cell => {
        if (cell) {
          subjects[cell.subjectName] = (subjects[cell.subjectName] || 0) + 1;
          allSubjects.add(cell.subjectName);
          total++;
        }
      });
    });
    classStats.push({ key: classKey, className, section, subjects, total });
  }

  const subjectList = Array.from(allSubjects).sort();
  const colCount = subjectList.length + 2; // class + subjects + total

  const titleRow = ws.addRow([`${schoolName} - إحصائيات الصفوف والمواد`]);
  ws.mergeCells(1, 1, 1, colCount);
  titleRow.getCell(1).font = { name: FONT, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  titleRow.height = 35;
  ws.addRow([]);

  // Headers
  const headers = ["الصف/الشعبة", ...subjectList, "المجموع"];
  const headerRow = ws.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell(c => hdr(c));

  // Data
  for (const cs of classStats) {
    const rowData = [`${cs.className}/${cs.section}`, ...subjectList.map(s => cs.subjects[s] || "-"), cs.total];
    const row = ws.addRow(rowData);
    row.eachCell((c, i) => dat(c, i === rowData.length));
  }

  // Totals
  const totalsData = ["المجموع", ...subjectList.map(s => classStats.reduce((sum, cs) => sum + (cs.subjects[s] || 0), 0)), classStats.reduce((sum, cs) => sum + cs.total, 0)];
  const totRow = ws.addRow(totalsData);
  totRow.eachCell(c => subHdr(c));

  // Column widths
  ws.getColumn(1).width = 18;
  subjectList.forEach((_, i) => { ws.getColumn(i + 2).width = 14; });
  ws.getColumn(colCount).width = 12;

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `إحصائيات_الصفوف_${schoolName}.xlsx`);
}

/** تصدير كشف أنصبة المعلمين مع السادسات والسابعات */
export async function exportTeacherStatsExcel(
  teachers: Teacher[],
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("أنصبة المعلمين");
  ws.views = [{ rightToLeft: true }];

  const stats = getTeacherStats(teachers, timetable, periodsPerDay);
  const colCount = 4 + DAYS.length; // name + total + 6th + 7th + days

  const titleRow = ws.addRow([`${schoolName} - كشف أنصبة المعلمين والسادسات والسابعات`]);
  ws.mergeCells(1, 1, 1, colCount);
  titleRow.getCell(1).font = { name: FONT, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  titleRow.height = 35;
  ws.addRow([]);

  // Headers
  const headers = ["المعلم", "إجمالي الحصص", "السادسات", "السابعات", ...DAYS];
  const headerRow = ws.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell(c => hdr(c));

  // Data
  for (const ts of stats) {
    const rowData = [ts.name, ts.totalPeriods, ts.sixthCount, ts.seventhCount, ...ts.dailyCounts];
    const row = ws.addRow(rowData);
    row.eachCell((c, i) => {
      dat(c, i === 2);
      // Highlight least day
      const minDay = Math.min(...ts.dailyCounts);
      if (i > 4 && ts.dailyCounts[i - 5] === minDay) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
      }
    });
  }

  // Column widths
  ws.getColumn(1).width = 25;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 12;
  DAYS.forEach((_, i) => { ws.getColumn(5 + i).width = 12; });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `أنصبة_المعلمين_${schoolName}.xlsx`);
}

/** تصدير جدول الأشغال اليومية */
export async function exportDailyWorkloadExcel(
  teachers: Teacher[],
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("أشغال يومية");
  ws.views = [{ rightToLeft: true }];

  const titleRow = ws.addRow([`${schoolName} - جدول الأشغال اليومية (المعلم الأقل حصصاً)`]);
  ws.mergeCells(1, 1, 1, 3);
  titleRow.getCell(1).font = { name: FONT, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  titleRow.height = 35;
  ws.addRow([]);

  const headerRow = ws.addRow(["اليوم", "المعلم", "عدد الحصص"]);
  headerRow.height = 28;
  headerRow.eachCell(c => hdr(c));

  for (let dayIdx = 0; dayIdx < DAYS.length; dayIdx++) {
    const teacherDayCounts = teachers.map(t => {
      let count = 0;
      for (const [, days] of Object.entries(timetable)) {
        const periods = days[dayIdx];
        if (periods) {
          for (const cell of periods) {
            if (cell && cell.teacherId === t.id) count++;
          }
        }
      }
      return { name: t.name, count };
    }).filter(x => x.count > 0).sort((a, b) => a.count - b.count);

    const top3 = teacherDayCounts.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
      const row = ws.addRow([i === 0 ? DAYS[dayIdx] : "", top3[i].name, top3[i].count]);
      row.eachCell((c, ci) => {
        dat(c, i === 0 && ci === 1);
        if (i === 0) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
        }
      });
    }
    if (top3.length > 1) {
      const startR = ws.rowCount - top3.length + 1;
      ws.mergeCells(startR, 1, ws.rowCount, 1);
    }
  }

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 14;

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `أشغال_يومية_${schoolName}.xlsx`);
}

/** تصدير جميع التقارير الإحصائية في ملف واحد */
export async function exportAllStatisticsExcel(
  teachers: Teacher[],
  timetable: ClassTimetable,
  periodsPerDay: number,
  schoolName: string
) {
  const wb = new ExcelJS.Workbook();

  // ---- Sheet 1: إحصائيات الصفوف ----
  const ws1 = wb.addWorksheet("إحصائيات الصفوف");
  ws1.views = [{ rightToLeft: true }];

  const allSubjects = new Set<string>();
  const classStats: { className: string; section: string; subjects: Record<string, number>; total: number }[] = [];
  for (const [classKey, days] of Object.entries(timetable)) {
    const { className, section } = parseClassKey(classKey);
    const subjects: Record<string, number> = {};
    let total = 0;
    days.forEach(periods => {
      periods.forEach(cell => {
        if (cell) {
          subjects[cell.subjectName] = (subjects[cell.subjectName] || 0) + 1;
          allSubjects.add(cell.subjectName);
          total++;
        }
      });
    });
    classStats.push({ className, section, subjects, total });
  }
  const subjectList = Array.from(allSubjects).sort();
  const colCount1 = subjectList.length + 2;

  const t1 = ws1.addRow([`${schoolName} - إحصائيات الصفوف والمواد`]);
  ws1.mergeCells(1, 1, 1, colCount1);
  t1.getCell(1).font = { name: FONT, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  t1.getCell(1).alignment = { horizontal: "center" };
  t1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  t1.height = 35;
  ws1.addRow([]);

  const h1 = ws1.addRow(["الصف/الشعبة", ...subjectList, "المجموع"]);
  h1.height = 30;
  h1.eachCell(c => hdr(c));

  for (const cs of classStats) {
    const r = ws1.addRow([`${cs.className}/${cs.section}`, ...subjectList.map(s => cs.subjects[s] || "-"), cs.total]);
    r.eachCell(c => dat(c));
  }
  const tot1 = ws1.addRow(["المجموع", ...subjectList.map(s => classStats.reduce((sum, cs) => sum + (cs.subjects[s] || 0), 0)), classStats.reduce((sum, cs) => sum + cs.total, 0)]);
  tot1.eachCell(c => subHdr(c));

  ws1.getColumn(1).width = 18;
  subjectList.forEach((_, i) => { ws1.getColumn(i + 2).width = 14; });
  ws1.getColumn(colCount1).width = 12;

  // ---- Sheet 2: أنصبة المعلمين ----
  const ws2 = wb.addWorksheet("أنصبة المعلمين");
  ws2.views = [{ rightToLeft: true }];

  const stats = getTeacherStats(teachers, timetable, periodsPerDay);

  const t2 = ws2.addRow([`${schoolName} - كشف أنصبة المعلمين`]);
  ws2.mergeCells(1, 1, 1, 4 + DAYS.length);
  t2.getCell(1).font = { name: FONT, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  t2.getCell(1).alignment = { horizontal: "center" };
  t2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  t2.height = 35;
  ws2.addRow([]);

  const h2 = ws2.addRow(["المعلم", "إجمالي الحصص", "السادسات", "السابعات", ...DAYS]);
  h2.height = 30;
  h2.eachCell(c => hdr(c));

  for (const ts of stats) {
    const r = ws2.addRow([ts.name, ts.totalPeriods, ts.sixthCount, ts.seventhCount, ...ts.dailyCounts]);
    r.eachCell((c, i) => {
      dat(c);
      const minDay = Math.min(...ts.dailyCounts);
      if (i > 4 && ts.dailyCounts[i - 5] === minDay) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
      }
    });
  }

  ws2.getColumn(1).width = 25;
  [2, 3, 4].forEach(i => { ws2.getColumn(i).width = 14; });
  DAYS.forEach((_, i) => { ws2.getColumn(5 + i).width = 12; });

  // ---- Sheet 3: أشغال يومية ----
  const ws3 = wb.addWorksheet("أشغال يومية");
  ws3.views = [{ rightToLeft: true }];

  const t3 = ws3.addRow([`${schoolName} - المعلم الأقل حصصاً يومياً`]);
  ws3.mergeCells(1, 1, 1, 3);
  t3.getCell(1).font = { name: FONT, bold: true, size: 16, color: { argb: "FF2B3A55" } };
  t3.getCell(1).alignment = { horizontal: "center" };
  t3.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
  t3.height = 35;
  ws3.addRow([]);

  const h3 = ws3.addRow(["اليوم", "المعلم", "عدد الحصص"]);
  h3.height = 28;
  h3.eachCell(c => hdr(c));

  for (let dayIdx = 0; dayIdx < DAYS.length; dayIdx++) {
    const teacherDayCounts = teachers.map(t => {
      let count = 0;
      for (const [, days] of Object.entries(timetable)) {
        if (days[dayIdx]) {
          for (const cell of days[dayIdx]) {
            if (cell && cell.teacherId === t.id) count++;
          }
        }
      }
      return { name: t.name, count };
    }).filter(x => x.count > 0).sort((a, b) => a.count - b.count);

    const top3 = teacherDayCounts.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
      const r = ws3.addRow([i === 0 ? DAYS[dayIdx] : "", top3[i].name, top3[i].count]);
      r.eachCell((c, ci) => {
        dat(c, i === 0 && ci === 1);
        if (i === 0) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
      });
    }
    if (top3.length > 1) {
      ws3.mergeCells(ws3.rowCount - top3.length + 1, 1, ws3.rowCount, 1);
    }
  }

  ws3.getColumn(1).width = 18;
  ws3.getColumn(2).width = 28;
  ws3.getColumn(3).width = 14;

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `تقارير_إحصائية_${schoolName}.xlsx`);
}
