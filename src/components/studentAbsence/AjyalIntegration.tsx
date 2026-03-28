import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, LogIn, Send, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, Info, Download, Users, Trash2 } from "lucide-react";
import type { StudentInfo, StudentAbsenceRecord } from "@/types/studentAbsence";
import { STUDENT_STORAGE_KEY, STUDENTS_LIST_KEY } from "@/types/studentAbsence";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const AJYAL_CREDS_KEY = "ajyal_credentials";

type LoginMethod = "credentials" | "sanad";

interface AjyalCredentials {
  username: string;
  password: string;
  loginMethod: LoginMethod;
}

interface Props {
  userId: string;
  schoolName: string;
}

function getElectronAjyal() {
  return (window as any)?.electronAPI?.ajyal;
}

export default function AjyalIntegration({ userId, schoolName }: Props) {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<AjyalCredentials>({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ done: 0, total: 0 });
  const [todayAbsences, setTodayAbsences] = useState<StudentAbsenceRecord[]>([]);
  const [importedStudents, setImportedStudents] = useState<StudentInfo[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState("absence");

  const isElectron = !!getElectronAjyal();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${AJYAL_CREDS_KEY}_${userId}`);
      if (saved) setCredentials(JSON.parse(saved));
    } catch {}
  }, [userId]);

  useEffect(() => {
    try {
      const absenceKey = `${STUDENT_STORAGE_KEY}_${userId}`;
      const saved = localStorage.getItem(absenceKey);
      if (saved) {
        const allRecords: StudentAbsenceRecord[] = JSON.parse(saved);
        const today = format(new Date(), "yyyy/MM/dd");
        setTodayAbsences(allRecords.filter(r => r.date === today));
      }
    } catch {}
  }, [userId]);

  const saveCredentials = () => {
    localStorage.setItem(`${AJYAL_CREDS_KEY}_${userId}`, JSON.stringify(credentials));
    toast({ title: "تم حفظ بيانات الدخول" });
  };

  const openAjyalWindow = async () => {
    const ajyal = getElectronAjyal();
    if (!ajyal) {
      toast({ title: "هذه الميزة متاحة فقط في نسخة سطح المكتب", variant: "destructive" });
      return;
    }
    if (!credentials.username || !credentials.password) {
      toast({ title: "أدخل اسم المستخدم وكلمة المرور أولاً", variant: "destructive" });
      return;
    }
    saveCredentials();
    try {
      const result = await ajyal.openWindow(credentials.username, credentials.password);
      if (result?.success) {
        setIsWindowOpen(true);
        toast({ title: "تم فتح نافذة أجيال", description: "أدخل رمز OTP يدوياً ثم اضغط 'تأكيد تسجيل الدخول'" });
      } else {
        toast({ title: "فشل فتح النافذة", description: result?.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const confirmLogin = async () => {
    const ajyal = getElectronAjyal();
    if (!ajyal) return;
    try {
      const result = await ajyal.checkLogin();
      if (result?.loggedIn) {
        setIsLoggedIn(true);
        toast({ title: "تم تأكيد تسجيل الدخول بنجاح ✓" });
      } else {
        toast({ title: "لم يتم تسجيل الدخول بعد", description: "أدخل رمز OTP وأكمل تسجيل الدخول أولاً", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const submitAbsences = async () => {
    const ajyal = getElectronAjyal();
    if (!ajyal) return;
    if (todayAbsences.length === 0) {
      toast({ title: "لا يوجد غياب مسجل لهذا اليوم", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setSubmitProgress({ done: 0, total: todayAbsences.length });
    try {
      for (let i = 0; i < todayAbsences.length; i++) {
        const record = todayAbsences[i];
        const result = await ajyal.submitAbsence({
          studentName: record.studentName,
          className: record.className,
          date: record.date,
        });
        setSubmitProgress({ done: i + 1, total: todayAbsences.length });
        if (!result?.success) {
          toast({ title: `فشل تسجيل غياب: ${record.studentName}`, description: result?.error || "خطأ غير معروف", variant: "destructive" });
        }
        if (i < todayAbsences.length - 1) await new Promise(r => setTimeout(r, 1500));
      }
      toast({ title: `تم تسجيل ${todayAbsences.length} غياب في أجيال ✓` });
    } catch (err: any) {
      toast({ title: "خطأ في التسجيل", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const importStudentsFromAjyal = async () => {
    const ajyal = getElectronAjyal();
    if (!ajyal) {
      toast({ title: "هذه الميزة متاحة فقط في نسخة سطح المكتب", variant: "destructive" });
      return;
    }
    if (!isLoggedIn) {
      toast({ title: "سجّل الدخول في أجيال أولاً", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    try {
      const result = await ajyal.importStudents();
      if (result?.success && result.students?.length > 0) {
        const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const mapped: StudentInfo[] = result.students.map((s: any) => ({
          id: generateId(),
          name: s.name || "",
          className: s.className || "",
          parentPhone: s.parentPhone || "",
          parentName: s.parentName || "",
        }));
        setImportedStudents(mapped);
        toast({ title: `تم استيراد ${mapped.length} طالب من أجيال` });
      } else {
        toast({
          title: "لم يتم العثور على طلاب",
          description: result?.error || "تأكد أنك في صفحة قائمة الطلاب في أجيال",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "خطأ في الاستيراد", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const saveImportedStudents = () => {
    if (importedStudents.length === 0) return;
    const storageKey = `${STUDENTS_LIST_KEY}_${userId}`;
    const existing: StudentInfo[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
    // Merge: don't duplicate by name+class
    const existingSet = new Set(existing.map(s => `${s.name}||${s.className}`));
    const newStudents = importedStudents.filter(s => !existingSet.has(`${s.name}||${s.className}`));
    const merged = [...existing, ...newStudents];
    localStorage.setItem(storageKey, JSON.stringify(merged));
    toast({ title: `تم حفظ ${newStudents.length} طالب جديد (تم تجاهل ${importedStudents.length - newStudents.length} مكرر)` });
    setImportedStudents([]);
  };

  const closeAjyalWindow = async () => {
    const ajyal = getElectronAjyal();
    if (ajyal) await ajyal.closeWindow();
    setIsWindowOpen(false);
    setIsLoggedIn(false);
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>ربط منصة أجيال</AlertTitle>
        <AlertDescription className="text-sm space-y-2">
          <p>سجّل الدخول بحساب المدير لتتمكن من تعبئة الغياب تلقائياً واستيراد بيانات الطلاب.</p>
          <ol className="list-decimal list-inside space-y-1 mr-2">
            <li>أدخل بيانات حساب أجيال (المدير) أدناه</li>
            <li>اضغط "فتح أجيال وتسجيل الدخول"</li>
            <li>أدخل رمز OTP يدوياً في النافذة المفتوحة</li>
            <li>اضغط "تأكيد تسجيل الدخول"</li>
          </ol>
        </AlertDescription>
      </Alert>

      {!isElectron && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>غير متاح</AlertTitle>
          <AlertDescription>هذه الميزة متاحة فقط في نسخة سطح المكتب (Electron).</AlertDescription>
        </Alert>
      )}

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LogIn className="w-5 h-5" />
            بيانات حساب أجيال
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>اسم المستخدم (رقم الموظف)</Label>
              <Input value={credentials.username} onChange={e => setCredentials(c => ({ ...c, username: e.target.value }))} placeholder="أدخل اسم المستخدم" disabled={isWindowOpen} />
            </div>
            <div className="space-y-1">
              <Label>كلمة المرور</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={credentials.password} onChange={e => setCredentials(c => ({ ...c, password: e.target.value }))} placeholder="أدخل كلمة المرور" disabled={isWindowOpen} />
                <Button type="button" variant="ghost" size="icon" className="absolute left-1 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isWindowOpen ? (
              <Button onClick={openAjyalWindow} disabled={!isElectron || !credentials.username || !credentials.password}>
                <ExternalLink className="w-4 h-4 ml-2" />
                فتح أجيال وتسجيل الدخول
              </Button>
            ) : (
              <>
                {!isLoggedIn && (
                  <Button onClick={confirmLogin} variant="secondary">
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                    تأكيد تسجيل الدخول (بعد OTP)
                  </Button>
                )}
                <Button onClick={closeAjyalWindow} variant="outline">إغلاق نافذة أجيال</Button>
              </>
            )}
          </div>

          {isWindowOpen && (
            <div className="flex items-center gap-2">
              <Badge variant={isLoggedIn ? "default" : "secondary"}>
                {isLoggedIn ? "✓ متصل بأجيال" : "⏳ بانتظار تسجيل الدخول..."}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features Tabs */}
      {isLoggedIn && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="absence" className="flex items-center gap-1">
              <Send className="w-4 h-4" />
              تعبئة الغياب
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              استيراد الطلاب
            </TabsTrigger>
          </TabsList>

          <TabsContent value="absence">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  تعبئة غياب اليوم في أجيال
                  <Badge variant="outline" className="mr-2">{todayAbsences.length} طالب</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayAbsences.length === 0 ? (
                  <p className="text-muted-foreground text-sm">لا يوجد غياب مسجل لهذا اليوم. سجّل الغياب أولاً من تبويب "الرصد اليومي".</p>
                ) : (
                  <>
                    <div className="border rounded-lg p-3 bg-muted/30 max-h-48 overflow-y-auto">
                      <p className="font-semibold mb-2 text-sm">الطلاب الغائبون اليوم:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                        {todayAbsences.map(r => (
                          <div key={r.id} className="text-xs border rounded p-1.5 bg-background">
                            <span className="font-medium">{r.studentName}</span>
                            <span className="text-muted-foreground"> - {r.className}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button onClick={submitAbsences} disabled={isSubmitting} className="w-full" size="lg">
                      {isSubmitting ? (
                        <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري التعبئة... ({submitProgress.done}/{submitProgress.total})</>
                      ) : (
                        <><Send className="w-4 h-4 ml-2" />تعبئة الغياب تلقائياً ({todayAbsences.length} طالب)</>
                      )}
                    </Button>
                  </>
                )}
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>ملاحظة:</strong> تأكد أنك في صفحة تسجيل الغياب في أجيال قبل الضغط على "تعبئة تلقائية".
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  استيراد بيانات الطلاب من أجيال
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <p>انتقل إلى صفحة <strong>قائمة الطلاب</strong> في منصة أجيال، ثم اضغط الزر أدناه لاستيراد البيانات تلقائياً.</p>
                    <p className="text-xs text-muted-foreground mt-1">سيتم استيراد: اسم الطالب، الصف والشعبة، ورقم ولي الأمر (إن وُجد).</p>
                  </AlertDescription>
                </Alert>

                <Button onClick={importStudentsFromAjyal} disabled={isImporting} className="w-full" size="lg">
                  {isImporting ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري الاستيراد...</>
                  ) : (
                    <><Download className="w-4 h-4 ml-2" />استيراد الطلاب من أجيال</>
                  )}
                </Button>

                {importedStudents.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        تم استيراد {importedStudents.length} طالب
                      </h3>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveImportedStudents}>
                          <CheckCircle2 className="w-4 h-4 ml-1" />
                          حفظ في النظام
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setImportedStudents([])}>
                          <Trash2 className="w-4 h-4 ml-1" />
                          تجاهل
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center w-10">م</TableHead>
                            <TableHead className="text-center">اسم الطالب</TableHead>
                            <TableHead className="text-center">الصف/الشعبة</TableHead>
                            <TableHead className="text-center">رقم ولي الأمر</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importedStudents.slice(0, 50).map((s, i) => (
                            <TableRow key={s.id}>
                              <TableCell className="text-center text-xs">{i + 1}</TableCell>
                              <TableCell className="text-center text-sm font-medium">{s.name}</TableCell>
                              <TableCell className="text-center text-sm">{s.className}</TableCell>
                              <TableCell className="text-center text-sm">{s.parentPhone || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {importedStudents.length > 50 && (
                        <p className="text-xs text-center text-muted-foreground py-2">... و {importedStudents.length - 50} طالب آخر</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
