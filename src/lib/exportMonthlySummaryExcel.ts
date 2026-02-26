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

  return { openDebit, openCredit, duringDebit, duringCredit, endDebit: openDebit + duringDebit, endCredit: openCredit + duringCredit };
}

export async function exportMonthlySummaryExcel(state: FinanceState) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("خلاصة الحسابات", {
    views: [{ rightToLeft: true }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
  const rightAlign: Partial<ExcelJS.Alignment> = { horizontal: "right", vertical: "middle", wrapText: true };
  const headerFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4F72" } };
  const subHeaderFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2471A3" } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 12, name: "Arial" };
  const subFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Arial" };
  const bodyFont: Partial<ExcelJS.Font> = { size: 11, name: "Arial" };

  // Row 1: Ministry header
  const r1 = ws.addRow(["وزارة التربية والتعليم"]);
  ws.mergeCells(1, 1, 1, 7);
  r1.getCell(1).font = { bold: true, size: 14, name: "Arial" };
  r1.getCell(1).alignment = centerAlign;
  r1.height = 25;

  // Row 2: Directorate
  const r2 = ws.addRow([`مديرية التربية والتعليم ${state.directorateName}`]);
  ws.mergeCells(2, 1, 2, 7);
  r2.getCell(1).font = { bold: true, size: 12, name: "Arial" };
  r2.getCell(1).alignment = centerAlign;
  r2.height = 22;

  // Row 3: School name
  const r3 = ws.addRow([`اسم المدرسة: ${state.schoolName}`]);
  ws.mergeCells(3, 1, 3, 7);
  r3.getCell(1).font = { bold: true, size: 12, name: "Arial" };
  r3.getCell(1).alignment = rightAlign;
  r3.height = 22;

  // Row 4: Title
  const r4 = ws.addRow([`خلاصة الحسابات الشهرية لشهر ${state.currentMonth} من عام ${state.currentYear}`]);
  ws.mergeCells(4, 1, 4, 7);
  r4.getCell(1).font = { bold: true, size: 13, name: "Arial" };
  r4.getCell(1).alignment = centerAlign;
  r4.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5E8F0" } };
  r4.height = 28;

  // Row 5: Header row 1
  const h1 = ws.addRow(["الحساب", "بداية الشهر", "", "خلال الشهر", "", "نهاية الشهر", ""]);
  h1.height = 28;
  ws.mergeCells(5, 1, 6, 1); // الحساب spans 2 rows
  ws.mergeCells(5, 2, 5, 3); // بداية الشهر
  ws.mergeCells(5, 4, 5, 5); // خلال الشهر
  ws.mergeCells(5, 6, 5, 7); // نهاية الشهر

  // Row 6: Sub-headers
  const h2 = ws.addRow(["", "المقبوض", "المدفوع", "المقبوض", "المدفوع", "المقبوض", "المدفوع"]);
  h2.height = 24;

  // Style headers
  [h1, h2].forEach((row, ri) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = ri === 0 ? headerFill : subHeaderFill;
      cell.font = ri === 0 ? headerFont : subFont;
      cell.alignment = centerAlign;
      cell.border = border;
    });
  });

  // Data rows
  const allData = SUMMARY_ROWS.map(row => ({ ...row, data: getAccountData(state, row.id) }));

  allData.forEach((item) => {
    const d = item.data;
    const row = ws.addRow([
      item.label,
      d.openDebit || "",
      d.openCredit || "",
      d.duringDebit || "",
      d.duringCredit || "",
      d.endDebit || "",
      d.endCredit || "",
    ]);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = colNum === 1 ? { ...bodyFont, bold: true } : bodyFont;
      cell.alignment = colNum === 1 ? rightAlign : centerAlign;
      cell.border = border;
      if (colNum > 1 && typeof cell.value === "number") cell.numFmt = "#,##0.000";
    });
  });

  // Totals
  const totals = allData.reduce((acc, r) => ({
    openDebit: acc.openDebit + r.data.openDebit,
    openCredit: acc.openCredit + r.data.openCredit,
    duringDebit: acc.duringDebit + r.data.duringDebit,
    duringCredit: acc.duringCredit + r.data.duringCredit,
    endDebit: acc.endDebit + r.data.endDebit,
    endCredit: acc.endCredit + r.data.endCredit,
  }), { openDebit: 0, openCredit: 0, duringDebit: 0, duringCredit: 0, endDebit: 0, endCredit: 0 });

  const totRow = ws.addRow([
    "المجموع",
    totals.openDebit, totals.openCredit,
    totals.duringDebit, totals.duringCredit,
    totals.endDebit, totals.endCredit,
  ]);
  totRow.height = 26;
  totRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.font = { ...bodyFont, bold: true, size: 12 };
    cell.alignment = colNum === 1 ? rightAlign : centerAlign;
    cell.border = border;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2F8" } };
    if (colNum > 1) cell.numFmt = "#,##0.000";
  });

  // Notes
  const notesRowNum = ws.lastRow!.number + 2;
  const n1 = ws.addRow([]);
  const n2 = ws.addRow(["ملاحظات:"]);
  n2.getCell(1).font = { bold: true, size: 11, name: "Arial" };
  const n3 = ws.addRow(["1. يجب أن تساوي مجموع الأرصدة المدينة والدائنة في بداية كل شهر نهايته."]);
  n3.getCell(1).font = { size: 10, name: "Arial" };
  const n4 = ws.addRow(["2. الرصيد في نهاية الشهر = الرصيد في بداية الشهر + المقبوض - المدفوع."]);
  n4.getCell(1).font = { size: 10, name: "Arial" };

  // Signature
  ws.addRow([]);
  const sigRow = ws.addRow(["مدير المدرسة: " + (state.directorName || "_______________")]);
  sigRow.getCell(1).font = { bold: true, size: 12, name: "Arial" };
  sigRow.getCell(1).alignment = rightAlign;

  // Column widths
  ws.columns = [
    { width: 22 }, // الحساب
    { width: 15 }, { width: 15 }, // بداية الشهر
    { width: 15 }, { width: 15 }, // خلال الشهر
    { width: 15 }, { width: 15 }, // نهاية الشهر
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
