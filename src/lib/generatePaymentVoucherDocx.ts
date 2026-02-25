import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeightRule } from "docx";
import { saveAs } from "file-saver";
import { Transaction, ACCOUNT_COLUMNS } from "@/types/finance";

const splitAmount = (n: number) => {
  const dinars = Math.floor(n);
  const fils = Math.round((n - dinars) * 1000);
  return { dinars: dinars > 0 ? String(dinars) : "", fils: fils > 0 ? String(fils) : "" };
};

const getAccountDetails = (tx: Transaction) => {
  const credits: { label: string; amount: number }[] = [];
  ACCOUNT_COLUMNS.forEach((col) => {
    if (tx.amounts[col.id]?.credit > 0) credits.push({ label: col.label, amount: tx.amounts[col.id].credit });
  });
  return credits;
};

const getTotalCredit = (tx: Transaction) => {
  let credit = 0;
  ACCOUNT_COLUMNS.forEach((col) => { credit += tx.amounts[col.id]?.credit || 0; });
  return credit;
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

export async function generatePaymentVoucherDocx(tx: Transaction, schoolName: string) {
  const credits = getAccountDetails(tx);
  const totalCredit = getTotalCredit(tx);
  const totalSplit = splitAmount(totalCredit);

  const detailRows = credits.map(c => {
    const s = splitAmount(c.amount);
    return new TableRow({ children: [
      makeCell(`${c.label} - ${tx.description}`, { alignment: AlignmentType.RIGHT }),
      makeCell(s.dinars),
      makeCell(s.fils),
    ]});
  });

  // Add empty rows to match template
  while (detailRows.length < 3) {
    detailRows.push(new TableRow({ children: [
      makeCell("", { alignment: AlignmentType.RIGHT }),
      makeCell(""),
      makeCell(""),
    ]}));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        // Header
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 100 }, children: [
          new TextRun({ text: "مديرية التربية والتعليم لمنطقة / لواءي الطيبة والوسطية", font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 200 }, children: [
          new TextRun({ text: "مستند صرف", bold: true, font: "Traditional Arabic", size: 36, rightToLeft: true }),
        ]}),
        // المادة ورقم الصرف
        new Paragraph({ bidirectional: true, spacing: { after: 100 }, children: [
          new TextRun({ text: "المادة: (          )", font: "Traditional Arabic", size: 24, rightToLeft: true }),
          new TextRun({ text: `              رقم الصرف: (${tx.referenceNumber || "      "})`, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        // التاريخ
        new Paragraph({ bidirectional: true, spacing: { after: 100 }, children: [
          new TextRun({ text: `التاريخ: ${tx.date}`, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        // المدرسة
        new Paragraph({ bidirectional: true, spacing: { after: 100 }, children: [
          new TextRun({ text: `مدرسة: ${schoolName}`, bold: true, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        // مطلوب إلى
        new Paragraph({ bidirectional: true, spacing: { after: 200 }, children: [
          new TextRun({ text: `مطلوب إلى: ${tx.description}`, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        // Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              makeCell("تفاصـــــــــــــيل الدفعـــــــــــة", { bold: true, width: 60, shading: "f0f0f0", alignment: AlignmentType.RIGHT }),
              makeCell("المبلغ", { bold: true, colSpan: 2, shading: "f0f0f0" }),
            ]}),
            new TableRow({ children: [
              makeCell("", { shading: "f5f5f5" }),
              makeCell("دينار", { bold: true, shading: "f5f5f5" }),
              makeCell("فلس", { bold: true, shading: "f5f5f5" }),
            ]}),
            ...detailRows,
            // Total row
            new TableRow({ children: [
              makeCell("المجموع", { bold: true, alignment: AlignmentType.RIGHT, shading: "e8e8e8" }),
              makeCell(totalSplit.dinars, { bold: true, shading: "e8e8e8" }),
              makeCell(totalSplit.fils, { bold: true, shading: "e8e8e8" }),
            ]}),
          ],
        }),
        // Certification
        new Paragraph({ spacing: { before: 300 }, bidirectional: true, children: [
          new TextRun({ text: "أصادق على صحة البيان المذكور أعلاه وأشهد أن الاتفاق قد تم وفقاً للنظام وتعليماته.", bold: true, font: "Traditional Arabic", size: 22, rightToLeft: true }),
        ]}),
        // Signatures - 3 columns
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              new TableCell({ children: [
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [new TextRun({ text: "عضو لجنة التبرعات", bold: true, font: "Traditional Arabic", size: 22, rightToLeft: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [new TextRun({ text: "الأسم:........................", font: "Traditional Arabic", size: 20, rightToLeft: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 200 }, children: [new TextRun({ text: "التوقيع:......................", font: "Traditional Arabic", size: 20, rightToLeft: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [new TextRun({ text: "التاريخ:.........................", font: "Traditional Arabic", size: 20, rightToLeft: true })] }),
              ], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
              new TableCell({ children: [
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [new TextRun({ text: "عضو لجنة التبرعات", bold: true, font: "Traditional Arabic", size: 22, rightToLeft: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [new TextRun({ text: "الأسم:........................", font: "Traditional Arabic", size: 20, rightToLeft: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 200 }, children: [new TextRun({ text: "التوقيع:......................", font: "Traditional Arabic", size: 20, rightToLeft: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [new TextRun({ text: "التاريخ:......................", font: "Traditional Arabic", size: 20, rightToLeft: true })] }),
              ], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
              new TableCell({ children: [
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [new TextRun({ text: "مدير المدرسة", bold: true, font: "Traditional Arabic", size: 22, rightToLeft: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [new TextRun({ text: `الأسم: ..............................`, font: "Traditional Arabic", size: 20, rightToLeft: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 200 }, children: [new TextRun({ text: "التوقيع:........................", font: "Traditional Arabic", size: 20, rightToLeft: true })] }),
              ], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
            ]}),
          ],
        }),
        // Check/Cash
        new Paragraph({ spacing: { before: 300 }, bidirectional: true, children: [
          new TextRun({ text: `رقم التحويل (الشيك): (${tx.checkNumber || "          "})     تاريخه:     /     /`, font: "Traditional Arabic", size: 22, rightToLeft: true }),
        ]}),
        new Paragraph({ bidirectional: true, children: [
          new TextRun({ text: "الدفع نقداً", font: "Traditional Arabic", size: 22, rightToLeft: true }),
        ]}),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `مستند_صرف_${tx.referenceNumber || tx.id}.docx`);
}
