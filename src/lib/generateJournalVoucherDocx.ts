import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeightRule } from "docx";
import { saveAs } from "file-saver";
import { Transaction, ACCOUNT_COLUMNS } from "@/types/finance";

const splitAmount = (n: number) => {
  const dinars = Math.floor(n);
  const fils = Math.round((n - dinars) * 1000);
  return { dinars: dinars > 0 ? String(dinars) : "", fils: fils > 0 ? String(fils) : "" };
};

const getAccountDetails = (tx: Transaction) => {
  const debits: { label: string; amount: number }[] = [];
  const credits: { label: string; amount: number }[] = [];
  ACCOUNT_COLUMNS.forEach((col) => {
    if (tx.amounts[col.id]?.debit > 0) debits.push({ label: col.label, amount: tx.amounts[col.id].debit });
    if (tx.amounts[col.id]?.credit > 0) credits.push({ label: col.label, amount: tx.amounts[col.id].credit });
  });
  return { debits, credits };
};

const getTotals = (tx: Transaction) => {
  let debit = 0, credit = 0;
  ACCOUNT_COLUMNS.forEach((col) => {
    debit += tx.amounts[col.id]?.debit || 0;
    credit += tx.amounts[col.id]?.credit || 0;
  });
  return { debit, credit };
};

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1 },
  bottom: { style: BorderStyle.SINGLE, size: 1 },
  left: { style: BorderStyle.SINGLE, size: 1 },
  right: { style: BorderStyle.SINGLE, size: 1 },
};

const makeCell = (text: string, opts?: { bold?: boolean; width?: number; colSpan?: number; alignment?: typeof AlignmentType[keyof typeof AlignmentType]; shading?: string }) =>
  new TableCell({
    children: [new Paragraph({
      alignment: opts?.alignment || AlignmentType.CENTER,
      bidirectional: true,
      children: [new TextRun({ text, bold: opts?.bold, font: "Traditional Arabic", size: 24, rightToLeft: true })],
    })],
    borders: cellBorders,
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: opts?.colSpan,
    shading: opts?.shading ? { fill: opts.shading } : undefined,
  });

export async function generateJournalVoucherDocx(tx: Transaction, schoolName: string) {
  const PAGE_BORDER = {
    pageBorderTop: { style: BorderStyle.SINGLE, size: 6, color: "2B3A55", space: 24 },
    pageBorderBottom: { style: BorderStyle.SINGLE, size: 6, color: "2B3A55", space: 24 },
    pageBorderLeft: { style: BorderStyle.SINGLE, size: 6, color: "2B3A55", space: 24 },
    pageBorderRight: { style: BorderStyle.SINGLE, size: 6, color: "2B3A55", space: 24 },
  };

  const accounts = getAccountDetails(tx);
  const totals = getTotals(tx);
  const debitSplit = splitAmount(totals.debit);
  const creditSplit = splitAmount(totals.credit);

  const descriptionLines: TextRun[] = [
    new TextRun({ text: tx.description, font: "Traditional Arabic", size: 24, rightToLeft: true }),
    new TextRun({ text: "", break: 1 }),
  ];
  accounts.debits.forEach(d => {
    descriptionLines.push(new TextRun({ text: `من حساب/ ${d.label}`, font: "Traditional Arabic", size: 24, rightToLeft: true }));
    descriptionLines.push(new TextRun({ text: "", break: 1 }));
  });
  accounts.credits.forEach(c => {
    descriptionLines.push(new TextRun({ text: `إلى حساب/ ${c.label}`, font: "Traditional Arabic", size: 24, rightToLeft: true }));
    descriptionLines.push(new TextRun({ text: "", break: 1 }));
  });
  descriptionLines.push(new TextRun({ text: `وذلك: ${tx.description}`, font: "Traditional Arabic", size: 24, rightToLeft: true }));

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 }, borders: PAGE_BORDER } },
      children: [
        // Title
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 200 }, children: [
          new TextRun({ text: "سند قيد", bold: true, font: "Traditional Arabic", size: 36, rightToLeft: true }),
        ]}),
        // المادة
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 100 }, children: [
          new TextRun({ text: "المادة (          )", font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        // الرقم والمركز
        new Paragraph({ bidirectional: true, spacing: { after: 100 }, children: [
          new TextRun({ text: `الرقم: (${tx.referenceNumber || "      "})`, bold: true, font: "Traditional Arabic", size: 24, rightToLeft: true }),
          new TextRun({ text: `                    المركز: ${schoolName}`, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        // التاريخ والمدرسة
        new Paragraph({ bidirectional: true, spacing: { after: 200 }, children: [
          new TextRun({ text: `التاريخ: ${tx.date}`, bold: true, font: "Traditional Arabic", size: 24, rightToLeft: true }),
          new TextRun({ text: `                    المدرسة: ${schoolName}`, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        // Table header row 1
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          visuallyRightToLeft: true,
          rows: [
            new TableRow({ children: [
              makeCell("البيـــــــــــــــــــــان", { bold: true, width: 50, shading: "f0f0f0", alignment: AlignmentType.RIGHT }),
              makeCell("منه", { bold: true, colSpan: 2, shading: "f0f0f0" }),
              makeCell("له", { bold: true, colSpan: 2, shading: "f0f0f0" }),
            ]}),
            new TableRow({ children: [
              makeCell("", { shading: "f5f5f5" }),
              makeCell("دينار", { bold: true, shading: "f5f5f5" }),
              makeCell("فلس", { bold: true, shading: "f5f5f5" }),
              makeCell("دينار", { bold: true, shading: "f5f5f5" }),
              makeCell("فلس", { bold: true, shading: "f5f5f5" }),
            ]}),
            // Data row
            new TableRow({
              height: { value: 2000, rule: HeightRule.ATLEAST },
              children: [
                new TableCell({
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true, children: descriptionLines })],
                  borders: cellBorders, width: { size: 50, type: WidthType.PERCENTAGE },
                }),
                makeCell(debitSplit.dinars),
                makeCell(debitSplit.fils),
                makeCell(creditSplit.dinars),
                makeCell(creditSplit.fils),
              ],
            }),
          ],
        }),
        // Signature
        new Paragraph({ spacing: { before: 600 }, bidirectional: true, children: [
          new TextRun({ text: "مدير المدرسة:", bold: true, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        new Paragraph({ bidirectional: true, children: [
          new TextRun({ text: `الاسم: ......................................`, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        new Paragraph({ bidirectional: true, children: [
          new TextRun({ text: "التوقيع: ......................................", font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `سند_قيد_${tx.referenceNumber || tx.id}.docx`);
}
