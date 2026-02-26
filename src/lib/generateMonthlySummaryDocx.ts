import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { ACCOUNT_COLUMNS, AccountColumnId, FinanceState } from "@/types/finance";

const splitAmount = (n: number) => {
  const dinars = Math.floor(Math.abs(n));
  const fils = Math.round((Math.abs(n) - dinars) * 1000);
  return { dinars: dinars > 0 ? String(dinars) : "", fils: fils > 0 ? String(fils) : "" };
};

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1 },
  bottom: { style: BorderStyle.SINGLE, size: 1 },
  left: { style: BorderStyle.SINGLE, size: 1 },
  right: { style: BorderStyle.SINGLE, size: 1 },
};

const makeCell = (text: string, opts?: {
  bold?: boolean; width?: number; colSpan?: number; rowSpan?: number;
  alignment?: typeof AlignmentType[keyof typeof AlignmentType];
  shading?: string; fontSize?: number;
}) =>
  new TableCell({
    children: [new Paragraph({
      alignment: opts?.alignment || AlignmentType.CENTER,
      bidirectional: true,
      children: [new TextRun({
        text,
        bold: opts?.bold,
        font: "Traditional Arabic",
        size: opts?.fontSize || 22,
        rightToLeft: true,
      })],
    })],
    borders: cellBorders,
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: opts?.colSpan,
    rowSpan: opts?.rowSpan,
    shading: opts?.shading ? { fill: opts.shading } : undefined,
    verticalAlign: "center" as any,
  });

// Extended account rows for the official template (includes accounts not in ACCOUNT_COLUMNS)
const SUMMARY_ROWS: { id: string; label: string }[] = [
  { id: "cashBox", label: "الصندوق" },
  { id: "bank", label: "البنك" },
  { id: "donations", label: "التبرعات" },
  { id: "redCrescent", label: "الهلال الأحمر" },
  { id: "advances", label: "السلفات" },
  { id: "gardens", label: "الحدائق المدرسية" },
  { id: "deposits", label: "أمانات كتب مدرسية" },
  { id: "mySchool", label: "مدرستي انتمي" },
  { id: "sdi", label: "منحة SDI" },
  { id: "furniture", label: "أمانات أثاث تالف" },
];

interface AccountData {
  openDebit: number;
  openCredit: number;
  duringDebit: number;
  duringCredit: number;
  endDebit: number;
  endCredit: number;
}

function getAccountData(state: FinanceState, colId: string): AccountData {
  // Check if this account exists in our system
  const exists = ACCOUNT_COLUMNS.some(c => c.id === colId);
  if (!exists) {
    return { openDebit: 0, openCredit: 0, duringDebit: 0, duringCredit: 0, endDebit: 0, endCredit: 0 };
  }

  const ob = state.openingBalances.find(b => b.column === colId as AccountColumnId);
  const openDebit = ob?.debit || 0;
  const openCredit = ob?.credit || 0;

  let duringDebit = 0;
  let duringCredit = 0;
  state.transactions
    .filter(t => t.status === "active")
    .forEach(t => {
      duringDebit += t.amounts[colId as AccountColumnId]?.debit || 0;
      duringCredit += t.amounts[colId as AccountColumnId]?.credit || 0;
    });

  return {
    openDebit,
    openCredit,
    duringDebit,
    duringCredit,
    endDebit: openDebit + duringDebit,
    endCredit: openCredit + duringCredit,
  };
}

export async function generateMonthlySummaryDocx(state: FinanceState) {
  // Calculate data for all accounts
  const allData = SUMMARY_ROWS.map(row => ({
    ...row,
    data: getAccountData(state, row.id),
  }));

  // Calculate totals
  const totals = allData.reduce(
    (acc, row) => ({
      openDebit: acc.openDebit + row.data.openDebit,
      openCredit: acc.openCredit + row.data.openCredit,
      duringDebit: acc.duringDebit + row.data.duringDebit,
      duringCredit: acc.duringCredit + row.data.duringCredit,
      endDebit: acc.endDebit + row.data.endDebit,
      endCredit: acc.endCredit + row.data.endCredit,
    }),
    { openDebit: 0, openCredit: 0, duringDebit: 0, duringCredit: 0, endDebit: 0, endCredit: 0 }
  );

  // Build table header rows
  const headerRow1 = new TableRow({
    children: [
      makeCell("الحساب", { bold: true, rowSpan: 2, shading: "d9e2f3", fontSize: 24 }),
      makeCell("الرصيد المدور في بداية كل شهر", { bold: true, colSpan: 4, shading: "d9e2f3", fontSize: 20 }),
      makeCell("المقبوضات خلال الشهر", { bold: true, colSpan: 2, rowSpan: 2, shading: "d9e2f3", fontSize: 20 }),
      makeCell("المدفوع خلال الشهر", { bold: true, colSpan: 2, rowSpan: 2, shading: "d9e2f3", fontSize: 20 }),
      makeCell("الرصيد المدور في نهاية الشهر", { bold: true, colSpan: 4, shading: "d9e2f3", fontSize: 20 }),
    ],
  });

  const headerRow2 = new TableRow({
    children: [
      makeCell("من", { bold: true, colSpan: 2, shading: "e2efda", fontSize: 20 }),
      makeCell("إلى", { bold: true, colSpan: 2, shading: "fce4d6", fontSize: 20 }),
      makeCell("من", { bold: true, colSpan: 2, shading: "e2efda", fontSize: 20 }),
      makeCell("إلى", { bold: true, colSpan: 2, shading: "fce4d6", fontSize: 20 }),
    ],
  });

  const headerRow3 = new TableRow({
    children: [
      makeCell("", { shading: "f2f2f2" }), // الحساب
      makeCell("دينار", { bold: true, shading: "e2efda", fontSize: 18 }),
      makeCell("فلس", { bold: true, shading: "e2efda", fontSize: 18 }),
      makeCell("دينار", { bold: true, shading: "fce4d6", fontSize: 18 }),
      makeCell("فلس", { bold: true, shading: "fce4d6", fontSize: 18 }),
      makeCell("دينار", { bold: true, shading: "f2f2f2", fontSize: 18 }),
      makeCell("فلس", { bold: true, shading: "f2f2f2", fontSize: 18 }),
      makeCell("دينار", { bold: true, shading: "f2f2f2", fontSize: 18 }),
      makeCell("فلس", { bold: true, shading: "f2f2f2", fontSize: 18 }),
      makeCell("دينار", { bold: true, shading: "e2efda", fontSize: 18 }),
      makeCell("فلس", { bold: true, shading: "e2efda", fontSize: 18 }),
      makeCell("دينار", { bold: true, shading: "fce4d6", fontSize: 18 }),
      makeCell("فلس", { bold: true, shading: "fce4d6", fontSize: 18 }),
    ],
  });

  // Data rows
  const dataRows = allData.map(row => {
    const d = row.data;
    const openD = splitAmount(d.openDebit);
    const openC = splitAmount(d.openCredit);
    const durD = splitAmount(d.duringDebit);
    const durC = splitAmount(d.duringCredit);
    const endD = splitAmount(d.endDebit);
    const endC = splitAmount(d.endCredit);

    return new TableRow({
      children: [
        makeCell(row.label, { bold: true, alignment: AlignmentType.RIGHT, fontSize: 22 }),
        makeCell(openD.dinars), makeCell(openD.fils),
        makeCell(openC.dinars), makeCell(openC.fils),
        makeCell(durD.dinars), makeCell(durD.fils),
        makeCell(durC.dinars), makeCell(durC.fils),
        makeCell(endD.dinars), makeCell(endD.fils),
        makeCell(endC.dinars), makeCell(endC.fils),
      ],
    });
  });

  // Totals row
  const tOpenD = splitAmount(totals.openDebit);
  const tOpenC = splitAmount(totals.openCredit);
  const tDurD = splitAmount(totals.duringDebit);
  const tDurC = splitAmount(totals.duringCredit);
  const tEndD = splitAmount(totals.endDebit);
  const tEndC = splitAmount(totals.endCredit);

  const totalRow = new TableRow({
    children: [
      makeCell("المجموع", { bold: true, shading: "d9e2f3", alignment: AlignmentType.RIGHT, fontSize: 24 }),
      makeCell(tOpenD.dinars, { bold: true, shading: "d9e2f3" }),
      makeCell(tOpenD.fils, { bold: true, shading: "d9e2f3" }),
      makeCell(tOpenC.dinars, { bold: true, shading: "d9e2f3" }),
      makeCell(tOpenC.fils, { bold: true, shading: "d9e2f3" }),
      makeCell(tDurD.dinars, { bold: true, shading: "d9e2f3" }),
      makeCell(tDurD.fils, { bold: true, shading: "d9e2f3" }),
      makeCell(tDurC.dinars, { bold: true, shading: "d9e2f3" }),
      makeCell(tDurC.fils, { bold: true, shading: "d9e2f3" }),
      makeCell(tEndD.dinars, { bold: true, shading: "d9e2f3" }),
      makeCell(tEndD.fils, { bold: true, shading: "d9e2f3" }),
      makeCell(tEndC.dinars, { bold: true, shading: "d9e2f3" }),
      makeCell(tEndC.fils, { bold: true, shading: "d9e2f3" }),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 500, bottom: 500, left: 500, right: 500 },
          size: { orientation: "landscape" as any },
        },
      },
      children: [
        // Header
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 80 }, children: [
          new TextRun({ text: "وزارة التربية والتعليم", bold: true, font: "Traditional Arabic", size: 28, rightToLeft: true }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 80 }, children: [
          new TextRun({ text: `مديرية التربية والتعليم ${state.directorateName}`, bold: true, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        // School name and file number on same line
        new Paragraph({ bidirectional: true, spacing: { after: 80 }, children: [
          new TextRun({ text: `اسم المدرسة: ${state.schoolName}`, bold: true, font: "Traditional Arabic", size: 24, rightToLeft: true }),
          new TextRun({ text: "                    رقم الملف: (        )", font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 200 }, children: [
          new TextRun({ text: `خلاصة الحسابات الشهرية لشهر ${state.currentMonth} من عام ${state.currentYear}`, bold: true, font: "Traditional Arabic", size: 26, rightToLeft: true }),
        ]}),
        // Main table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow1, headerRow2, headerRow3, ...dataRows, totalRow],
        }),
        // Notes
        new Paragraph({ spacing: { before: 300 }, bidirectional: true, children: [
          new TextRun({ text: "ملاحظات:", bold: true, font: "Traditional Arabic", size: 22, rightToLeft: true }),
        ]}),
        new Paragraph({ bidirectional: true, children: [
          new TextRun({ text: "1. يجب أن تساوي مجموع الأرصدة المدينة والدائنة في بداية كل شهر.", font: "Traditional Arabic", size: 20, rightToLeft: true }),
        ]}),
        new Paragraph({ bidirectional: true, spacing: { after: 300 }, children: [
          new TextRun({ text: "2. يجب تحقيق المعادلة التالية: الرصيد في نهاية الشهر = الرصيد في بداية الشهر + المقبوض - المدفوع.", font: "Traditional Arabic", size: 20, rightToLeft: true }),
        ]}),
        // Director signature
        new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true, children: [
          new TextRun({ text: "مدير المدرسة", bold: true, font: "Traditional Arabic", size: 24, rightToLeft: true }),
        ]}),
        new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true, children: [
          new TextRun({ text: "ختم المدرسة", font: "Traditional Arabic", size: 22, rightToLeft: true }),
        ]}),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true, spacing: { before: 100 }, children: [
          new TextRun({ text: "Form# QF72-3-11 rev.a", font: "Traditional Arabic", size: 16, rightToLeft: false }),
        ]}),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `خلاصة_الحسابات_الشهرية_${state.currentMonth}_${state.currentYear}.docx`);
}
