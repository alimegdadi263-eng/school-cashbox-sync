import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, ShadingType } from "docx";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import type { StudentAbsenceRecord } from "@/types/studentAbsence";

const FONT = "Traditional Arabic";

let logoBuffer: ArrayBuffer | null = null;
async function getLogoBuffer(): Promise<ArrayBuffer> {
  if (logoBuffer) return logoBuffer;
  const resp = await fetch(`${import.meta.env.BASE_URL}images/moe-logo.png`);
  logoBuffer = await resp.arrayBuffer();
  return logoBuffer;
}

function t(text: string, opts?: { bold?: boolean; size?: number; color?: string }): TextRun {
  return new TextRun({ text, font: FONT, size: opts?.size || 24, bold: opts?.bold, rightToLeft: true, color: opts?.color });
}

function cellBorders() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  return { top: b, bottom: b, left: b, right: b };
}

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: cellBorders(),
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "1F4E79", type: ShadingType.CLEAR },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [new Paragraph({ children: [t(text, { bold: true, size: 22, color: "FFFFFF" })], alignment: AlignmentType.CENTER, bidirectional: true })],
  });
}

function dataCell(text: string, width: number, shade?: boolean): TableCell {
  return new TableCell({
    borders: cellBorders(),
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { fill: "F2F7FB", type: ShadingType.CLEAR } : undefined,
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    children: [new Paragraph({ children: [t(text, { size: 22 })], alignment: AlignmentType.CENTER, bidirectional: true })],
  });
}

// ── Word Export ──
export async function exportStudentAbsenceDocx(
  records: StudentAbsenceRecord[],
  schoolName: string,
  directorateName: string,
  principalName: string,
  filterClass?: string,
  filterStudent?: string,
) {
  let filtered = records;
  if (filterClass) filtered = filtered.filter(r => r.className === filterClass);
  if (filterStudent) filtered = filtered.filter(r => r.studentName === filterStudent);
  filtered = filtered.sort((a, b) => b.date.localeCompare(a.date));

  const logo = await getLogoBuffer();
  const colWidths = [500, 2400, 1400, 1200, 1200, 1600, 1700];
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  // Summary
  const summaryMap: Record<string, { name: string; className: string; count: number; phone: string }> = {};
  for (const r of filtered) {
    if (!summaryMap[r.studentId]) summaryMap[r.studentId] = { name: r.studentName, className: r.className, count: 0, phone: r.parentPhone };
    summaryMap[r.studentId].count++;
  }
  const summaryList = Object.values(summaryMap).sort((a, b) => b.count - a.count);

  const sumColWidths = [500, 2400, 1600, 1200, 1600, 1400];
  const sumTotalWidth = sumColWidths.reduce((a, b) => a + b, 0);

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: [
        // Logo
        new Paragraph({
          children: [new ImageRun({ data: logo, transformation: { width: 65, height: 65 }, type: "png" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          bidirectional: true,
        }),
        // Ministry
        new Paragraph({
          children: [t("وزارة التربية والتعليم", { bold: true, size: 26 })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 40 },
        }),
        // Directorate
        ...(directorateName ? [new Paragraph({
          children: [t(directorateName, { bold: true, size: 24 })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 40 },
        })] : []),
        // School
        new Paragraph({
          children: [t(schoolName, { bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 60 },
        }),
        // Line
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F4E79", space: 1 } },
          spacing: { after: 200 },
          children: [],
        }),
        // Title
        new Paragraph({
          children: [t(
            filterStudent ? `تقرير غياب الطالب: ${filterStudent}` :
            filterClass ? `تقرير غياب طلبة الصف: ${filterClass}` :
            "تقرير غياب الطلبة",
            { bold: true, size: 30 },
          )],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 200 },
        }),

        // ── Summary Table ──
        new Paragraph({
          children: [t("أولاً: ملخص الغيابات", { bold: true, size: 26 })],
          bidirectional: true,
          spacing: { after: 100 },
        }),
        new Table({
          width: { size: sumTotalWidth, type: WidthType.DXA },
          columnWidths: sumColWidths,
          visuallyRightToLeft: true,
          rows: [
            new TableRow({
              children: ["م", "اسم الطالب", "الصف", "عدد أيام الغياب", "رقم ولي الأمر", "الحالة"].map((h, i) =>
                headerCell(h, sumColWidths[i])
              ),
            }),
            ...summaryList.map((s, idx) =>
              new TableRow({
                children: [
                  dataCell(String(idx + 1), sumColWidths[0], idx % 2 === 1),
                  dataCell(s.name, sumColWidths[1], idx % 2 === 1),
                  dataCell(s.className, sumColWidths[2], idx % 2 === 1),
                  dataCell(String(s.count), sumColWidths[3], idx % 2 === 1),
                  dataCell(s.phone, sumColWidths[4], idx % 2 === 1),
                  dataCell(s.count >= 10 ? "⚠️ إنذار" : s.count >= 5 ? "متابعة" : "عادي", sumColWidths[5], idx % 2 === 1),
                ],
              })
            ),
          ],
        }),

        new Paragraph({ children: [], spacing: { before: 300 } }),

        // ── Detail Table ──
        new Paragraph({
          children: [t("ثانياً: التفاصيل اليومية", { bold: true, size: 26 })],
          bidirectional: true,
          spacing: { after: 100 },
        }),
        new Table({
          width: { size: totalWidth, type: WidthType.DXA },
          columnWidths: colWidths,
          visuallyRightToLeft: true,
          rows: [
            new TableRow({
              children: ["م", "اسم الطالب", "الصف", "التاريخ", "اليوم", "رقم ولي الأمر", "ملاحظات"].map((h, i) =>
                headerCell(h, colWidths[i])
              ),
            }),
            ...filtered.map((rec, idx) =>
              new TableRow({
                children: [
                  dataCell(String(idx + 1), colWidths[0], idx % 2 === 1),
                  dataCell(rec.studentName, colWidths[1], idx % 2 === 1),
                  dataCell(rec.className, colWidths[2], idx % 2 === 1),
                  dataCell(rec.date, colWidths[3], idx % 2 === 1),
                  dataCell(rec.dayName, colWidths[4], idx % 2 === 1),
                  dataCell(rec.parentPhone, colWidths[5], idx % 2 === 1),
                  dataCell(rec.notes || "", colWidths[6], idx % 2 === 1),
                ],
              })
            ),
          ],
        }),

        new Paragraph({ children: [], spacing: { before: 400 } }),

        // Signatures
        new Paragraph({
          children: [
            t("مدير/ة المدرسة: ", { bold: true, size: 22 }),
            t(principalName || "_______________", { size: 22 }),
            t("          التوقيع: _______________", { size: 22 }),
          ],
          bidirectional: true,
          alignment: AlignmentType.LEFT,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `تقرير_غياب_طلبة_${filterClass || filterStudent || "الكل"}.docx`);
}

// ── Excel Export ──
export async function exportStudentAbsenceExcel(
  records: StudentAbsenceRecord[],
  schoolName: string,
  directorateName: string,
  filterClass?: string,
  filterStudent?: string,
) {
  let filtered = records;
  if (filterClass) filtered = filtered.filter(r => r.className === filterClass);
  if (filterStudent) filtered = filtered.filter(r => r.studentName === filterStudent);
  filtered = filtered.sort((a, b) => b.date.localeCompare(a.date));

  const wb = new ExcelJS.Workbook();

  // ── Detail Sheet ──
  const ws = wb.addWorksheet("تقرير الغياب");
  ws.views = [{ rightToLeft: true }];

  const headerColor = "1F4E79";
  const altRowColor = "F2F7FB";
  const borderStyle: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF999999" } };
  const borders: Partial<ExcelJS.Borders> = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  // Title rows
  ws.mergeCells("A1:G1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${schoolName}`;
  titleCell.font = { name: FONT, size: 16, bold: true, color: { argb: "FF1F4E79" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A2:G2");
  const subCell = ws.getCell("A2");
  subCell.value = filterStudent ? `تقرير غياب الطالب: ${filterStudent}` :
    filterClass ? `تقرير غياب طلبة الصف: ${filterClass}` : "تقرير غياب الطلبة";
  subCell.font = { name: FONT, size: 14, bold: true };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.addRow([]);

  const headers = ["م", "اسم الطالب", "الصف", "التاريخ", "اليوم", "رقم ولي الأمر", "ملاحظات"];
  const hRow = ws.addRow(headers);
  hRow.height = 25;
  hRow.eachCell(c => {
    c.font = { name: FONT, size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${headerColor}` } };
    c.border = borders;
  });

  filtered.forEach((rec, idx) => {
    const row = ws.addRow([idx + 1, rec.studentName, rec.className, rec.date, rec.dayName, rec.parentPhone, rec.notes || ""]);
    row.eachCell(c => {
      c.font = { name: FONT, size: 11 };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = borders;
      if (idx % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${altRowColor.replace("#", "")}` } };
    });
  });

  ws.columns = [{ width: 6 }, { width: 28 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 20 }];

  // ── Summary Sheet ──
  const ws2 = wb.addWorksheet("ملخص الغيابات");
  ws2.views = [{ rightToLeft: true }];

  const summaryMap: Record<string, { name: string; className: string; count: number; phone: string }> = {};
  for (const r of filtered) {
    if (!summaryMap[r.studentId]) summaryMap[r.studentId] = { name: r.studentName, className: r.className, count: 0, phone: r.parentPhone };
    summaryMap[r.studentId].count++;
  }
  const summaryList = Object.values(summaryMap).sort((a, b) => b.count - a.count);

  ws2.mergeCells("A1:F1");
  const sTitle = ws2.getCell("A1");
  sTitle.value = "ملخص غيابات الطلبة";
  sTitle.font = { name: FONT, size: 16, bold: true, color: { argb: "FF1F4E79" } };
  sTitle.alignment = { horizontal: "center", vertical: "middle" };
  ws2.addRow([]);

  const sHeaders = ["م", "اسم الطالب", "الصف", "عدد أيام الغياب", "رقم ولي الأمر", "الحالة"];
  const shRow = ws2.addRow(sHeaders);
  shRow.height = 25;
  shRow.eachCell(c => {
    c.font = { name: FONT, size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${headerColor}` } };
    c.border = borders;
  });

  summaryList.forEach((s, idx) => {
    const status = s.count >= 10 ? "⚠️ إنذار" : s.count >= 5 ? "متابعة" : "عادي";
    const row = ws2.addRow([idx + 1, s.name, s.className, s.count, s.phone, status]);
    row.eachCell((c, colNum) => {
      c.font = { name: FONT, size: 11 };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = borders;
      if (idx % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${altRowColor.replace("#", "")}` } };
      // Red highlight for warning
      if (colNum === 6 && s.count >= 10) {
        c.font = { name: FONT, size: 11, bold: true, color: { argb: "FFCC0000" } };
      }
    });
  });

  ws2.columns = [{ width: 6 }, { width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }];

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `تقرير_غياب_طلبة_${filterClass || filterStudent || "الكل"}.xlsx`);
}
