import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, OpeningBalance } from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import NetworkModeSelector from "@/components/NetworkModeSelector";
import { Clock, RefreshCw, Download, CheckCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function SettingsPage() {
  const { state, setOpeningBalances, updateSettings } = useFinance();
  const { toast } = useToast();
  const { subscriptionExpiresAt, isAdmin } = useAuth();

  const daysLeft = subscriptionExpiresAt
    ? Math.max(0, Math.ceil((new Date(subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const [schoolName, setSchoolName] = useState(state.schoolName);
  const [directorateName, setDirectorateName] = useState(state.directorateName);
  const [directorName, setDirectorName] = useState(state.directorName || "");
  const [member1Name, setMember1Name] = useState(state.member1Name || "");
  const [member2Name, setMember2Name] = useState(state.member2Name || "");
  const [month, setMonth] = useState(state.currentMonth);
  const [year, setYear] = useState(state.currentYear);
  const [balances, setBalances] = useState<OpeningBalance[]>([...state.openingBalances]);

  // Auto-update state
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.checkForUpdates;
  const [updateStatus, setUpdateStatus] = useState<string>('idle');
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState<number>(0);

  useEffect(() => {
    if (!isElectron) return;
    const api = (window as any).electronAPI;
    api.onUpdateStatus?.((data: { status: string; version?: string; progress?: number }) => {
      setUpdateStatus(data.status);
      if (data.version) setUpdateVersion(data.version);
      if (data.progress !== undefined) setUpdateProgress(data.progress);
    });
  }, [isElectron]);

  const updateBalance = (colId: string, field: "debit" | "credit", value: string) => {
    const num = parseFloat(value) || 0;
    setBalances((prev) =>
      prev.map((b) => (b.column === colId ? { ...b, [field]: num } : b))
    );
  };

  const handleSave = () => {
    setOpeningBalances(balances);
    updateSettings({ schoolName, directorateName, directorName, member1Name, member2Name, month, year });
    toast({ title: "تم الحفظ", description: "تم حفظ الإعدادات بنجاح" });
  };

  const months = [
    "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
    "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول",
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>

        {/* Password & Subscription */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">الحساب والأمان</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">تغيير كلمة المرور</span>
              <ChangePasswordDialog />
            </div>
            {!isAdmin && subscriptionExpiresAt && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">مدة الاشتراك المتبقية:</span>
                  <span className={`font-semibold text-sm ${daysLeft !== null && daysLeft <= 30 ? "text-destructive" : "text-foreground"}`}>
                    {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} يوم` : "منتهي") : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>بداية الاشتراك: <strong className="text-foreground">{new Date(new Date(subscriptionExpiresAt).getTime() - 365 * 24 * 60 * 60 * 1000).toLocaleDateString("ar-EG")}</strong></span>
                  <span>نهاية الاشتراك: <strong className="text-foreground">{new Date(subscriptionExpiresAt).toLocaleDateString("ar-EG")}</strong></span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-Update Section */}
        {isElectron && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="w-5 h-5" />
                تحديث البرنامج
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {updateStatus === 'checking' && 'جاري التحقق من التحديثات...'}
                    {updateStatus === 'available' && `يتوفر إصدار جديد: ${updateVersion}`}
                    {updateStatus === 'not-available' && 'البرنامج محدّث بالفعل ✓'}
                    {updateStatus === 'downloading' && `جاري تحميل التحديث... ${updateProgress}%`}
                    {updateStatus === 'downloaded' && `تم تحميل الإصدار ${updateVersion} — أعد التشغيل للتثبيت`}
                    {updateStatus === 'error' && 'حدث خطأ أثناء التحقق من التحديثات'}
                    {updateStatus === 'idle' && 'تحقق من وجود تحديثات جديدة'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                  onClick={() => {
                    const api = (window as any).electronAPI;
                    if (api?.runUpdateAction) {
                      api.runUpdateAction();
                      return;
                    }
                    api?.checkForUpdates?.();
                  }}
                >
                  {updateStatus === 'checking' || updateStatus === 'downloading' ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  ) : updateStatus === 'not-available' || updateStatus === 'downloaded' ? (
                    <CheckCircle className="w-4 h-4 ml-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 ml-2" />
                  )}
                  {updateStatus === 'available' ? 'تحميل التحديث' : updateStatus === 'downloaded' ? 'تثبيت التحديث' : 'تحقق من التحديثات'}
                </Button>
              </div>
              {updateStatus === 'downloading' && (
                <Progress value={updateProgress} className="h-2" />
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">معلومات المدرسة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المدرسة</Label>
              <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>المركز (اسم المديرية)</Label>
              <Input value={directorateName} onChange={(e) => setDirectorateName(e.target.value)} placeholder="مثال: مديرية التربية والتعليم لمنطقة..." />
            </div>
            <div className="space-y-2">
              <Label>اسم مدير المدرسة</Label>
              <Input value={directorName} onChange={(e) => setDirectorName(e.target.value)} placeholder="اسم المدير" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>عضو لجنة مالية 1</Label>
                <Input value={member1Name} onChange={(e) => setMember1Name(e.target.value)} placeholder="اسم العضو الأول" />
              </div>
              <div className="space-y-2">
                <Label>عضو لجنة مالية 2</Label>
                <Input value={member2Name} onChange={(e) => setMember2Name(e.target.value)} placeholder="اسم العضو الثاني" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الشهر</Label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>السنة</Label>
                <Input value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">الأرصدة الافتتاحية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ACCOUNT_COLUMNS.map((col) => {
                const bal = balances.find((b) => b.column === col.id);
                return (
                  <div key={col.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <span className="w-32 text-sm font-medium">{col.label}</span>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] text-success">من (مدين)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={bal?.debit || ""}
                          onChange={(e) => updateBalance(col.id, "debit", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="0.000"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-destructive">الى (دائن)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={bal?.credit || ""}
                          onChange={(e) => updateBalance(col.id, "credit", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="0.000"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="gradient-accent text-accent-foreground px-8">
          حفظ الإعدادات
        </Button>
      </div>
    </AppLayout>
  );
}
