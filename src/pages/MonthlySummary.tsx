import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS } from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MonthlySummary() {
  const { state, getColumnBalance, getTotalBalance } = useFinance();
  const total = getTotalBalance();

  const formatCurrency = (n: number) =>
    n.toLocaleString("ar-JO", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">خلاصة الحسابات الشهرية</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {state.schoolName} - {state.currentMonth} {state.currentYear}
          </p>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="py-3 px-4 text-right" rowSpan={2}>الحساب</th>
                    <th className="py-2 px-4 text-center border-r border-primary-foreground/20" colSpan={2}>بداية الشهر</th>
                    <th className="py-2 px-4 text-center border-r border-primary-foreground/20" colSpan={2}>خلال الشهر</th>
                    <th className="py-2 px-4 text-center border-r border-primary-foreground/20" colSpan={2}>نهاية الشهر</th>
                  </tr>
                  <tr className="bg-primary/90 text-primary-foreground text-xs">
                    <th className="py-2 px-3 text-center border-r border-primary-foreground/20">المقبوض</th>
                    <th className="py-2 px-3 text-center">المدفوع</th>
                    <th className="py-2 px-3 text-center border-r border-primary-foreground/20">المقبوض</th>
                    <th className="py-2 px-3 text-center">المدفوع</th>
                    <th className="py-2 px-3 text-center border-r border-primary-foreground/20">المقبوض</th>
                    <th className="py-2 px-3 text-center">المدفوع</th>
                  </tr>
                </thead>
                <tbody>
                  {ACCOUNT_COLUMNS.map((col) => {
                    const ob = state.openingBalances.find((b) => b.column === col.id);
                    const openDebit = ob?.debit || 0;
                    const openCredit = ob?.credit || 0;

                    let duringDebit = 0;
                    let duringCredit = 0;
                    state.transactions
                      .filter((t) => t.status === "active")
                      .forEach((t) => {
                        duringDebit += t.amounts[col.id]?.debit || 0;
                        duringCredit += t.amounts[col.id]?.credit || 0;
                      });

                    const endDebit = openDebit + duringDebit;
                    const endCredit = openCredit + duringCredit;

                    return (
                      <tr key={col.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium">{col.label}</td>
                        <td className="py-3 px-3 text-center text-success">{formatCurrency(openDebit)}</td>
                        <td className="py-3 px-3 text-center text-destructive">{formatCurrency(openCredit)}</td>
                        <td className="py-3 px-3 text-center text-success">{formatCurrency(duringDebit)}</td>
                        <td className="py-3 px-3 text-center text-destructive">{formatCurrency(duringCredit)}</td>
                        <td className="py-3 px-3 text-center text-success font-semibold">{formatCurrency(endDebit)}</td>
                        <td className="py-3 px-3 text-center text-destructive font-semibold">{formatCurrency(endCredit)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-primary/5 font-bold border-t-2 border-primary">
                    <td className="py-3 px-4">المجموع</td>
                    <td className="py-3 px-3 text-center text-success">
                      {formatCurrency(state.openingBalances.reduce((s, b) => s + b.debit, 0))}
                    </td>
                    <td className="py-3 px-3 text-center text-destructive">
                      {formatCurrency(state.openingBalances.reduce((s, b) => s + b.credit, 0))}
                    </td>
                    <td className="py-3 px-3 text-center text-success">
                      {formatCurrency(
                        state.transactions.filter((t) => t.status === "active")
                          .reduce((s, t) => s + ACCOUNT_COLUMNS.reduce((cs, col) => cs + (t.amounts[col.id]?.debit || 0), 0), 0)
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-destructive">
                      {formatCurrency(
                        state.transactions.filter((t) => t.status === "active")
                          .reduce((s, t) => s + ACCOUNT_COLUMNS.reduce((cs, col) => cs + (t.amounts[col.id]?.credit || 0), 0), 0)
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-success font-bold">{formatCurrency(total.debit)}</td>
                    <td className="py-3 px-3 text-center text-destructive font-bold">{formatCurrency(total.credit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-muted/30">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-2">ملاحظات:</h3>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>يجب أن تساوي مجموع الأرصدة المدينة والدائنة في بداية كل شهر نهايته</li>
              <li>الرصيد في نهاية الشهر = الرصيد في بداية الشهر + المقبوض - المدفوع</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
