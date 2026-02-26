import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, AccountColumnId } from "@/types/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Download } from "lucide-react";
import { generateMonthlySummaryDocx } from "@/lib/generateMonthlySummaryDocx";
import { exportMonthlySummaryExcel } from "@/lib/exportMonthlySummaryExcel";

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

function getAccountData(state: any, colId: string) {
  const exists = ACCOUNT_COLUMNS.some(c => c.id === colId);
  if (!exists) return { openDebit: 0, openCredit: 0, duringDebit: 0, duringCredit: 0, endDebit: 0, endCredit: 0 };
  const ob = state.openingBalances.find((b: any) => b.column === colId as AccountColumnId);
  const openDebit = ob?.debit || 0;
  const openCredit = ob?.credit || 0;
  let duringDebit = 0;
  let duringCredit = 0;
  state.transactions.filter((t: any) => t.status === "active").forEach((t: any) => {
    duringDebit += t.amounts[colId as AccountColumnId]?.debit || 0;
    duringCredit += t.amounts[colId as AccountColumnId]?.credit || 0;
  });
  // Net = (openDebit - openCredit) + (duringDebit - duringCredit)
  const net = (openDebit - openCredit) + (duringDebit - duringCredit);
  const endDebit = net > 0 ? net : 0;
  const endCredit = net < 0 ? Math.abs(net) : 0;
  return { openDebit, openCredit, duringDebit, duringCredit, endDebit, endCredit };
}

function splitDinarFils(value: number): [string, string] {
  if (value === 0) return ["-", "-"];
  const abs = Math.abs(value);
  const dinar = Math.floor(abs);
  const fils = Math.round((abs - dinar) * 1000);
  return [dinar.toLocaleString("ar-JO"), fils.toString().padStart(3, "0")];
}

export default function MonthlySummary() {
  const { state } = useFinance();

  const allData = SUMMARY_ROWS.map(row => ({ ...row, data: getAccountData(state, row.id) }));

  const totals = allData.reduce((acc, r) => {
    const isAdvances = r.id === "advances";
    const receipt = isAdvances ? r.data.duringDebit : r.data.duringCredit;
    const payment = isAdvances ? r.data.duringCredit : r.data.duringDebit;
    return {
      openDebit: acc.openDebit + r.data.openDebit,
      openCredit: acc.openCredit + r.data.openCredit,
      duringReceipt: acc.duringReceipt + receipt,
      duringPayment: acc.duringPayment + payment,
      endDebit: acc.endDebit + r.data.endDebit,
      endCredit: acc.endCredit + r.data.endCredit,
    };
  }, { openDebit: 0, openCredit: 0, duringReceipt: 0, duringPayment: 0, endDebit: 0, endCredit: 0 });

  const cellClass = "py-2 px-2 text-center border border-border text-xs";
  const headerClass = "py-2 px-2 text-center border border-primary-foreground/20";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">خلاصة الحسابات الشهرية</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {state.schoolName} - {state.currentMonth} {state.currentYear}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportMonthlySummaryExcel(state)} className="gap-2">
              <Download className="h-4 w-4" />
              تصدير Excel
            </Button>
            <Button onClick={() => generateMonthlySummaryDocx(state)} className="gap-2">
              <FileDown className="h-4 w-4" />
              تصدير Word
            </Button>
          </div>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  {/* Row 1: Main groups */}
                  <tr className="bg-primary text-primary-foreground">
                    <th className={headerClass} rowSpan={3} style={{ minWidth: 120 }}>الحساب</th>
                    <th className={headerClass} colSpan={4}>الرصيد المدور في بداية كل شهر</th>
                    <th className={headerClass} colSpan={2}>المقبوضات خلال الشهر</th>
                    <th className={headerClass} colSpan={2}>المدفوع خلال الشهر</th>
                    <th className={headerClass} colSpan={4}>الرصيد المدور في نهاية الشهر</th>
                  </tr>
                  {/* Row 2: من / إلى */}
                  <tr className="bg-primary/90 text-primary-foreground text-xs">
                    <th className={headerClass} colSpan={2}>من</th>
                    <th className={headerClass} colSpan={2}>إلى</th>
                    <th className={headerClass} colSpan={2}>من</th>
                    <th className={headerClass} colSpan={2}>إلى</th>
                    <th className={headerClass} colSpan={2}>من</th>
                    <th className={headerClass} colSpan={2}>إلى</th>
                  </tr>
                  {/* Row 3: دينار / فلس */}
                  <tr className="bg-primary/80 text-primary-foreground text-[10px]">
                    <th className={headerClass}>دينار</th>
                    <th className={headerClass}>فلس</th>
                    <th className={headerClass}>دينار</th>
                    <th className={headerClass}>فلس</th>
                    <th className={headerClass}>دينار</th>
                    <th className={headerClass}>فلس</th>
                    <th className={headerClass}>دينار</th>
                    <th className={headerClass}>فلس</th>
                    <th className={headerClass}>دينار</th>
                    <th className={headerClass}>فلس</th>
                    <th className={headerClass}>دينار</th>
                    <th className={headerClass}>فلس</th>
                  </tr>
                </thead>
                <tbody>
                  {allData.map((item) => {
                    const d = item.data;
                    const [odD, odF] = splitDinarFils(d.openDebit);
                    const [ocD, ocF] = splitDinarFils(d.openCredit);
                    // For all accounts except advances: مقبوضات=credit, مدفوع=debit
                    const isAdvances = item.id === "advances";
                    const receiptVal = isAdvances ? d.duringDebit : d.duringCredit;
                    const paymentVal = isAdvances ? d.duringCredit : d.duringDebit;
                    const [ddD, ddF] = splitDinarFils(receiptVal);
                    const [dcD, dcF] = splitDinarFils(paymentVal);
                    const [edD, edF] = splitDinarFils(d.endDebit);
                    const [ecD, ecF] = splitDinarFils(d.endCredit);
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 font-medium border border-border text-right">{item.label}</td>
                        <td className={cellClass}>{odD}</td>
                        <td className={cellClass}>{odF}</td>
                        <td className={cellClass}>{ocD}</td>
                        <td className={cellClass}>{ocF}</td>
                        <td className={cellClass}>{ddD}</td>
                        <td className={cellClass}>{ddF}</td>
                        <td className={cellClass}>{dcD}</td>
                        <td className={cellClass}>{dcF}</td>
                        <td className={`${cellClass} font-semibold`}>{edD}</td>
                        <td className={`${cellClass} font-semibold`}>{edF}</td>
                        <td className={`${cellClass} font-semibold`}>{ecD}</td>
                        <td className={`${cellClass} font-semibold`}>{ecF}</td>
                      </tr>
                    );
                  })}
                  {/* Totals */}
                  <tr className="bg-primary/5 font-bold border-t-2 border-primary">
                    <td className="py-2 px-3 border border-border text-right">المجموع</td>
                    {(() => {
                      const [todD, todF] = splitDinarFils(totals.openDebit);
                      const [tocD, tocF] = splitDinarFils(totals.openCredit);
                      const [tddD, tddF] = splitDinarFils(totals.duringReceipt);
                      const [tdcD, tdcF] = splitDinarFils(totals.duringPayment);
                      const [tedD, tedF] = splitDinarFils(totals.endDebit);
                      const [tecD, tecF] = splitDinarFils(totals.endCredit);
                      return (
                        <>
                          <td className={cellClass}>{todD}</td><td className={cellClass}>{todF}</td>
                          <td className={cellClass}>{tocD}</td><td className={cellClass}>{tocF}</td>
                          <td className={cellClass}>{tddD}</td><td className={cellClass}>{tddF}</td>
                          <td className={cellClass}>{tdcD}</td><td className={cellClass}>{tdcF}</td>
                          <td className={cellClass}>{tedD}</td><td className={cellClass}>{tedF}</td>
                          <td className={cellClass}>{tecD}</td><td className={cellClass}>{tecF}</td>
                        </>
                      );
                    })()}
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
              <li>يجب أن تساوي مجموع الأرصدة المدينة والدائنة في بداية كل شهر</li>
              <li>يجب تحقيق المعادلة التالية: الرصيد في نهاية الشهر = الرصيد في بداية الشهر + المقبوض - المدفوع</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
