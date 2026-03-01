import ExcelJS from "exceljs";
import { FinanceState } from "@/types/finance";
import { ARABIC_MONTHS, SUMMARY_ROWS, getAccountMonthData, splitDinarFilsNumeric } from "./monthlySummaryUtils";

export async function exportMonthlySummaryExcel(state: FinanceState, selectedMonthIndex: number) {
  const selectedMonth = ARABIC_MONTHS[selectedMonthIndex] || state.currentMonth;

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

  const totalCols = 13;

  // Row 1-4: Headers
  const r1 = ws.addRow(["وزارة التربية والتعليم"]);
  ws.mergeCells(1, 1, 1, totalCols);
  r1.getCell(1).font = { bold: true, size: 14, name: "Arial" };
  r1.getCell(1).alignment = centerAlign;
  r1.height = 25;

  const r2 = ws.addRow([`مديرية التربية والتعليم / ${state.directorateName || ".................."}`]);
  ws.mergeCells(2, 1, 2, totalCols);
  r2.getCell(1).font = { bold: true, size: 12, name: "Arial" };
  r2.getCell(1).alignment = centerAlign;
  r2.height = 22;

  const r3 = ws.addRow([`اسم المدرسة: ${state.schoolName}    رقم الملف: (    )`]);
  ws.mergeCells(3, 1, 3, totalCols);
  r3.getCell(1).font = { bold: true, size: 11, name: "Arial" };
  r3.getCell(1).alignment = rightAlign;
  r3.height = 22;

  const r4 = ws.addRow([`خلاصة الحسابات الشهرية لشهر ${selectedMonth} من عام ${state.currentYear}`]);
  ws.mergeCells(4, 1, 4, totalCols);
  r4.getCell(1).font = { bold: true, size: 13, name: "Arial" };
  r4.getCell(1).alignment = centerAlign;
  r4.getCell(1).fill = lightFill;
  r4.height = 28;

  // Table headers
  const h1Vals = ["الحساب", "الرصيد المدور في بداية كل شهر", "", "", "", "المقبوضات خلال الشهر", "", "المدفوع خلال الشهر", "", "الرصيد المدور في نهاية الشهر", "", "", ""];
  const h1 = ws.addRow(h1Vals);
  h1.height = 28;
  ws.mergeCells(5, 1, 7, 1);
  ws.mergeCells(5, 2, 5, 5);
  ws.mergeCells(5, 6, 5, 7);
  ws.mergeCells(5, 8, 5, 9);
  ws.mergeCells(5, 10, 5, 13);

  const h2Vals = ["", "من", "", "إلى", "", "من", "", "إلى", "", "من", "", "إلى", ""];
  const h2 = ws.addRow(h2Vals);
  h2.height = 22;
  ws.mergeCells(6, 2, 6, 3);
  ws.mergeCells(6, 4, 6, 5);
  ws.mergeCells(6, 6, 6, 7);
  ws.mergeCells(6, 8, 6, 9);
  ws.mergeCells(6, 10, 6, 11);
  ws.mergeCells(6, 12, 6, 13);

  const h3Vals = ["", "فلس", "دينار", "فلس", "دينار", "فلس", "دينار", "فلس", "دينار", "فلس", "دينار", "فلس", "دينار"];
  const h3 = ws.addRow(h3Vals);
  h3.height = 20;

  [h1, h2, h3].forEach((row, ri) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = ri === 0 ? headerFill : subHeaderFill;
      cell.font = ri === 0 ? headerFont : subFont;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
    });
  });

  // Data rows
  const allData = SUMMARY_ROWS.map(row => ({ ...row, data: getAccountMonthData(state, row.id, selectedMonthIndex) }));

  allData.forEach((item) => {
    const d = item.data;
    const [odD, odF] = splitDinarFilsNumeric(d.openDebit);
    const [ocD, ocF] = splitDinarFilsNumeric(d.openCredit);
    const noSwap = ["cashBox", "bank", "advances"].includes(item.id);
    const receiptVal = noSwap ? d.duringDebit : d.duringCredit;
    const paymentVal = noSwap ? d.duringCredit : d.duringDebit;
    const [ddD, ddF] = splitDinarFilsNumeric(receiptVal);
    const [dcD, dcF] = splitDinarFilsNumeric(paymentVal);
    const [edD, edF] = splitDinarFilsNumeric(d.endDebit);
    const [ecD, ecF] = splitDinarFilsNumeric(d.endCredit);

    const row = ws.addRow([item.label, odF, odD, ocF, ocD, ddF, ddD, dcF, dcD, edF, edD, ecF, ecD]);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = colNum === 1 ? boldBodyFont : bodyFont;
      cell.alignment = colNum === 1 ? rightAlign : centerAlign;
      cell.border = thinBorder;
    });
  });

  // Totals
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

  const [todD, todF] = splitDinarFilsNumeric(totals.openDebit);
  const [tocD, tocF] = splitDinarFilsNumeric(totals.openCredit);
  const [tddD, tddF] = splitDinarFilsNumeric(totals.duringReceipt);
  const [tdcD, tdcF] = splitDinarFilsNumeric(totals.duringPayment);
  const [tedD, tedF] = splitDinarFilsNumeric(totals.endDebit);
  const [tecD, tecF] = splitDinarFilsNumeric(totals.endCredit);

  const totRow = ws.addRow(["المجموع", todF, todD, tocF, tocD, tddF, tddD, tdcF, tdcD, tedF, tedD, tecF, tecD]);
  totRow.height = 26;
  totRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.font = { ...boldBodyFont, size: 11 };
    cell.alignment = colNum === 1 ? rightAlign : centerAlign;
    cell.border = thinBorder;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2F8" } };
  });

  // Notes & signatures
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

  ws.addRow([]);
  const sig1 = ws.addRow(["مدير المدرسة: " + (state.directorName || "_______________")]);
  ws.mergeCells(sig1.number, 1, sig1.number, 5);
  sig1.getCell(1).font = { bold: true, size: 11, name: "Arial" };
  sig1.getCell(1).alignment = rightAlign;
  sig1.getCell(10).value = "ختم المدرسة";
  sig1.getCell(10).font = { bold: true, size: 11, name: "Arial" };
  sig1.getCell(10).alignment = centerAlign;
  ws.mergeCells(sig1.number, 10, sig1.number, totalCols);

  ws.addRow([]);
  const formRow = ws.addRow(["Form# QF72-3-11 rev.a"]);
  ws.mergeCells(formRow.number, 1, formRow.number, totalCols);
  formRow.getCell(1).font = { size: 8, name: "Arial", italic: true };
  formRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  ws.columns = [
    { width: 18 }, { width: 6 }, { width: 8 }, { width: 6 }, { width: 8 },
    { width: 6 }, { width: 8 }, { width: 6 }, { width: 8 },
    { width: 6 }, { width: 8 }, { width: 6 }, { width: 8 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `خلاصة_الحسابات_${selectedMonth}_${state.currentYear}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
