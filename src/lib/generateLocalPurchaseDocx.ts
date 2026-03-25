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
const FONT_SIZE = 24;

function textRun(text: string, opts?: { bold?: boolean; size?: number }): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size ?? FONT_SIZE,
    bold: opts?.bold ?? false,
    rightToLeft: true,
  });
}

function headerCell(text: string, opts?: { columnSpan?: number; rowSpan?: number }): TableCell {
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
    columnSpan: opts?.columnSpan,
    rowSpan: opts?.rowSpan,
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
  let grandDinars = 0;
  let grandFils = 0;
  data.items.forEach((item) => {
    grandDinars += parseInt(item.totalPriceDinars) || 0;
    grandFils += parseInt(item.totalPriceFils) || 0;
  });
  grandDinars += Math.floor(grandFils / 1000);
  grandFils = grandFils % 1000;

  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "000000",
  };

  // RTL column order (right to left):
  // رقم | المادة | الكمية | السعر الإفرادي (دينار|فلس) | السعر الإجمالي (دينار|فلس) | الفصل والمادة | ملاحظات
  // Two header rows: first row has merged cells for price groups, second row has دينار/فلس

  const headerRow1 = new TableRow({
    children: [
      headerCell("رقم", { rowSpan: 2 }),
      headerCell("المادة", { rowSpan: 2 }),
      headerCell("الكمية", { rowSpan: 2 }),
      headerCell("السعر الإفرادي", { columnSpan: 2 }),
      headerCell("السعر الإجمالي", { columnSpan: 2 }),
      headerCell("الفصل والمادة", { rowSpan: 2 }),
      headerCell("ملاحظات", { rowSpan: 2 }),
    ],
    tableHeader: true,
  });

  const headerRow2 = new TableRow({
    children: [
      headerCell("دينار"),
      headerCell("فلس"),
      headerCell("دينار"),
      headerCell("فلس"),
    ],
    tableHeader: true,
  });

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
          dataCell(item.chapterAndSubject || "", false),
          dataCell(item.notes, false),
        ],
      })
  );

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
      dataCell(""),
    ],
  });

  const table = new Table({
    rows: [headerRow1, headerRow2, ...dataRows, totalsRow],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    visuallyRightToLeft: true,
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
          new Paragraph({
            children: [textRun("طلب مشترى محلي", { bold: true, size: 36 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 200 },
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [textRun(data.school, { bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              textRun("إلى ", { size: FONT_SIZE }),
              textRun(data.supplierName, { bold: true, size: FONT_SIZE }),
              textRun(" وعنوانه: ", { size: FONT_SIZE }),
              textRun(data.supplierAddress, { bold: true, size: FONT_SIZE }),
            ],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              textRun("تسليم المواد المدرجة أدناه لـ ", { size: FONT_SIZE }),
              textRun(data.school, { bold: true, size: FONT_SIZE }),
            ],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 200 },
          }),
          table,
          new Paragraph({
            children: [
              textRun("المجمـــــــــــموع: ", { bold: true }),
              textRun(grandDinars > 0 ? String(grandDinars) : "0"),
              textRun(" دينار  "),
              textRun(grandFils > 0 ? String(grandFils) : "0"),
              textRun(" فلس"),
            ],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { before: 300, after: 400 },
          }),
          new Paragraph({
            children: [textRun("التاريخ: ....................................")],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [textRun("الاسم: ..................................")],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [textRun("التوقيع: ..................................")],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [textRun("الوظيفة: ..................................")],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [textRun("المركز: ..................................")],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `طلب_مشترى_محلي_${data.supplierName || "جديد"}.docx`);
}
