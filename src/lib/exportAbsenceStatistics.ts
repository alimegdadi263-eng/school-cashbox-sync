import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } from "docx";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

interface ClassRow {
  className: string;
  total: number;
  absent: number;
  present: number;
  percentage: string;
  absentNames: string[];
}

interface StudentRow {
  id: string;
  name: string;
  className: string;
  isAbsent: boolean;
  absenceDays: number;
}

interface PerStudentRow {
  id: string;
  name: string;
  className: string;
  totalAbsence: number;
  percentage: string;
  status: string;
}

interface ExportData {
  classBreakdown: ClassRow[];
  studentDetail: StudentRow[];
  totalStudents: number;
  absentCount: number;
  presentCount: number;
  absentPercentage: string;
  presentPercentage: string;
  dateLabel: string;
  levelLabel: string;
  schoolName: string;
  directorateName: string;
  principalName?: string;
  viewLevel: string;
  perStudentAbsence?: PerStudentRow[];
  totalSchoolDays?: number;
}

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function makeCell(text: string, opts?: { bold?: boolean; shading?: string; width?: number; color?: string }) {
  return new TableCell({
    borders,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts?.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      children: [new TextRun({ text, bold: opts?.bold, font: "Arial", size: 20, rightToLeft: true, color: opts?.color })],
    })],
  });
}

function makeHeaderRow(headers: string[]) {
  return new TableRow({
    children: headers.map(h => new TableCell({
      borders,
      shading: { fill: "1F4E79", type: ShadingType.CLEAR },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER, bidirectional: true,
        children: [new TextRun({ text: h, bold: true, font: "Arial", size: 20, rightToLeft: true, color: "FFFFFF" })],
      })],
    })),
  });
}

function makeDocHeader(data: ExportData): Paragraph[] {
  const children: Paragraph[] = [];
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 100 },
    children: [new TextRun({ text: "وزارة التربية والتعليم", bold: true, font: "Arial", size: 28, rightToLeft: true })] }));
  if (data.directorateName) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 100 },
      children: [new TextRun({ text: `مديرية التربية والتعليم / ${data.directorateName}`, font: "Arial", size: 24, rightToLeft: true })] }));
  }
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 200 },
    children: [new TextRun({ text: `مدرسة ${data.schoolName}`, bold: true, font: "Arial", size: 26, rightToLeft: true })] }));
  return children;
}

export async function exportAbsenceStatisticsDocx(data: ExportData) {
  const children: any[] = [];

  children.push(...makeDocHeader(data));

  const title = data.viewLevel === "per-student" ? "تقرير إحصائية غياب الطلبة الفردية" : "تقرير إحصائية الغياب";
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 200 },
    children: [new TextRun({ text: title, bold: true, font: "Arial", size: 30, rightToLeft: true, underline: {} })] }));

  if (data.viewLevel === "per-student") {
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true, spacing: { after: 80 },
      children: [new TextRun({ text: `أيام الدراسة منذ بداية العام: ${data.totalSchoolDays || 0} يوم`, font: "Arial", size: 22, rightToLeft: true, bold: true })] }));
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true, spacing: { after: 200 },
      children: [new TextRun({ text: `إجمالي الطلبة: ${data.totalStudents}`, font: "Arial", size: 22, rightToLeft: true })] }));

    if (data.perStudentAbsence && data.perStudentAbsence.length > 0) {
      const hRow = makeHeaderRow(["م", "اسم الطالب", "الصف/الشعبة", "أيام الغياب", "نسبة الغياب", "الحالة"]);
      const dataRows = data.perStudentAbsence.map((s, i) =>
        new TableRow({
          children: [
            makeCell(String(i + 1)),
            makeCell(s.name, { bold: true }),
            makeCell(s.className),
            makeCell(String(s.totalAbsence), { bold: true, shading: s.totalAbsence >= 10 ? "FFE0E0" : undefined }),
            makeCell(`${s.percentage}%`),
            makeCell(s.status, {
              bold: true,
              shading: s.status === "خطر" ? "FF9999" : s.status === "إنذار" ? "FFD699" : s.status === "متابعة" ? "FFFFCC" : "D6FFD6",
            }),
          ],
        })
      );
      const table = new Table({ width: { size: 9500, type: WidthType.DXA }, rows: [hRow, ...dataRows] });
      children.push(new Paragraph({ spacing: { before: 200 } }));
      children.push(table);
    }
  } else {
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true, spacing: { after: 80 },
      children: [new TextRun({ text: `التاريخ: ${data.dateLabel}`, font: "Arial", size: 22, rightToLeft: true })] }));
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true, spacing: { after: 80 },
      children: [new TextRun({ text: `المستوى: ${data.levelLabel}`, font: "Arial", size: 22, rightToLeft: true })] }));
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true, spacing: { after: 200 },
      children: [new TextRun({
        text: `إجمالي الطلبة: ${data.totalStudents}  |  الحضور: ${data.presentCount} (${data.presentPercentage}%)  |  الغياب: ${data.absentCount} (${data.absentPercentage}%)`,
        font: "Arial", size: 22, rightToLeft: true, bold: true,
      })] }));

    if (data.viewLevel !== "section" && data.classBreakdown.length > 0) {
      const hRow = makeHeaderRow(["م", "الصف/الشعبة", "العدد الكلي", "الحضور", "الغياب", "نسبة الغياب", "أسماء الغائبين"]);
      const dataRows = data.classBreakdown.map((row, i) =>
        new TableRow({
          children: [
            makeCell(String(i + 1)),
            makeCell(row.className, { bold: true }),
            makeCell(String(row.total)),
            makeCell(String(row.present)),
            makeCell(String(row.absent), { shading: row.absent > 0 ? "FFE0E0" : undefined }),
            makeCell(`${row.percentage}%`),
            makeCell(row.absentNames.join("، ") || "-"),
          ],
        })
      );
      const totalRow = new TableRow({
        children: [
          makeCell("", { shading: "E8E8E8" }), makeCell("المجموع", { bold: true, shading: "E8E8E8" }),
          makeCell(String(data.totalStudents), { bold: true, shading: "E8E8E8" }),
          makeCell(String(data.presentCount), { bold: true, shading: "E8E8E8" }),
          makeCell(String(data.absentCount), { bold: true, shading: "E8E8E8" }),
          makeCell(`${data.absentPercentage}%`, { bold: true, shading: "E8E8E8" }),
          makeCell("", { shading: "E8E8E8" }),
        ],
      });
      const table = new Table({ width: { size: 9500, type: WidthType.DXA }, rows: [hRow, ...dataRows, totalRow] });
      children.push(new Paragraph({ spacing: { before: 200 } }));
      children.push(table);
    }

    if (data.viewLevel === "section" && data.studentDetail.length > 0) {
      const hRow = makeHeaderRow(["م", "اسم الطالب", "الحالة"]);
      const rows = data.studentDetail.map((s, i) =>
        new TableRow({
          children: [
            makeCell(String(i + 1)),
            makeCell(s.name, { bold: true }),
            makeCell(s.isAbsent ? "غائب" : "حاضر", { shading: s.isAbsent ? "FFE0E0" : "E0FFE0" }),
          ],
        })
      );
      const table = new Table({ width: { size: 7000, type: WidthType.DXA }, rows: [hRow, ...rows] });
      children.push(new Paragraph({ spacing: { before: 200 } }));
      children.push(table);
    }
  }

  if (data.principalName) {
    children.push(new Paragraph({ spacing: { before: 600 } }));
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true,
      children: [new TextRun({ text: `مدير/ة المدرسة: ${data.principalName}`, font: "Arial", size: 22, rightToLeft: true })] }));
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true,
      children: [new TextRun({ text: "التوقيع: _______________", font: "Arial", size: 22, rightToLeft: true })] }));
  }

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `إحصائية_الغياب_${data.dateLabel.replace(/\//g, "-")}.docx`);
}

export async function exportAbsenceStatisticsExcel(data: ExportData) {
  const wb = new ExcelJS.Workbook();
  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: "visible" }];

  const ws = wb.addWorksheet("إحصائية الغياب", { views: [{ rightToLeft: true }] });

  ws.mergeCells("A1:G1");
  const h1 = ws.getCell("A1");
  h1.value = `إحصائية غياب الطلبة - ${data.schoolName}`;
  h1.font = { bold: true, size: 16, name: "Arial" };
  h1.alignment = { horizontal: "center" };

  if (data.viewLevel === "per-student") {
    ws.mergeCells("A2:G2");
    const h2 = ws.getCell("A2");
    h2.value = `أيام الدراسة: ${data.totalSchoolDays || 0}  |  إجمالي الطلبة: ${data.totalStudents}`;
    h2.font = { size: 11, name: "Arial" };
    h2.alignment = { horizontal: "center" };

    ws.addRow([]);
    const headers = ["م", "اسم الطالب", "الصف/الشعبة", "أيام الغياب", "نسبة الغياب %", "الحالة"];
    const hr = ws.addRow(headers);
    hr.eachCell(c => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 11 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    (data.perStudentAbsence || []).forEach((s, i) => {
      const r = ws.addRow([i + 1, s.name, s.className, s.totalAbsence, `${s.percentage}%`, s.status]);
      r.eachCell(c => {
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        c.font = { name: "Arial", size: 11 };
      });
      const statusColors: Record<string, string> = {
        "خطر": "FFFF9999", "إنذار": "FFFFD699", "متابعة": "FFFFFFCC", "عادي": "FFD6FFD6"
      };
      r.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColors[s.status] || "FFD6FFD6" } };
      if (s.totalAbsence >= 10) {
        r.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0E0" } };
      }
    });

    ws.columns = [{ width: 6 }, { width: 25 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 12 }];
  } else {
    ws.mergeCells("A2:G2");
    const h2 = ws.getCell("A2");
    h2.value = `التاريخ: ${data.dateLabel}  |  المستوى: ${data.levelLabel}  |  الطلبة: ${data.totalStudents}  |  حضور: ${data.presentCount} (${data.presentPercentage}%)  |  غياب: ${data.absentCount} (${data.absentPercentage}%)`;
    h2.font = { size: 11, name: "Arial" };
    h2.alignment = { horizontal: "center" };

    if (data.viewLevel !== "section" && data.classBreakdown.length > 0) {
      const headers = ["م", "الصف/الشعبة", "العدد الكلي", "الحضور", "الغياب", "نسبة الغياب %", "أسماء الغائبين"];
      ws.addRow([]);
      const hr = ws.addRow(headers);
      hr.eachCell(c => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 11 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });

      data.classBreakdown.forEach((row, i) => {
        const r = ws.addRow([i + 1, row.className, row.total, row.present, row.absent, `${row.percentage}%`, row.absentNames.join("، ") || "-"]);
        r.eachCell(c => {
          c.alignment = { horizontal: "center", vertical: "middle" };
          c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          c.font = { name: "Arial", size: 11 };
        });
        if (row.absent > 0) r.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0E0" } };
      });

      const tr = ws.addRow(["", "المجموع", data.totalStudents, data.presentCount, data.absentCount, `${data.absentPercentage}%`, ""]);
      tr.eachCell(c => {
        c.font = { bold: true, name: "Arial", size: 11 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
        c.alignment = { horizontal: "center" };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });

      ws.columns = [{ width: 6 }, { width: 18 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 40 }];
    }

    if (data.viewLevel === "section" && data.studentDetail.length > 0) {
      ws.addRow([]);
      const hr = ws.addRow(["م", "اسم الطالب", "الحالة"]);
      hr.eachCell(c => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 11 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
        c.alignment = { horizontal: "center" };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });

      data.studentDetail.forEach((s, i) => {
        const r = ws.addRow([i + 1, s.name, s.isAbsent ? "غائب" : "حاضر"]);
        r.eachCell(c => {
          c.alignment = { horizontal: "center" };
          c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          c.font = { name: "Arial", size: 11 };
        });
        r.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.isAbsent ? "FFFFE0E0" : "FFE0FFE0" } };
      });

      ws.columns = [{ width: 6 }, { width: 30 }, { width: 14 }];
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `إحصائية_الغياب_${data.dateLabel.replace(/\//g, "-")}.xlsx`);
}
