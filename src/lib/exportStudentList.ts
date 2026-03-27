import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, ShadingType } from "docx";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import type { StudentInfo } from "@/types/studentAbsence";

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

export async function exportStudentListDocx(
  students: StudentInfo[],
  schoolName: string,
  directorateName: string,
  filterClass?: string,
) {
  const filtered = filterClass ? students.filter(s => s.className === filterClass) : students;
  const logo = await getLogoBuffer();

  // Group by class
  const byClass: Record<string, StudentInfo[]> = {};
  for (const s of filtered) {
    if (!byClass[s.className]) byClass[s.className] = [];
    byClass[s.className].push(s);
  }
  const sortedClasses = Object.keys(byClass).sort();

  const colWidths = [500, 2800, 1600, 1800, 1800];
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const tableChildren: (Paragraph | Table)[] = [];

  for (const cls of sortedClasses) {
    const classStudents = byClass[cls];

    // Class title
    tableChildren.push(new Paragraph({
      children: [t(`الصف: ${cls} (${classStudents.length} طالب/ة)`, { bold: true, size: 26 })],
      bidirectional: true,
      spacing: { before: 200, after: 100 },
    }));

    tableChildren.push(new Table({
      width: { size: totalWidth, type: WidthType.DXA },
      columnWidths: colWidths,
      visuallyRightToLeft: true,
      rows: [
        new TableRow({
          children: ["م", "اسم الطالب", "الصف", "رقم ولي الأمر", "اسم ولي الأمر"].map((h, i) =>
            headerCell(h, colWidths[i])
          ),
        }),
        ...classStudents.map((s, idx) =>
          new TableRow({
            children: [
              dataCell(String(idx + 1), colWidths[0], idx % 2 === 1),
              dataCell(s.name, colWidths[1], idx % 2 === 1),
              dataCell(s.className, colWidths[2], idx % 2 === 1),
              dataCell(s.parentPhone, colWidths[3], idx % 2 === 1),
              dataCell(s.parentName || "-", colWidths[4], idx % 2 === 1),
            ],
          })
        ),
      ],
    }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Paragraph({
          children: [new ImageRun({ data: logo, transformation: { width: 65, height: 65 }, type: "png" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          bidirectional: true,
        }),
        new Paragraph({
          children: [t("وزارة التربية والتعليم", { bold: true, size: 26 })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 40 },
        }),
        ...(directorateName ? [new Paragraph({
          children: [t(directorateName, { bold: true, size: 24 })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 40 },
        })] : []),
        new Paragraph({
          children: [t(schoolName, { bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 60 },
        }),
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F4E79", space: 1 } },
          spacing: { after: 200 },
          children: [],
        }),
        new Paragraph({
          children: [t(`سجل الطلبة (${filtered.length} طالب/ة)`, { bold: true, size: 30 })],
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 200 },
        }),
        ...tableChildren,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `سجل_الطلبة_${filterClass || "الكل"}.docx`);
}

export async function exportStudentListExcel(
  students: StudentInfo[],
  schoolName: string,
  filterClass?: string,
) {
  const filtered = filterClass ? students.filter(s => s.className === filterClass) : students;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("سجل الطلبة");
  ws.views = [{ rightToLeft: true }];

  const headerColor = "1F4E79";
  const altRowColor = "F2F7FB";
  const borderStyle: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF999999" } };
  const borders: Partial<ExcelJS.Borders> = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  ws.mergeCells("A1:E1");
  const titleCell = ws.getCell("A1");
  titleCell.value = schoolName;
  titleCell.font = { name: FONT, size: 16, bold: true, color: { argb: "FF1F4E79" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A2:E2");
  const subCell = ws.getCell("A2");
  subCell.value = filterClass ? `سجل طلبة الصف: ${filterClass}` : `سجل الطلبة (${filtered.length} طالب/ة)`;
  subCell.font = { name: FONT, size: 14, bold: true };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.addRow([]);

  const headers = ["م", "اسم الطالب", "الصف", "رقم ولي الأمر", "اسم ولي الأمر"];
  const hRow = ws.addRow(headers);
  hRow.height = 25;
  hRow.eachCell(c => {
    c.font = { name: FONT, size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${headerColor}` } };
    c.border = borders;
  });

  filtered.sort((a, b) => a.className.localeCompare(b.className)).forEach((s, idx) => {
    const row = ws.addRow([idx + 1, s.name, s.className, s.parentPhone, s.parentName || "-"]);
    row.eachCell(c => {
      c.font = { name: FONT, size: 11 };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = borders;
      if (idx % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${altRowColor.replace("#", "")}` } };
    });
  });

  ws.columns = [{ width: 6 }, { width: 30 }, { width: 16 }, { width: 18 }, { width: 20 }];

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `سجل_الطلبة_${filterClass || "الكل"}.xlsx`);
}
