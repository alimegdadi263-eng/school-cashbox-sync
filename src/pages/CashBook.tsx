import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, TRANSACTION_TYPE_LABELS } from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
                    {ACCOUNT_COLUMNS.map((col) => (
                      <th key={col.id} className="py-2 px-1 text-center border-r border-primary-foreground/20" colSpan={2}>
                        {col.label}
                      </th>
                    ))}
                    <th className="py-3 px-2" rowSpan={2}></th>
                  </tr>
                  <tr className="bg-primary/90 text-primary-foreground">
                    {ACCOUNT_COLUMNS.map((col) => (
                      <th key={col.id + "-sub"} className="py-1 px-1 text-center border-r border-primary-foreground/20" colSpan={1}>
                        {/* We split the header into two separate th for من and الى */}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-primary/80 text-primary-foreground text-[10px]">
                    <th colSpan={4}></th>
                    {ACCOUNT_COLUMNS.map((col) => (
                      <>
                        <th key={col.id + "-d"} className="py-1 px-1 text-center border-r border-primary-foreground/20">من</th>
                        <th key={col.id + "-c"} className="py-1 px-1 text-center">الى</th>
                      </>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  <tr className="bg-accent/20 font-semibold border-b-2 border-accent">
                    <td className="py-2 px-2">-</td>
                    <td className="py-2 px-2">-</td>
                    <td className="py-2 px-2">الرصيد الافتتاحي</td>
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
                      <td colSpan={4 + ACCOUNT_COLUMNS.length * 2 + 1} className="py-8 text-center text-muted-foreground">
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
                              : "bg-journal/10 text-journal"
                          }`}>
                            {TRANSACTION_TYPE_LABELS[tx.type]}
                          </span>
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
                        <td className="py-2 px-2">
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
                    <td colSpan={4} className="py-3 px-2">المجموع الكلي</td>
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
      </div>
    </AppLayout>
  );
}
