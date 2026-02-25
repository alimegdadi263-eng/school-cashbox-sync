import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, TRANSACTION_TYPE_LABELS, Transaction } from "@/types/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import PrintVoucher from "@/components/PrintVoucher";

export default function CashBook() {
  const { state, getColumnBalance, deleteTransaction } = useFinance();
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [printTx, setPrintTx] = useState<Transaction | null>(null);

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
          <div className="flex gap-3">
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
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="py-3 px-2 text-right" rowSpan={2}>#</th>
                    <th className="py-3 px-2 text-right" rowSpan={2}>التاريخ</th>
                    <th className="py-3 px-2 text-right" rowSpan={2}>البيان</th>
                    <th className="py-3 px-2 text-center" rowSpan={2}>النوع</th>
                    <th className="py-3 px-2 text-center" rowSpan={2}>رقم الشيك</th>
                    {ACCOUNT_COLUMNS.map((col) => (
                      <th key={col.id} className="py-2 px-1 text-center border-r border-primary-foreground/20" colSpan={2}>
                        {col.label}
                      </th>
                    ))}
                    <th className="py-3 px-2" rowSpan={2}></th>
                  </tr>
                  <tr className="bg-primary/80 text-primary-foreground text-[10px]">
                    {ACCOUNT_COLUMNS.map((col) => (
                      <th key={col.id + "-sub"} className="py-1 px-1 text-center border-r border-primary-foreground/20" colSpan={2}>
                        <span className="inline-flex gap-2">
                          <span>من</span>
                          <span>|</span>
                          <span>الى</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  <tr className="bg-accent/20 font-semibold border-b-2 border-accent">
                    <td className="py-2 px-2">-</td>
                    <td className="py-2 px-2">-</td>
                    <td className="py-2 px-2">الرصيد الافتتاحي</td>
                    <td className="py-2 px-2 text-center">-</td>
                    <td className="py-2 px-2 text-center">-</td>
                    {ACCOUNT_COLUMNS.map((col) => {
                      const ob = state.openingBalances.find((b) => b.column === col.id);
                      return (
                        <>
                          <td key={col.id + "-od"} className="py-2 px-1 text-center text-success">{formatCurrency(ob?.debit || 0)}</td>
                          <td key={col.id + "-oc"} className="py-2 px-1 text-center text-destructive">{formatCurrency(ob?.credit || 0)}</td>
                        </>
                      );
                    })}
                    <td></td>
                  </tr>

                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5 + ACCOUNT_COLUMNS.length * 2 + 1} className="py-8 text-center text-muted-foreground">
                        لا توجد حركات
                      </td>
                    </tr>
                  ) : (
                    filtered.map((tx, idx) => (
                      <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{tx.date}</td>
                        <td className="py-2 px-2">{tx.description}</td>
                        <td className="py-2 px-2 text-center">
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
                        <td className="py-2 px-2 text-center text-xs">
                          {tx.checkNumber || "-"}
                        </td>
                        {ACCOUNT_COLUMNS.map((col) => (
                          <>
                            <td key={col.id + "-d"} className="py-2 px-1 text-center text-success">
                              {formatCurrency(tx.amounts[col.id]?.debit || 0)}
                            </td>
                            <td key={col.id + "-c"} className="py-2 px-1 text-center text-destructive">
                              {formatCurrency(tx.amounts[col.id]?.credit || 0)}
                            </td>
                          </>
                        ))}
                        <td className="py-2 px-2 flex gap-1">
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
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Totals row */}
                  <tr className="bg-primary/5 font-bold border-t-2 border-primary">
                    <td colSpan={5} className="py-3 px-2">المجموع الكلي</td>
                    {ACCOUNT_COLUMNS.map((col) => {
                      const bal = getColumnBalance(col.id);
                      return (
                        <>
                          <td key={col.id + "-td"} className="py-3 px-1 text-center text-success">{formatCurrency(bal.debit)}</td>
                          <td key={col.id + "-tc"} className="py-3 px-1 text-center text-destructive">{formatCurrency(bal.credit)}</td>
                        </>
                      );
                    })}
                    <td></td>
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
            onClose={() => setPrintTx(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
