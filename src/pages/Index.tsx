import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, TRANSACTION_TYPE_LABELS } from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, FileText, Wallet } from "lucide-react";

export default function Dashboard() {
  const { state, getColumnBalance, getTotalBalance } = useFinance();
  const total = getTotalBalance();

  const recentTransactions = [...state.transactions]
    .filter((t) => t.status === "active")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const receiptCount = state.transactions.filter((t) => t.type === "receipt" && t.status === "active").length;
  const paymentCount = state.transactions.filter((t) => t.type === "payment" && t.status === "active").length;
  const journalCount = state.transactions.filter((t) => t.type === "journal" && t.status === "active").length;

  const formatCurrency = (n: number) =>
    n.toLocaleString("ar-JO", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{state.schoolName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {state.currentMonth} - {state.currentYear}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">إجمالي المقبوضات</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(total.debit)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <ArrowDownCircle className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">إجمالي المدفوعات</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(total.credit)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <ArrowUpCircle className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">صافي الرصيد</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(total.net)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">عدد الحركات</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{state.transactions.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-journal/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-journal" />
                </div>
              </div>
              <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                <span>قبض: {receiptCount}</span>
                <span>صرف: {paymentCount}</span>
                <span>قيد: {journalCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Balances */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">أرصدة الحسابات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground">الحساب</th>
                    <th className="text-center py-3 px-3 font-semibold text-success">المقبوض (من)</th>
                    <th className="text-center py-3 px-3 font-semibold text-destructive">المدفوع (الى)</th>
                    <th className="text-center py-3 px-3 font-semibold text-foreground">الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {ACCOUNT_COLUMNS.map((col) => {
                    const bal = getColumnBalance(col.id);
                    return (
                      <tr key={col.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-3 font-medium">{col.label}</td>
                        <td className="py-3 px-3 text-center text-success">{formatCurrency(bal.debit)}</td>
                        <td className="py-3 px-3 text-center text-destructive">{formatCurrency(bal.credit)}</td>
                        <td className="py-3 px-3 text-center font-bold">{formatCurrency(bal.net)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-primary/5 font-bold">
                    <td className="py-3 px-3">المجموع</td>
                    <td className="py-3 px-3 text-center text-success">{formatCurrency(total.debit)}</td>
                    <td className="py-3 px-3 text-center text-destructive">{formatCurrency(total.credit)}</td>
                    <td className="py-3 px-3 text-center">{formatCurrency(total.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">آخر الحركات</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">لا توجد حركات بعد</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        tx.type === "receipt" ? "bg-success" : tx.type === "payment" ? "bg-destructive" : "bg-journal"
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{tx.date} • {TRANSACTION_TYPE_LABELS[tx.type]}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{tx.referenceNumber}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
