import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, TRANSACTION_TYPE_LABELS, Transaction, isAssetAccount } from "@/types/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Printer, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import PrintVoucher from "@/components/PrintVoucher";

export default function CashBook() {
  const { state, getColumnBalance, deleteTransaction } = useFinance();
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [printTx, setPrintTx] = useState<Transaction | null>(null);

  const exportToExcel = () => {
    const formatNum = (n: number) => (n === 0 ? "" : n);

    // Header rows
    const headers1 = ["#", "التاريخ", "البيان", "النوع", "رقم الشيك"];
    ACCOUNT_COLUMNS.forEach((col) => {
      headers1.push(col.label, "");
    });

    const headers2 = ["", "", "", "", ""];
    ACCOUNT_COLUMNS.forEach((col) => {
      headers2.push(isAssetAccount(col.id) ? "منه" : "من", isAssetAccount(col.id) ? "له" : "الى");
    });

    const rows: any[][] = [headers1, headers2];

    // Opening balances
    const obRow: any[] = ["-", "-", "الرصيد الافتتاحي", "-", "-"];
    ACCOUNT_COLUMNS.forEach((col) => {
      const ob = state.openingBalances.find((b) => b.column === col.id);
      obRow.push(formatNum(ob?.debit || 0), formatNum(ob?.credit || 0));
    });
    rows.push(obRow);

    // Transactions
    filtered.forEach((tx, idx) => {
      const row: any[] = [idx + 1, tx.date, tx.description, TRANSACTION_TYPE_LABELS[tx.type], tx.checkNumber || "-"];
      ACCOUNT_COLUMNS.forEach((col) => {
        row.push(formatNum(tx.amounts[col.id]?.debit || 0), formatNum(tx.amounts[col.id]?.credit || 0));
      });
      rows.push(row);
    });

    // Totals
    const totRow: any[] = ["", "", "المجموع الكلي", "", ""];
    ACCOUNT_COLUMNS.forEach((col) => {
      const bal = getColumnBalance(col.id);
      totRow.push(formatNum(bal.debit), formatNum(bal.credit));
    });
    rows.push(totRow);

    // Net balance
    const netRow: any[] = ["", "", "الرصيد الجديد", "", ""];
    ACCOUNT_COLUMNS.forEach((col) => {
      const bal = getColumnBalance(col.id);
      const net = bal.debit - bal.credit;
      netRow.push(Math.abs(net), net >= 0 ? "مدين" : "دائن");
    });
    rows.push(netRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Merge header cells for account columns
    ws["!merges"] = ACCOUNT_COLUMNS.map((_, i) => ({
      s: { r: 0, c: 5 + i * 2 },
      e: { r: 0, c: 5 + i * 2 + 1 },
    }));
    ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 10 },
      ...ACCOUNT_COLUMNS.flatMap(() => [{ wch: 12 }, { wch: 12 }])];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "دفتر الصندوق");
    XLSX.writeFile(wb, `دفتر_الصندوق_${state.currentMonth}_${state.currentYear}.xlsx`);
  };

  const filtered = state.transactions
    .filter((t) => t.status === "active")
    .filter((t) => filterType === "all" || t.type === filterType)
    .filter((t) => t.description.includes(searchTerm) || t.referenceNumber.includes(searchTerm));

  const formatCurrency = (n: number) =>
    n === 0 ? "-" : n.toLocaleString("ar-JO", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

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
                    <th className="py-3 px-3 text-right border border-primary-foreground/30" rowSpan={2}>#</th>
                    <th className="py-3 px-3 text-right border border-primary-foreground/30" rowSpan={2}>التاريخ</th>
                    <th className="py-3 px-3 text-right border border-primary-foreground/30" rowSpan={2}>البيان</th>
                    <th className="py-3 px-3 text-center border border-primary-foreground/30" rowSpan={2}>النوع</th>
                    <th className="py-3 px-3 text-center border border-primary-foreground/30" rowSpan={2}>رقم الشيك</th>
                    {ACCOUNT_COLUMNS.map((col) => (
                      <th key={col.id} className="py-2 px-2 text-center border border-primary-foreground/30" colSpan={2}>
                        {col.label}
                      </th>
                    ))}
                    <th className="py-3 px-2 border border-primary-foreground/30" rowSpan={2}>إجراءات</th>
                  </tr>
                  <tr className="bg-primary/80 text-primary-foreground text-[10px]">
                    {ACCOUNT_COLUMNS.map((col) => (
                      <>
                        <th key={col.id + "-sub-d"} className="py-1.5 px-2 text-center border border-primary-foreground/30 min-w-[70px]">
                          {isAssetAccount(col.id) ? "منه" : "من"}
                        </th>
                        <th key={col.id + "-sub-c"} className="py-1.5 px-2 text-center border border-primary-foreground/30 min-w-[70px]">
                          {isAssetAccount(col.id) ? "له" : "الى"}
                        </th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  <tr className="bg-accent/20 font-semibold">
                    <td className="py-2.5 px-3 border border-border">-</td>
                    <td className="py-2.5 px-3 border border-border">-</td>
                    <td className="py-2.5 px-3 border border-border">الرصيد الافتتاحي</td>
                    <td className="py-2.5 px-3 text-center border border-border">-</td>
                    <td className="py-2.5 px-3 text-center border border-border">-</td>
                    {ACCOUNT_COLUMNS.map((col) => {
                      const ob = state.openingBalances.find((b) => b.column === col.id);
                      return (
                        <>
                          <td key={col.id + "-od"} className="py-2.5 px-2 text-center border border-border text-success">{formatCurrency(ob?.debit || 0)}</td>
                          <td key={col.id + "-oc"} className="py-2.5 px-2 text-center border border-border text-destructive">{formatCurrency(ob?.credit || 0)}</td>
                        </>
                      );
                    })}
                    <td className="border border-border"></td>
                  </tr>

                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5 + ACCOUNT_COLUMNS.length * 2 + 1} className="py-8 text-center text-muted-foreground border border-border">
                        لا توجد حركات
                      </td>
                    </tr>
                  ) : (
                    filtered.map((tx, idx) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 border border-border text-muted-foreground">{idx + 1}</td>
                        <td className="py-2.5 px-3 border border-border whitespace-nowrap">{tx.date}</td>
                        <td className="py-2.5 px-3 border border-border">{tx.description}</td>
                        <td className="py-2.5 px-3 text-center border border-border">
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
                        </td>
                        <td className="py-2.5 px-3 text-center border border-border text-xs">
                          {tx.checkNumber || "-"}
                        </td>
                        {ACCOUNT_COLUMNS.map((col) => (
                          <>
                            <td key={col.id + "-d"} className="py-2.5 px-2 text-center border border-border text-success">
                              {formatCurrency(tx.amounts[col.id]?.debit || 0)}
                            </td>
                            <td key={col.id + "-c"} className="py-2.5 px-2 text-center border border-border text-destructive">
                              {formatCurrency(tx.amounts[col.id]?.credit || 0)}
                            </td>
                          </>
                        ))}
                        <td className="py-2.5 px-2 border border-border">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPrintTx(tx)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            >
                              <Printer className="w-3.5 h-3.5" />
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
                    ))
                  )}

                  {/* Totals row */}
                  <tr className="bg-primary/5 font-bold">
                    <td colSpan={5} className="py-3 px-3 border border-border">المجموع الكلي</td>
                    {ACCOUNT_COLUMNS.map((col) => {
                      const bal = getColumnBalance(col.id);
                      return (
                        <>
                          <td key={col.id + "-td"} className="py-3 px-2 text-center border border-border text-success">{formatCurrency(bal.debit)}</td>
                          <td key={col.id + "-tc"} className="py-3 px-2 text-center border border-border text-destructive">{formatCurrency(bal.credit)}</td>
                        </>
                      );
                    })}
                    <td className="border border-border"></td>
                  </tr>

                  {/* New Balance row */}
                  <tr className="bg-accent/30 font-bold">
                    <td colSpan={5} className="py-3 px-3 border border-border text-accent-foreground">الرصيد الجديد (نهاية الشهر)</td>
                    {ACCOUNT_COLUMNS.map((col) => {
                      const bal = getColumnBalance(col.id);
                      const net = bal.debit - bal.credit;
                      return (
                        <td key={col.id + "-nd"} className="py-3 px-2 text-center border border-border font-bold" colSpan={2}>
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
        {printTx && (
          <PrintVoucher
            transaction={printTx}
            schoolName={state.schoolName}
            directorateName={state.directorateName}
            onClose={() => setPrintTx(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
