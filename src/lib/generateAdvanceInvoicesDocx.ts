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
  TableLayoutType,
} from "docx";
import { saveAs } from "file-saver";

export interface AdvanceInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  amountDinars: string;
  amountFils: string;
  notes: string;
}

export interface AdvanceInvoicesDocxData {
  school: string;
  listNumber: string;
  listDate: string;
  invoices: AdvanceInvoice[];
}

const FONT = "Traditional Arabic";
const S = 22; // body size
const M = 24; // medium
const L = 28; // title

function t(text: string, opts?: { bold?: boolean; size?: number }): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size ?? S,
    bold: opts?.bold ?? false,
    rightToLeft: true,
  });
}

function p(children: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER): Paragraph {
  return new Paragraph({ children, alignment: align, bidirectional: true, spacing: { before: 40, after: 40 } });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const margins = { top: 40, bottom: 40, left: 60, right: 60 };

function headerCell(text: string, opts?: { columnSpan?: number; rowSpan?: number; width?: number }): TableCell {
  return new TableCell({
    children: [p([t(text, { bold: true, size: 20 })])],
    shading: { fill: "D9E2F3" },
    verticalAlign: "center",
    columnSpan: opts?.columnSpan,
    rowSpan: opts?.rowSpan,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    borders,
    margins,
  });
}

function dataCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [p([t(text)])],
    verticalAlign: "center",
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders,
    margins,
  });
}

function toHijri(dateStr?: string): string {
  try {
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric", month: "long", year: "numeric",
    }).format(date);
  } catch { return ""; }
}

export async function generateAdvanceInvoicesDocx(data: AdvanceInvoicesDocxData) {
  // Column widths: # | فلس | دينار | رقم الفاتورة | تاريخ الفاتورة | البيان | ملاحظات
  const colWidths = [700, 1000, 1200, 1200, 1400, 2600, 1260];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row 1 (المبلغ spans 2 columns)
  const headerRow1 = new TableRow({
    children: [
      headerCell("الرقم المتسلسل", { rowSpan: 2, width: colWidths[0] }),
      headerCell("المبلغ", { columnSpan: 2, width: colWidths[1] + colWidths[2] }),
      headerCell("رقم الفاتورة", { rowSpan: 2, width: colWidths[3] }),
      headerCell("تاريخ الفاتورة", { rowSpan: 2, width: colWidths[4] }),
      headerCell("البيان", { rowSpan: 2, width: colWidths[5] }),
      headerCell("ملاحظات", { rowSpan: 2, width: colWidths[6] }),
    ],
  });

  // Header row 2 (فلس | دينار)
  const headerRow2 = new TableRow({
    children: [
      headerCell("فلس", { width: colWidths[1] }),
      headerCell("دينار", { width: colWidths[2] }),
    ],
  });

  // Data rows
  const dataRows = data.invoices.map((inv, idx) =>
    new TableRow({
      children: [
        dataCell(String(idx + 1), colWidths[0]),
        dataCell(inv.amountFils, colWidths[1]),
        dataCell(inv.amountDinars, colWidths[2]),
        dataCell(inv.invoiceNumber, colWidths[3]),
        dataCell(inv.invoiceDate, colWidths[4]),
        dataCell(inv.description, colWidths[5]),
        dataCell(inv.notes, colWidths[6]),
      ],
    })
  );

  // Add empty rows to fill the page (at least 20 rows)
  const minRows = 20;
  for (let i = data.invoices.length; i < minRows; i++) {
    dataRows.push(
      new TableRow({
        children: colWidths.map(w => dataCell("", w)),
      })
    );
  }

  // Total row
  let totalDinars = 0;
  let totalFils = 0;
  data.invoices.forEach(inv => {
    totalDinars += parseInt(inv.amountDinars) || 0;
    totalFils += parseInt(inv.amountFils) || 0;
  });
  totalDinars += Math.floor(totalFils / 1000);
  totalFils = totalFils % 1000;

  const totalRow = new TableRow({
    children: [
      new TableCell({
        children: [p([t("المجموع", { bold: true, size: 20 })])],
        shading: { fill: "D9E2F3" },
        borders, margins, verticalAlign: "center",
        width: { size: colWidths[0], type: WidthType.DXA },
      }),
      dataCell(totalFils > 0 ? String(totalFils) : "", colWidths[1]),
      dataCell(totalDinars > 0 ? String(totalDinars) : "", colWidths[2]),
      new TableCell({
        children: [p([t("")])],
        columnSpan: 4,
        borders, margins, verticalAlign: "center",
        width: { size: colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], type: WidthType.DXA },
      }),
    ],
  });

  const hijriDate = toHijri(data.listDate);

  const table = new Table({
    rows: [headerRow1, headerRow2, ...dataRows, totalRow],
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
    visuallyRightToLeft: true,
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
        bidi: true,
      },
      children: [
        p([t(`كشف فواتير السلفة المدرسية رقم ( ${data.listNumber} ) تاريخ ${data.listDate}`, { bold: true, size: L })]),
        hijriDate ? p([t(`الموافق: ${hijriDate}`, { size: S })]) : new Paragraph({ children: [] }),
        p([t(data.school, { bold: true, size: M })]),
        new Paragraph({ spacing: { before: 100 }, children: [] }),
        table,
        new Paragraph({ spacing: { before: 200 }, children: [] }),
        p([t("يرجى منح كل فاتورة من فواتير السلفة رقماً متسلسلاً غير المثبت أصلاً على الفاتورة", { bold: true, size: 20 })]),
        p([t("يرجى تسجيل الفواتير على هذا الكشف أولاً بأول لتحافظ على ترتيبها التاريخي", { bold: true, size: 20 })]),
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `كشف_فواتير_السلفة_${data.listNumber || "جديد"}.docx`);
}
