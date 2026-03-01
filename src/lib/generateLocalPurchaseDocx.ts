import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeadingLevel,
  TableLayoutType,
} from "docx";
import { saveAs } from "file-saver";
import type { PurchaseItem } from "@/lib/fillFinancialForms";

export interface LocalPurchaseDocxData {
  school: string;
  supplierName: string;
  supplierAddress: string;
  items: PurchaseItem[];
}

const FONT = "Traditional Arabic";
const FONT_SIZE = 24; // 12pt * 2

function textRun(text: string, opts?: { bold?: boolean; size?: number }): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size ?? FONT_SIZE,
    bold: opts?.bold ?? false,
    rightToLeft: true,
  });
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [textRun(text, { bold: true, size: 20 })],
        alignment: AlignmentType.CENTER,
        bidirectional: true,
      }),
    ],
    shading: { fill: "D9E2F3" },
    verticalAlign: "center",
  });
}

function dataCell(text: string, center = true): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [textRun(text, { size: 20 })],
        alignment: center ? AlignmentType.CENTER : AlignmentType.RIGHT,
        bidirectional: true,
      }),
    ],
    verticalAlign: "center",
  });
}

export async function generateLocalPurchaseDocx(data: LocalPurchaseDocxData) {
  // Calculate grand totals
  let grandDinars = 0;
  let grandFils = 0;
  data.items.forEach((item) => {
    grandDinars += parseInt(item.totalPriceDinars) || 0;
    grandFils += parseInt(item.totalPriceFils) || 0;
  });
  grandDinars += Math.floor(grandFils / 1000);
  grandFils = grandFils % 1000;

  // Table header row
  const headerRow = new TableRow({
    children: [
      headerCell("رقم"),
      headerCell("المادة"),
      headerCell("الكمية المطلوبة"),
      headerCell("السعر الفردي\nدينار"),
      headerCell("السعر الفردي\nفلس"),
      headerCell("الإجمالي\nدينار"),
      headerCell("الإجمالي\nفلس"),
      headerCell("ملاحظات"),
    ],
    tableHeader: true,
  });

  // Data rows
  const dataRows = data.items.map(
    (item, idx) =>
      new TableRow({
        children: [
          dataCell(String(idx + 1)),
          dataCell(item.itemDescription, false),
          dataCell(item.quantity),
          dataCell(item.unitPriceDinars),
          dataCell(item.unitPriceFils),
          dataCell(item.totalPriceDinars),
          dataCell(item.totalPriceFils),
          dataCell(item.notes, false),
        ],
      })
  );

  // Totals row
  const totalsRow = new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [textRun("المجمـــــوع", { bold: true, size: 20 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
          }),
        ],
        columnSpan: 5,
        shading: { fill: "E2EFDA" },
        verticalAlign: "center",
      }),
      dataCell(grandDinars > 0 ? String(grandDinars) : ""),
      dataCell(grandFils > 0 ? String(grandFils) : ""),
      dataCell(""),
    ],
  });

  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "000000",
  };

  const table = new Table({
    rows: [headerRow, ...dataRows, totalsRow],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: tableBorder,
      bottom: tableBorder,
      left: tableBorder,
      right: tableBorder,
      insideHorizontal: tableBorder,
      insideVertical: tableBorder,
    },
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          // Title
          new Paragraph({
            children: [textRun("طلب مشترى محلي", { bold: true, size: 36 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 200 },
            heading: HeadingLevel.HEADING_1,
          }),

          // School name
          new Paragraph({
            children: [textRun(data.school, { bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 300 },
          }),

          // Supplier info
          new Paragraph({
            children: [
              textRun("إلى ", { size: FONT_SIZE }),
              textRun(data.supplierName, { bold: true, size: FONT_SIZE }),
              textRun(" وعنوانه: ", { size: FONT_SIZE }),
              textRun(data.supplierAddress, { bold: true, size: FONT_SIZE }),
            ],
            bidirectional: true,
            spacing: { after: 100 },
          }),

          new Paragraph({
            children: [textRun("تسليم المواد المدرجة أدناه", { size: FONT_SIZE })],
            bidirectional: true,
            spacing: { after: 200 },
          }),

          // Items table
          table,

          // Total summary line
          new Paragraph({
            children: [
              textRun("المجمـــــــــــموع: ", { bold: true }),
              textRun(grandDinars > 0 ? String(grandDinars) : "0"),
              textRun(" دينار  "),
              textRun(grandFils > 0 ? String(grandFils) : "0"),
              textRun(" فلس"),
            ],
            bidirectional: true,
            spacing: { before: 300, after: 400 },
          }),

          // Signature section
          new Paragraph({
            children: [textRun("التاريخ: ....................................")],
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [textRun("الاسم: ..................................")],
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [textRun("التوقيع: ..................................")],
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [textRun("الوظيفة: ..................................")],
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [textRun("المركز: ..................................")],
            bidirectional: true,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `طلب_مشترى_محلي_${data.supplierName || "جديد"}.docx`);
}
