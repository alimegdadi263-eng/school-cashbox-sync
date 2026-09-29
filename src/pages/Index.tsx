import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, TRANSACTION_TYPE_LABELS } from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Archive, CalendarDays, ClipboardList, FileText, GraduationCap, Users, Wallet } from "lucide-react";

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

  const quickLinks = [
    { path: "/cashbook", label: "مالية المدرسة", detail: "الصندوق والحركات والتقارير", icon: Wallet },
    { path: "/timetable", label: "الجدول المدرسي", detail: "المعلمون والحصص والملحفة", icon: CalendarDays },
    { path: "/exams", label: "جداول الامتحانات", detail: "منتصف الفصل والنهائي", icon: GraduationCap },
    { path: "/secretary", label: "أعمال السكرتير", detail: "السجلات والنماذج الرسمية", icon: Archive },
    { path: "/student-absence", label: "غياب الطلبة", detail: "المتابعة والرسائل والتقارير", icon: ClipboardList },
    { path: "/committees", label: "اللجان المدرسية", detail: "التشكيل والقرارات والتصدير", icon: Users },
  ];

  return (
    <AppLayout>
      <div className="space-y-7">
        <div className="rounded-lg border border-accent/20 bg-primary px-6 py-5 text-primary-foreground shadow-card sm:flex sm:items-center sm:justify-between">
          <div>
          <p className="mb-1 text-xs font-bold text-accent">لوحة الإدارة</p>
          <h1 className="text-2xl font-bold md:text-3xl">{state.schoolName || "الإدارة المدرسية"}</h1>
          <p className="mt-1 text-sm text-primary-foreground/70">
            {state.currentMonth} - {state.currentYear}
          </p>
          </div>
          <p className="mt-3 text-sm text-primary-foreground/75 sm:mt-0">مرحباً بك، اختر القسم الذي تريد العمل عليه</p>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary">الأقسام الرئيسية</h2>
            <span className="text-xs text-muted-foreground">وصول سريع</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickLinks.map(({ path, label, detail, icon: Icon }) => (
              <Link key={path} to={path}>
                <Card className="group h-full border-border border-t-2 border-t-accent/70 shadow-card transition-colors hover:border-primary/35">
                  <CardContent className="flex min-h-32 flex-col justify-between p-5">
                    <div className="flex items-start justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/15 bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-5 w-5" /></span>
                      <ArrowLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-accent" />
                    </div>
                    <div className="mt-5"><h3 className="font-bold text-primary">{label}</h3><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
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
