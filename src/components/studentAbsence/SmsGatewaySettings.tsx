import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone, Save, Wifi, WifiOff, BookOpen, ChevronDown, ChevronUp,
  Plus, Trash2, Send, Loader2,
} from "lucide-react";
import {
  loadGatewayProfiles,
  saveGatewayProfiles,
  testGatewayConnection,
  sendSmsViaGateway,
  gatewayUrl,
  TRACCAR_DEFAULT_PORT,
  type SmsGatewayConfig,
} from "@/lib/smsGateway";

function SmsInstructions() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="cursor-pointer pb-2" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            📖 دليل الربط مع تطبيق Traccar SMS Gateway (خطوة بخطوة)
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 1: تثبيت التطبيق على الهاتف</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>ثبّت تطبيق <strong>Traccar SMS Gateway</strong> على هاتف أندرويد يحتوي شريحة فعّالة</li>
              <li>امنح التطبيق صلاحية <strong>إرسال الرسائل SMS</strong> عند طلبها</li>
              <li>عطّل <strong>توفير البطارية</strong> للتطبيق ليبقى يعمل في الخلفية</li>
            </ol>
          </div>
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 2: تشغيل الخدمة ونسخ الـ Token</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>افتح التطبيق وفعّل الخدمة المحلية (Local Service)</li>
              <li>سيعرض التطبيق عنوان الهاتف والمنفذ مثل <code dir="ltr">192.168.8.102:8082</code></li>
              <li>انسخ <strong>Local Service → Token</strong> (وليس Cloud Service Token)</li>
              <li>تأكد أن الهاتف والحاسوب على <strong>نفس شبكة الواي فاي</strong></li>
            </ol>
          </div>
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 3: إدخال البيانات هنا</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>اضغط <strong>"+ إضافة هاتف"</strong> ثم أدخل عنوان الهاتف (IP) والمنفذ و Local Service Token</li>
              <li>اضغط <strong>اختبار الاتصال</strong> ثم <strong>حفظ الكل</strong></li>
              <li>جرّب <strong>إرسال رسالة اختبار</strong> إلى رقمك الشخصي</li>
            </ol>
          </div>
          <div className="rounded-lg border bg-background p-3 space-y-1 text-muted-foreground">
            <p className="font-bold text-primary">ملاحظات</p>
            <p>• الإرسال يتم عبر <code dir="ltr">POST http://IP:PORT/</code> بجسم <code dir="ltr">{`{"to":"...","message":"..."}`}</code>.</p>
            <p>• الرسائل تخرج فعليًا من شريحة الهاتف، ولا توجد أي تكلفة على خدمة خارجية.</p>
            <p>• Traccar لا يوفر رسميًا خيار اختيار الشريحة (SIM) عبر الـ API، لذلك يتم الإرسال من الشريحة الافتراضية في إعدادات الهاتف.</p>
            <p>• يمكن إضافة أكثر من هاتف ليتم توزيع الرسائل بينهم بالتناوب.</p>
          </div>

        </CardContent>
      )}
    </Card>
  );
}

export default function SmsGatewaySettings() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<SmsGatewayConfig[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, boolean | null>>({});
  const [testPhone, setTestPhone] = useState("");
  const [testText, setTestText] = useState("رسالة اختبار من برمجية الإدارة المدرسية");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    setProfiles(loadGatewayProfiles());
  }, []);

  const update = (id: string, patch: Partial<SmsGatewayConfig>) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setStatus((s) => ({ ...s, [id]: null }));
  };

  const addProfile = () => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setProfiles((prev) => [
      ...prev,
      { id, name: `هاتف ${prev.length + 1}`, host: "", port: TRACCAR_DEFAULT_PORT, apiKey: "" },
    ]);
  };

  const removeProfile = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const saveAll = () => {
    saveGatewayProfiles(profiles);
    toast({ title: "تم الحفظ", description: `تم حفظ ${profiles.length} هاتف` });
  };

  const handleTest = async (p: SmsGatewayConfig) => {
    setTesting(p.id!);
    const res = await testGatewayConnection(p);
    setStatus((s) => ({ ...s, [p.id!]: res.success }));
    setTesting(null);
    if (res.success) {
      toast({ title: "تم الاتصال بنجاح", description: gatewayUrl(p) });
    } else {
      toast({ variant: "destructive", title: "فشل الاتصال", description: res.error });
    }
  };

  const sendTestMessage = async () => {
    if (profiles.length === 0) {
      toast({ variant: "destructive", title: "لا توجد بوابة", description: "أضف هاتفًا أولًا" });
      return;
    }
    if (!testPhone.trim()) {
      toast({ variant: "destructive", title: "رقم الهاتف مطلوب" });
      return;
    }
    if (!testText.trim()) {
      toast({ variant: "destructive", title: "نص الرسالة مطلوب" });
      return;
    }
    setSendingTest(true);
    const res = await sendSmsViaGateway(profiles[0], testPhone.trim(), testText.trim());
    setSendingTest(false);
    if (res.success) {
      toast({ title: "تم إرسال الرسالة بنجاح", description: `إلى ${testPhone}` });
    } else {
      toast({ variant: "destructive", title: "فشل إرسال الرسالة", description: res.error });
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <SmsInstructions />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              هواتف الإرسال (Traccar SMS Gateway)
            </span>
            <Button size="sm" variant="outline" onClick={addProfile} className="gap-1">
              <Plus className="h-4 w-4" /> إضافة هاتف
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profiles.length === 0 && (
            <p className="text-sm text-muted-foreground">لم تتم إضافة أي هاتف بعد. اضغط "إضافة هاتف" للبدء.</p>
          )}

          {profiles.map((p) => (
            <div key={p.id} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Input
                  className="max-w-[220px]"
                  value={p.name || ""}
                  onChange={(e) => update(p.id!, { name: e.target.value })}
                  placeholder="اسم الهاتف"
                />
                <div className="flex items-center gap-2">
                  {status[p.id!] === true && (
                    <Badge className="gap-1 bg-emerald-600"><Wifi className="h-3 w-3" /> متصل</Badge>
                  )}
                  {status[p.id!] === false && (
                    <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> غير متصل</Badge>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => removeProfile(p.id!)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>عنوان الهاتف (IP)</Label>
                  <Input
                    dir="ltr"
                    value={p.host}
                    onChange={(e) => update(p.id!, { host: e.target.value })}
                    placeholder="192.168.8.102"
                  />
                </div>
                <div className="space-y-1">
                  <Label>المنفذ (Port)</Label>
                  <Input
                    dir="ltr"
                    type="number"
                    value={p.port}
                    onChange={(e) => update(p.id!, { port: Number(e.target.value) || TRACCAR_DEFAULT_PORT })}
                    placeholder={String(TRACCAR_DEFAULT_PORT)}
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label>Local Service Token (من داخل التطبيق)</Label>
                  <Input
                    dir="ltr"
                    type="password"
                    autoComplete="off"
                    value={p.apiKey}
                    onChange={(e) => update(p.id!, { apiKey: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {p.host ? gatewayUrl(p) : "—"}
                </span>
                <Button size="sm" variant="secondary" disabled={testing === p.id} onClick={() => handleTest(p)}>
                  {testing === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "اختبار الاتصال"}
                </Button>
              </div>
            </div>
          ))}

          <Button onClick={saveAll} className="gap-1">
            <Save className="h-4 w-4" /> حفظ الكل
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">إرسال رسالة اختبار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>رقم الهاتف</Label>
            <Input dir="ltr" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="07XXXXXXXX" />
          </div>
          <div className="space-y-1">
            <Label>نص الرسالة</Label>
            <Textarea rows={3} value={testText} onChange={(e) => setTestText(e.target.value)} />
          </div>
          <Button onClick={sendTestMessage} disabled={sendingTest} className="gap-1">
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            إرسال رسالة اختبار
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
