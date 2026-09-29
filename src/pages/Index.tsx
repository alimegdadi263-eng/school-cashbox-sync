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
    { path: "/cashbook", label: "مالية المدرسة", detail: "الصندوق والحركات والتقارير", icon: Wallet, className: "md:col-span-2" },
    { path: "/timetable", label: "الجدول المدرسي", detail: "المعلمين والحصص والملحفة", icon: CalendarDays, className: "" },
    { path: "/exams", label: "جداول الامتحانات", detail: "منتصف الفصل والنهائي", icon: GraduationCap, className: "" },
    { path: "/secretary", label: "أعمال السكرتير", detail: "السجلات والنماذج الرسمية", icon: Archive, className: "" },
    { path: "/student-absence", label: "غياب الطلبة", detail: "المتابعة والرسائل والتقارير", icon: ClipboardList, className: "md:col-span-2" },
    { path: "/committees", label: "اللجان المدرسية", detail: "التشكيل والقرارات والتصدير", icon: Users, className: "" },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-2 border-b border-primary/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
          <p className="mb-2 text-xs font-bold text-accent">لوحة الإدارة</p>
          <h1 className="text-2xl font-bold text-primary md:text-3xl">{state.schoolName || "الإدارة المدرسية"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.currentMonth} - {state.currentYear}
          </p>
          </div>
          <p className="text-sm text-muted-foreground">مرحباً بك، اختر القسم الذي تريد العمل عليه</p>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary">الأقسام الرئيسية</h2>
            <span className="text-xs text-muted-foreground">وصول سريع</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {quickLinks.map(({ path, label, detail, icon: Icon, className }) => (
              <Link key={path} to={path} className={className}>
                <Card className="group h-full border-primary/10 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-accent/60 hover:shadow-card-hover">
                  <CardContent className="flex min-h-36 flex-col justify-between p-5">
                    <div className="flex items-start justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-5 w-5" /></span>
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
