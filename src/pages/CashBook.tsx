import { useState, Fragment } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, TRANSACTION_TYPE_LABELS, Transaction, getAccountLabel } from "@/types/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Download, FileDown } from "lucide-react";
import { fillJournalVoucher, fillPaymentVoucher } from "@/lib/fillDocxTemplate";
import * as XLSX from "xlsx";
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

  const exportToExcel = () => {
    const formatNum = (n: number) => (n === 0 ? "" : n);

    // Header row 1
    const headers1 = ["التاريخ", "الحركة", "رقم الشك", "من", "الى", "البيان"];
    ACCOUNT_COLUMNS.forEach((col) => {
      headers1.push(col.label, "");
    });

    // Header row 2 (sub-headers)
    const headers2 = ["", "", "", "", "", ""];
    ACCOUNT_COLUMNS.forEach(() => {
      headers2.push("من", "الى");
    });

    const rows: any[][] = [headers1, headers2];

    // Opening balances
    const obRow: any[] = ["-", "-", "-", "-", "-", "الرصيد الافتتاحي"];
    ACCOUNT_COLUMNS.forEach((col) => {
      const ob = state.openingBalances.find((b) => b.column === col.id);
      obRow.push(formatNum(ob?.debit || 0), formatNum(ob?.credit || 0));
    });
    rows.push(obRow);

    // Transactions
    filtered.forEach((tx) => {
      const fromTo = getTransactionFromTo(tx);
      const row: any[] = [
        tx.date,
        `${TRANSACTION_TYPE_LABELS[tx.type]} ${tx.referenceNumber || ""}`.trim(),
        tx.checkNumber || "-",
        fromTo.from,
        fromTo.to,
        tx.description,
      ];
      ACCOUNT_COLUMNS.forEach((col) => {
        row.push(formatNum(tx.amounts[col.id]?.debit || 0), formatNum(tx.amounts[col.id]?.credit || 0));
      });
      rows.push(row);
    });

    // Totals
    const totRow: any[] = ["", "", "", "", "", "المجموع الكلي"];
    ACCOUNT_COLUMNS.forEach((col) => {
      const bal = getColumnBalance(col.id);
      totRow.push(formatNum(bal.debit), formatNum(bal.credit));
    });
    rows.push(totRow);

    // Net balance
    const netRow: any[] = ["", "", "", "", "", "الرصيد الجديد"];
    ACCOUNT_COLUMNS.forEach((col) => {
      const bal = getColumnBalance(col.id);
      const net = bal.debit - bal.credit;
      netRow.push(Math.abs(net), net >= 0 ? "مدين" : "دائن");
    });
    rows.push(netRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Merge header cells for account columns (starting at col index 6)
    ws["!merges"] = ACCOUNT_COLUMNS.map((_, i) => ({
      s: { r: 0, c: 6 + i * 2 },
      e: { r: 0, c: 6 + i * 2 + 1 },
    }));

    // Column widths
    ws["!cols"] = [
      { wch: 12 }, // التاريخ
      { wch: 16 }, // الحركة
      { wch: 10 }, // رقم الشك
      { wch: 12 }, // من
      { wch: 12 }, // الى
      { wch: 30 }, // البيان
      ...ACCOUNT_COLUMNS.flatMap(() => [{ wch: 12 }, { wch: 12 }]),
    ];

    // Add borders to all cells
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        ws[addr].s = {
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "دفتر الصندوق");
    XLSX.writeFile(wb, `دفتر_الصندوق_${state.currentMonth}_${state.currentYear}.xlsx`);
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
                        <td key={col.id} className={`py-3 px-2 text-center border border-border font-bold`} colSpan={2}>
                          <span className={net >= 0 ? "text-success" : "text-destructive"}>
                            {formatCurrency(Math.abs(net))}
                            {net !== 0 && (net > 0 ? " (مدين)" : " (دائن)")}
                          </span>
                        </td>
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
