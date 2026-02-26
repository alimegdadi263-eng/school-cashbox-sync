import { useState, Fragment } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, TRANSACTION_TYPE_LABELS, Transaction, getAccountLabel } from "@/types/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Download, FileDown } from "lucide-react";
import { fillJournalVoucher, fillPaymentVoucher } from "@/lib/fillDocxTemplate";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";

function getTransactionFromTo(tx: Transaction): { from: string; to: string } {
  switch (tx.type) {
    case "receipt":
      return { from: "الصندوق", to: getAccountLabel(tx.sourceAccount || "donations") };
    case "payment":
      return { from: getAccountLabel(tx.sourceAccount || "donations"), to: "البنك" };
    case "journal":
      return { from: "البنك", to: "الصندوق" };
    case "advance_withdrawal":
      return { from: "السلفة", to: "البنك" };
    case "advance_payment":
      return { from: "التبرعات", to: "السلفة" };
    default:
      return { from: "-", to: "-" };
  }
}

export default function CashBook() {
  const { state, getColumnBalance, deleteTransaction } = useFinance();
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = state.transactions
    .filter((t) => t.status === "active")
    .filter((t) => filterType === "all" || t.type === filterType)
    .filter((t) => t.description.includes(searchTerm) || t.referenceNumber.includes(searchTerm));

  const formatCurrency = (n: number) =>
    n === 0 ? "-" : n.toLocaleString("ar-JO", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("دفتر الصندوق", {
      views: [{ rightToLeft: true }],
      pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    const totalCols = 6 + ACCOUNT_COLUMNS.length * 2;
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
    const headerFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4F72" } };
    const subHeaderFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2471A3" } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Arial" };
    const subHeaderFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Arial" };
    const bodyFont: Partial<ExcelJS.Font> = { size: 10, name: "Arial" };
    const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };

    // Title row
    const titleRow = ws.addRow([`دفتر صندوق - ${state.schoolName} - ${state.currentMonth} ${state.currentYear}`]);
    ws.mergeCells(1, 1, 1, totalCols);
    titleRow.height = 30;
    titleRow.getCell(1).font = { bold: true, size: 14, name: "Arial" };
    titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5E8F0" } };

    // Header row 1
    const h1Values: string[] = ["التاريخ", "الحركة", "رقم الشك", "من", "الى", "البيان"];
    ACCOUNT_COLUMNS.forEach((col) => { h1Values.push(col.label, ""); });
    const headerRow1 = ws.addRow(h1Values);
    headerRow1.height = 25;

    // Header row 2 (sub-headers)
    const h2Values: string[] = ["", "", "", "", "", ""];
    ACCOUNT_COLUMNS.forEach(() => { h2Values.push("من", "الى"); });
    const headerRow2 = ws.addRow(h2Values);
    headerRow2.height = 20;

    // Merge account column headers
    ACCOUNT_COLUMNS.forEach((_, i) => {
      const startCol = 7 + i * 2;
      ws.mergeCells(2, startCol, 2, startCol + 1);
    });
    // Merge first 6 columns across header rows
    for (let c = 1; c <= 6; c++) {
      ws.mergeCells(2, c, 3, c);
    }

    // Style header rows
    [headerRow1, headerRow2].forEach((row, ri) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = ri === 0 ? headerFill : subHeaderFill;
        cell.font = ri === 0 ? headerFont : subHeaderFont;
        cell.alignment = centerAlign;
        cell.border = thinBorder;
      });
    });

    // Opening balances
    const obValues: (string | number)[] = ["-", "-", "-", "-", "-", "الرصيد الافتتاحي"];
    ACCOUNT_COLUMNS.forEach((col) => {
      const ob = state.openingBalances.find((b) => b.column === col.id);
      obValues.push(ob?.debit || 0, ob?.credit || 0);
    });
    const obRow = ws.addRow(obValues);
    obRow.height = 22;
    obRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { ...bodyFont, bold: true };
      cell.alignment = centerAlign;
      cell.border = thinBorder;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F4" } };
      if (colNum > 6 && (colNum - 7) % 2 === 0) cell.numFmt = "#,##0.000";
      if (colNum > 6 && (colNum - 7) % 2 === 1) cell.numFmt = "#,##0.000";
    });

    // Transaction rows
    filtered.forEach((tx) => {
      const fromTo = getTransactionFromTo(tx);
      const vals: (string | number)[] = [
        tx.date,
        `${TRANSACTION_TYPE_LABELS[tx.type]} ${tx.referenceNumber || ""}`.trim(),
        tx.checkNumber || "-",
        fromTo.from,
        fromTo.to,
        tx.description,
      ];
      ACCOUNT_COLUMNS.forEach((col) => {
        const d = tx.amounts[col.id]?.debit || 0;
        const c = tx.amounts[col.id]?.credit || 0;
        vals.push(d === 0 ? "" as any : d, c === 0 ? "" as any : c);
      });
      const row = ws.addRow(vals);
      row.height = 20;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = bodyFont;
        cell.alignment = centerAlign;
        cell.border = thinBorder;
        if (colNum > 6) cell.numFmt = "#,##0.000";
      });
    });

    // Totals row
    const totValues: (string | number)[] = ["", "", "", "", "", "المجموع الكلي"];
    ACCOUNT_COLUMNS.forEach((col) => {
      const bal = getColumnBalance(col.id);
      totValues.push(bal.debit, bal.credit);
    });
    const totRow = ws.addRow(totValues);
    totRow.height = 24;
    ws.mergeCells(totRow.number, 1, totRow.number, 6);
    totRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { ...bodyFont, bold: true, size: 11 };
      cell.alignment = centerAlign;
      cell.border = thinBorder;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2F8" } };
      if (colNum > 6) cell.numFmt = "#,##0.000";
    });

    // Net balance row
    const netValues: (string | number)[] = ["", "", "", "", "", "الرصيد الجديد"];
    ACCOUNT_COLUMNS.forEach((col) => {
      const bal = getColumnBalance(col.id);
      const net = bal.debit - bal.credit;
      // وضع الرصيد في العمود الصحيح: من (مدين) أو الى (دائن)
      netValues.push(net >= 0 ? Math.abs(net) : "", net < 0 ? Math.abs(net) : "");
    });
    const netRow = ws.addRow(netValues);
    netRow.height = 24;
    ws.mergeCells(netRow.number, 1, netRow.number, 6);
    netRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { ...bodyFont, bold: true, size: 11 };
      cell.alignment = centerAlign;
      cell.border = thinBorder;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4EFDF" } };
      if (colNum > 6 && (colNum - 7) % 2 === 0) cell.numFmt = "#,##0.000";
    });

    // Column widths
    ws.columns = [
      { width: 14 }, // التاريخ
      { width: 18 }, // الحركة
      { width: 12 }, // رقم الشك
      { width: 12 }, // من
      { width: 12 }, // الى
      { width: 32 }, // البيان
      ...ACCOUNT_COLUMNS.flatMap(() => [{ width: 13 }, { width: 13 }]),
    ];

    // Export
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `دفتر_الصندوق_${state.currentMonth}_${state.currentYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const thClass = "py-3 px-2 text-center border border-primary-foreground/30";
  const tdClass = "py-2.5 px-2 text-center border border-border";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-foreground">دفتر الصندوق</h1>
          <div className="flex gap-3 items-center">
            <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
              <Download className="w-4 h-4" />
              تصدير Excel
            </Button>
            <Input
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="receipt">قبض</SelectItem>
                <SelectItem value="payment">صرف</SelectItem>
                <SelectItem value="journal">قيد</SelectItem>
                <SelectItem value="advance_withdrawal">سحب سلفة</SelectItem>
                <SelectItem value="advance_payment">صرف سلفة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className={thClass} rowSpan={2}>التاريخ</th>
                    <th className={thClass} rowSpan={2}>الحركة</th>
                    <th className={thClass} rowSpan={2}>رقم الشك</th>
                    <th className={thClass} rowSpan={2}>من</th>
                    <th className={thClass} rowSpan={2}>الى</th>
                    <th className={`${thClass} text-right`} rowSpan={2}>البيان</th>
                    {ACCOUNT_COLUMNS.map((col) => (
                      <th key={col.id} className={thClass} colSpan={2}>
                        {col.label}
                      </th>
                    ))}
                    <th className={thClass} rowSpan={2}>إجراءات</th>
                  </tr>
                  <tr className="bg-primary/80 text-primary-foreground text-[10px]">
                    {ACCOUNT_COLUMNS.map((col) => (
                      <Fragment key={col.id}>
                        <th className={`${thClass} min-w-[70px]`}>من</th>
                        <th className={`${thClass} min-w-[70px]`}>الى</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  <tr className="bg-accent/20 font-semibold">
                    <td className={tdClass}>-</td>
                    <td className={tdClass}>-</td>
                    <td className={tdClass}>-</td>
                    <td className={tdClass}>-</td>
                    <td className={tdClass}>-</td>
                    <td className={`${tdClass} text-right`}>الرصيد الافتتاحي</td>
                    {ACCOUNT_COLUMNS.map((col) => {
                      const ob = state.openingBalances.find((b) => b.column === col.id);
                      return (
                        <Fragment key={col.id}>
                          <td className={`${tdClass} text-success`}>{formatCurrency(ob?.debit || 0)}</td>
                          <td className={`${tdClass} text-destructive`}>{formatCurrency(ob?.credit || 0)}</td>
                        </Fragment>
                      );
                    })}
                    <td className="border border-border"></td>
                  </tr>

                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6 + ACCOUNT_COLUMNS.length * 2 + 1} className="py-8 text-center text-muted-foreground border border-border">
                        لا توجد حركات
                      </td>
                    </tr>
                  ) : (
                    filtered.map((tx) => {
                      const fromTo = getTransactionFromTo(tx);
                      return (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className={`${tdClass} whitespace-nowrap`}>{tx.date}</td>
                          <td className={tdClass}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                tx.type === "receipt"
                                  ? "bg-success/10 text-success"
                                  : tx.type === "payment"
                                  ? "bg-destructive/10 text-destructive"
                                  : tx.type === "journal"
                                  ? "bg-journal/10 text-journal"
                                  : tx.type === "advance_withdrawal"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-purple-500/10 text-purple-600"
                              }`}>
                                {TRANSACTION_TYPE_LABELS[tx.type]}
                              </span>
                              {tx.referenceNumber && (
                                <span className="text-[9px] text-muted-foreground">{tx.referenceNumber}</span>
                              )}
                            </div>
                          </td>
                          <td className={`${tdClass} text-xs`}>{tx.checkNumber || "-"}</td>
                          <td className={`${tdClass} text-xs`}>{fromTo.from}</td>
                          <td className={`${tdClass} text-xs`}>{fromTo.to}</td>
                          <td className={`${tdClass} text-right`}>{tx.description}</td>
                          {ACCOUNT_COLUMNS.map((col) => (
                            <Fragment key={col.id}>
                              <td className={`${tdClass} text-success`}>
                                {formatCurrency(tx.amounts[col.id]?.debit || 0)}
                              </td>
                              <td className={`${tdClass} text-destructive`}>
                                {formatCurrency(tx.amounts[col.id]?.credit || 0)}
                              </td>
                            </Fragment>
                          ))}
                          <td className="py-2.5 px-2 border border-border">
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (tx.type === "journal") fillJournalVoucher(tx, state.schoolName, state.directorateName);
                                  else fillPaymentVoucher(tx, state.schoolName, state.directorateName, state.directorName, state.member1Name, state.member2Name);
                                }}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-accent-foreground"
                                title="تنزيل وورد"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTransaction(tx.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Totals row */}
                  <tr className="bg-primary/5 font-bold">
                    <td colSpan={6} className="py-3 px-3 border border-border">المجموع الكلي</td>
                    {ACCOUNT_COLUMNS.map((col) => {
                      const bal = getColumnBalance(col.id);
                      return (
                        <Fragment key={col.id}>
                          <td className={`${tdClass} text-success`}>{formatCurrency(bal.debit)}</td>
                          <td className={`${tdClass} text-destructive`}>{formatCurrency(bal.credit)}</td>
                        </Fragment>
                      );
                    })}
                    <td className="border border-border"></td>
                  </tr>

                  {/* New Balance row */}
                  <tr className="bg-accent/30 font-bold">
                    <td colSpan={6} className="py-3 px-3 border border-border text-accent-foreground">الرصيد الجديد (نهاية الشهر)</td>
                    {ACCOUNT_COLUMNS.map((col) => {
                      const bal = getColumnBalance(col.id);
                      const net = bal.debit - bal.credit;
                      return (
                        <Fragment key={col.id}>
                          <td className={`py-3 px-2 text-center border border-border font-bold text-success`}>
                            {net > 0 ? formatCurrency(net) : "-"}
                          </td>
                          <td className={`py-3 px-2 text-center border border-border font-bold text-destructive`}>
                            {net < 0 ? formatCurrency(Math.abs(net)) : "-"}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td className="border border-border"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
