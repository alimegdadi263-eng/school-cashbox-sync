import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import type { TeacherAbsenceRecord } from "@/types/teacherAbsence";

const FONT = "Traditional Arabic";

let logoBuffer: ArrayBuffer | null = null;
async function getLogoBuffer(): Promise<ArrayBuffer> {
  if (logoBuffer) return logoBuffer;
  const resp = await fetch(`${import.meta.env.BASE_URL}images/moe-logo.png`);
  logoBuffer = await resp.arrayBuffer();
  return logoBuffer;
}

function t(text: string, opts?: { bold?: boolean; size?: number }): TextRun {
  return new TextRun({ text, font: FONT, size: opts?.size || 24, bold: opts?.bold, rightToLeft: true });
}

function cellBorders() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
  return { top: b, bottom: b, left: b, right: b };
}

export async function exportAbsenceReportDocx(records: TeacherAbsenceRecord[], teacherName: string, schoolName: string) {
  const filtered = teacherName ? records.filter(r => r.teacherName === teacherName) : records;
  const logo = await getLogoBuffer();

  const headerRows = [
    new TableRow({
      children: ["م", "اسم المعلم", "التاريخ", "اليوم", "نوع الغياب", "ملاحظات"].map((h, i) => 
        new TableCell({
          borders: cellBorders(),
          width: { size: [600, 2200, 1600, 1200, 1200, 2200][i], type: WidthType.DXA },
          shading: { fill: "D5E8F0", type: "clear" as any },
          children: [new Paragraph({ children: [t(h, { bold: true, size: 22 })], alignment: AlignmentType.CENTER, bidirectional: true })],
        })
      ),
    }),
  ];

  const dataRows = filtered.map((rec, idx) =>
    new TableRow({
      children: [
        String(idx + 1),
        rec.teacherName,
        rec.date,
        rec.dayName,
        rec.absenceType,
        rec.notes || "",
      ].map((val, i) =>
        new TableCell({
          borders: cellBorders(),
          width: { size: [600, 2200, 1600, 1200, 1200, 2200][i], type: WidthType.DXA },
          children: [new Paragraph({ children: [t(val, { size: 22 })], alignment: AlignmentType.CENTER, bidirectional: true })],
        })
      ),
    })
  );

  // Summary
  const summary: Record<string, { عرضية: number; مرضية: number; "عدم صرف": number; "غير ذلك": number; total: number }> = {};
  for (const rec of filtered) {
    if (!summary[rec.teacherName]) summary[rec.teacherName] = { عرضية: 0, مرضية: 0, "عدم صرف": 0, "غير ذلك": 0, total: 0 };
    if ((summary[rec.teacherName] as any)[rec.absenceType] !== undefined) (summary[rec.teacherName] as any)[rec.absenceType]++;
    summary[rec.teacherName].total++;
  }

  const summaryRows = Object.entries(summary).map(([name, counts], idx) =>
    new TableRow({
      children: [String(idx + 1), name, String(counts.عرضية), String(counts.مرضية), String(counts["عدم صرف"]), String(counts["غير ذلك"]), String(counts.total)].map((val, i) =>
        new TableCell({
          borders: cellBorders(),
          width: { size: [500, 2200, 1000, 1000, 1000, 1000, 1000][i], type: WidthType.DXA },
          children: [new Paragraph({ children: [t(val, { size: 22 })], alignment: AlignmentType.CENTER, bidirectional: true })],
        })
      ),
    })
  );

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Paragraph({ children: [new ImageRun({ data: logo, transformation: { width: 70, height: 70 }, type: "png" })], alignment: AlignmentType.CENTER, spacing: { after: 40 }, bidirectional: true }),
        new Paragraph({ children: [t(schoolName, { bold: true, size: 32 })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 100 } }),
        new Paragraph({ children: [t(teacherName ? `كشف غياب المعلم: ${teacherName}` : "كشف غياب المعلمين", { bold: true, size: 28 })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 200 } }),
        new Table({ width: { size: 9000, type: WidthType.DXA }, columnWidths: [600, 2200, 1600, 1200, 1200, 2200], rows: [...headerRows, ...dataRows] }),
        new Paragraph({ children: [], spacing: { before: 300 } }),
        new Paragraph({ children: [t("ملخص الغيابات", { bold: true, size: 26 })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 100 } }),
        new Table({
          width: { size: 7700, type: WidthType.DXA }, columnWidths: [500, 2200, 1000, 1000, 1000, 1000, 1000],
          rows: [
            new TableRow({
              children: ["م", "اسم المعلم", "عرضية", "مرضية", "عدم صرف", "غير ذلك", "المجموع"].map((h, i) =>
                new TableCell({
                  borders: cellBorders(),
                  width: { size: [500, 2200, 1000, 1000, 1000, 1000, 1000][i], type: WidthType.DXA },
                  shading: { fill: "E8D5F0", type: "clear" as any },
                  children: [new Paragraph({ children: [t(h, { bold: true, size: 22 })], alignment: AlignmentType.CENTER, bidirectional: true })],
                })
              ),
            }),
            ...summaryRows,
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `كشف_غياب_${teacherName || "الكل"}.docx`);
}

export async function exportAbsenceReportExcel(records: TeacherAbsenceRecord[], teacherName: string, schoolName: string) {
  const filtered = teacherName ? records.filter(r => r.teacherName === teacherName) : records;
  const wb = new ExcelJS.Workbook();
  
  // Detail sheet
  const ws = wb.addWorksheet("كشف الغياب");
  ws.views = [{ rightToLeft: true }];

  ws.mergeCells("A1:F1");
  const titleCell = ws.getCell("A1");
  titleCell.value = schoolName;
  titleCell.font = { name: FONT, size: 16, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A2:F2");
  const subCell = ws.getCell("A2");
  subCell.value = teacherName ? `كشف غياب المعلم: ${teacherName}` : "كشف غياب المعلمين";
  subCell.font = { name: FONT, size: 14, bold: true };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  const headers = ["م", "اسم المعلم", "التاريخ", "اليوم", "نوع الغياب", "ملاحظات"];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell(c => {
    c.font = { name: FONT, size: 12, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5E8F0" } };
    c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  filtered.forEach((rec, idx) => {
    const row = ws.addRow([idx + 1, rec.teacherName, rec.date, rec.dayName, rec.absenceType, rec.notes || ""]);
    row.eachCell(c => {
      c.font = { name: FONT, size: 11 };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
  });

  ws.columns = [{ width: 6 }, { width: 25 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 25 }];

  // Summary sheet
  const ws2 = wb.addWorksheet("ملخص");
  ws2.views = [{ rightToLeft: true }];

  const summary: Record<string, { عرضية: number; مرضية: number; "عدم صرف": number; "غير ذلك": number; total: number }> = {};
  for (const rec of filtered) {
    if (!summary[rec.teacherName]) summary[rec.teacherName] = { عرضية: 0, مرضية: 0, "عدم صرف": 0, "غير ذلك": 0, total: 0 };
    if ((summary[rec.teacherName] as any)[rec.absenceType] !== undefined) (summary[rec.teacherName] as any)[rec.absenceType]++;
    summary[rec.teacherName].total++;
  }

  const sHeaders = ["م", "اسم المعلم", "عرضية", "مرضية", "عدم صرف", "غير ذلك", "المجموع"];
  const sHeaderRow = ws2.addRow(sHeaders);
  sHeaderRow.eachCell(c => {
    c.font = { name: FONT, size: 12, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8D5F0" } };
    c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  Object.entries(summary).forEach(([name, counts], idx) => {
    const row = ws2.addRow([idx + 1, name, counts.عرضية, counts.مرضية, counts["عدم صرف"], counts["غير ذلك"], counts.total]);
    row.eachCell(c => {
      c.font = { name: FONT, size: 11 };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
  });

  ws2.columns = [{ width: 6 }, { width: 25 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }];

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `كشف_غياب_${teacherName || "الكل"}.xlsx`);
}
