import ExcelJS from "exceljs";
import { ACCOUNT_COLUMNS, AccountColumnId, FinanceState } from "@/types/finance";

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

function getAccountData(state: FinanceState, colId: string) {
  const exists = ACCOUNT_COLUMNS.some(c => c.id === colId);
  if (!exists) return { openDebit: 0, openCredit: 0, duringDebit: 0, duringCredit: 0, endDebit: 0, endCredit: 0 };

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

  // Net = (openDebit - openCredit) + (duringDebit - duringCredit)
  const net = (openDebit - openCredit) + (duringDebit - duringCredit);
  const endDebit = net > 0 ? net : 0;
  const endCredit = net < 0 ? Math.abs(net) : 0;
  return {
    openDebit, openCredit,
    duringDebit, duringCredit,
    endDebit, endCredit,
  };
}

/** Split a number into دينار (whole) and فلس (fractional * 1000) */
function splitDinarFils(value: number): [number | string, number | string] {
  if (value === 0) return ["", ""];
  const abs = Math.abs(value);
  const dinar = Math.floor(abs);
  const fils = Math.round((abs - dinar) * 1000);
  return [dinar, fils];
}

export async function exportMonthlySummaryExcel(state: FinanceState) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("خلاصة الحسابات", {
    views: [{ rightToLeft: true }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
  const rightAlign: Partial<ExcelJS.Alignment> = { horizontal: "right", vertical: "middle", wrapText: true };
  const headerFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4F72" } };
  const subHeaderFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2471A3" } };
  const lightFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6EAF8" } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Arial" };
  const subFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Arial" };
  const bodyFont: Partial<ExcelJS.Font> = { size: 10, name: "Arial" };
  const boldBodyFont: Partial<ExcelJS.Font> = { size: 10, name: "Arial", bold: true };

  // Total columns: 1 (الحساب) + 4 (بداية) + 4 (مقبوضات + مدفوع as 2+2) + 4 (نهاية) = 13
  // Actually: الحساب(1) + بداية من(دينار,فلس) إلى(دينار,فلس) = 4 + مقبوضات من(دينار,فلس)=2 + مدفوع إلى(دينار,فلس)=2 + نهاية من(دينار,فلس) إلى(دينار,فلس)=4 = 13 total
  const totalCols = 13;

  // Row 1: Ministry
  const r1 = ws.addRow(["وزارة التربية والتعليم"]);
  ws.mergeCells(1, 1, 1, totalCols);
  r1.getCell(1).font = { bold: true, size: 14, name: "Arial" };
  r1.getCell(1).alignment = centerAlign;
  r1.height = 25;

  // Row 2: Directorate
  const r2 = ws.addRow([`مديرية التربية والتعليم / ${state.directorateName || ".................."}`]);
  ws.mergeCells(2, 1, 2, totalCols);
  r2.getCell(1).font = { bold: true, size: 12, name: "Arial" };
  r2.getCell(1).alignment = centerAlign;
  r2.height = 22;

  // Row 3: School name + file number
  const r3 = ws.addRow([`اسم المدرسة: ${state.schoolName}    رقم الملف: (    )`]);
  ws.mergeCells(3, 1, 3, totalCols);
  r3.getCell(1).font = { bold: true, size: 11, name: "Arial" };
  r3.getCell(1).alignment = rightAlign;
  r3.height = 22;

  // Row 4: Title
  const r4 = ws.addRow([`خلاصة الحسابات الشهرية لشهر ${state.currentMonth} من عام ${state.currentYear}`]);
  ws.mergeCells(4, 1, 4, totalCols);
  r4.getCell(1).font = { bold: true, size: 13, name: "Arial" };
  r4.getCell(1).alignment = centerAlign;
  r4.getCell(1).fill = lightFill;
  r4.height = 28;

  // Row 5: Main headers (3 rows of headers)
  // Columns: 1=الحساب, 2-5=الرصيد المدور بداية, 6-7=المقبوضات, 8-9=المدفوع, 10-13=الرصيد المدور نهاية
  const h1Vals = ["الحساب", "الرصيد المدور في بداية كل شهر", "", "", "", "المقبوضات خلال الشهر", "", "المدفوع خلال الشهر", "", "الرصيد المدور في نهاية الشهر", "", "", ""];
  const h1 = ws.addRow(h1Vals);
  h1.height = 28;

  // Merge: الحساب spans 3 rows (5-7, col 1)
  ws.mergeCells(5, 1, 7, 1);
  // الرصيد المدور في بداية spans cols 2-5
  ws.mergeCells(5, 2, 5, 5);
  // المقبوضات خلال الشهر spans cols 6-7
  ws.mergeCells(5, 6, 5, 7);
  // المدفوع خلال الشهر spans cols 8-9
  ws.mergeCells(5, 8, 5, 9);
  // الرصيد المدور في نهاية الشهر spans cols 10-13
  ws.mergeCells(5, 10, 5, 13);

  // Row 6: Sub-headers (من / إلى)
  const h2Vals = ["", "من", "", "إلى", "", "من", "", "إلى", "", "من", "", "إلى", ""];
  const h2 = ws.addRow(h2Vals);
  h2.height = 22;
  // Merge من/إلى pairs
  ws.mergeCells(6, 2, 6, 3);   // بداية من
  ws.mergeCells(6, 4, 6, 5);   // بداية إلى
  ws.mergeCells(6, 6, 6, 7);   // مقبوضات من
  ws.mergeCells(6, 8, 6, 9);   // مدفوع إلى
  ws.mergeCells(6, 10, 6, 11); // نهاية من
  ws.mergeCells(6, 12, 6, 13); // نهاية إلى

  // Row 7: دينار / فلس
  const h3Vals = ["", "فلس", "دينار", "فلس", "دينار", "فلس", "دينار", "فلس", "دينار", "فلس", "دينار", "فلس", "دينار"];
  const h3 = ws.addRow(h3Vals);
  h3.height = 20;

  // Style all header rows
  [h1, h2, h3].forEach((row, ri) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = ri === 0 ? headerFill : ri === 1 ? subHeaderFill : subHeaderFill;
      cell.font = ri === 0 ? headerFont : subFont;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
    });
  });

  // Data rows
  const allData = SUMMARY_ROWS.map(row => ({ ...row, data: getAccountData(state, row.id) }));

  allData.forEach((item) => {
    const d = item.data;
    const [odD, odF] = splitDinarFils(d.openDebit);
    const [ocD, ocF] = splitDinarFils(d.openCredit);
    // cashBox, bank, advances: debit=مقبوضات, credit=مدفوع (no swap)
    const noSwap = ["cashBox", "bank", "advances"].includes(item.id);
    const receiptVal = noSwap ? d.duringDebit : d.duringCredit;
    const paymentVal = noSwap ? d.duringCredit : d.duringDebit;
    const [ddD, ddF] = splitDinarFils(receiptVal);
    const [dcD, dcF] = splitDinarFils(paymentVal);
    const [edD, edF] = splitDinarFils(d.endDebit);
    const [ecD, ecF] = splitDinarFils(d.endCredit);

    const row = ws.addRow([
      item.label,
      odF, odD, ocF, ocD,
      ddF, ddD, dcF, dcD,
      edF, edD, ecF, ecD,
    ]);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = colNum === 1 ? boldBodyFont : bodyFont;
      cell.alignment = colNum === 1 ? rightAlign : centerAlign;
      cell.border = thinBorder;
    });
  });

  // Totals row
  const totals = allData.reduce((acc, r) => {
    const noSwap = ["cashBox", "bank", "advances"].includes(r.id);
    const receipt = noSwap ? r.data.duringDebit : r.data.duringCredit;
    const payment = noSwap ? r.data.duringCredit : r.data.duringDebit;
    return {
      openDebit: acc.openDebit + r.data.openDebit,
      openCredit: acc.openCredit + r.data.openCredit,
      duringReceipt: acc.duringReceipt + receipt,
      duringPayment: acc.duringPayment + payment,
      endDebit: acc.endDebit + r.data.endDebit,
      endCredit: acc.endCredit + r.data.endCredit,
    };
  }, { openDebit: 0, openCredit: 0, duringReceipt: 0, duringPayment: 0, endDebit: 0, endCredit: 0 });

  const [todD, todF] = splitDinarFils(totals.openDebit);
  const [tocD, tocF] = splitDinarFils(totals.openCredit);
  const [tddD, tddF] = splitDinarFils(totals.duringReceipt);
  const [tdcD, tdcF] = splitDinarFils(totals.duringPayment);
  const [tedD, tedF] = splitDinarFils(totals.endDebit);
  const [tecD, tecF] = splitDinarFils(totals.endCredit);

  const totRow = ws.addRow([
    "المجموع",
    todF, todD, tocF, tocD,
    tddF, tddD, tdcF, tdcD,
    tedF, tedD, tecF, tecD,
  ]);
  totRow.height = 26;
  totRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.font = { ...boldBodyFont, size: 11 };
    cell.alignment = colNum === 1 ? rightAlign : centerAlign;
    cell.border = thinBorder;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2F8" } };
  });

  // Notes
  ws.addRow([]);
  const n1 = ws.addRow(["ملاحظات:"]);
  ws.mergeCells(n1.number, 1, n1.number, totalCols);
  n1.getCell(1).font = { bold: true, size: 10, name: "Arial" };

  const n2 = ws.addRow(["1. يجب أن تساوي مجموع الأرصدة المدينة والدائنة في بداية كل شهر."]);
  ws.mergeCells(n2.number, 1, n2.number, totalCols);
  n2.getCell(1).font = { size: 9, name: "Arial" };

  const n3 = ws.addRow(["2. يجب تحقيق المعادلة التالية: الرصيد في نهاية الشهر = الرصيد في بداية الشهر + المقبوض - المدفوع."]);
  ws.mergeCells(n3.number, 1, n3.number, totalCols);
  n3.getCell(1).font = { size: 9, name: "Arial" };

  // Signatures
  ws.addRow([]);
  const sig1 = ws.addRow(["مدير المدرسة: " + (state.directorName || "_______________")]);
  ws.mergeCells(sig1.number, 1, sig1.number, 5);
  sig1.getCell(1).font = { bold: true, size: 11, name: "Arial" };
  sig1.getCell(1).alignment = rightAlign;

  // Add "ختم المدرسة" on the left side
  sig1.getCell(10).value = "ختم المدرسة";
  sig1.getCell(10).font = { bold: true, size: 11, name: "Arial" };
  sig1.getCell(10).alignment = centerAlign;
  ws.mergeCells(sig1.number, 10, sig1.number, totalCols);

  // Form number
  ws.addRow([]);
  const formRow = ws.addRow(["Form# QF72-3-11 rev.a"]);
  ws.mergeCells(formRow.number, 1, formRow.number, totalCols);
  formRow.getCell(1).font = { size: 8, name: "Arial", italic: true };
  formRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  // Column widths
  ws.columns = [
    { width: 18 },  // الحساب
    { width: 6 }, { width: 8 },  // بداية من: فلس، دينار
    { width: 6 }, { width: 8 },  // بداية إلى
    { width: 6 }, { width: 8 },  // مقبوضات من
    { width: 6 }, { width: 8 },  // مدفوع إلى
    { width: 6 }, { width: 8 },  // نهاية من
    { width: 6 }, { width: 8 },  // نهاية إلى
  ];

  // Export
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `خلاصة_الحسابات_${state.currentMonth}_${state.currentYear}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
