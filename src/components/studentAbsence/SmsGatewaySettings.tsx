import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Save, Wifi, WifiOff, ExternalLink, Globe, Router, Download, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import {
  loadGatewayConfig,
  saveGatewayConfig,
  testGatewayConnection,
  type SmsGatewayConfig,
  type GatewayMode,
} from "@/lib/smsGateway";

function SmsInstructions() {
  const [open, setOpen] = useState(true);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="cursor-pointer pb-2" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            📖 دليل الإعداد الكامل (خطوة بخطوة)
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 text-sm">
          {/* Step 1 */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 1: تحميل تطبيق SMSGate على هاتفك</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>اضغط على زر <strong>"تحميل التطبيق"</strong> أدناه لتحميل التطبيق مباشرة</li>
              <li>أو ابحث عن <strong>"SMS Gate"</strong> في متجر Google Play</li>
              <li>ثبّت التطبيق على هاتفك الأندرويد</li>
            </ol>
          </div>

          {/* Step 2 */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 2: إعطاء الصلاحيات</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>افتح <strong>إعدادات الهاتف</strong> ← <strong>التطبيقات</strong> ← <strong>SMSGate</strong></li>
              <li>اضغط على <strong>⋮ (ثلاث نقاط)</strong> في الأعلى ← <strong>"السماح بالإعدادات المقيدة"</strong></li>
              <li>ارجع وادخل <strong>الأذونات</strong> ← فعّل صلاحية <strong>SMS</strong></li>
            </ol>
            <p className="text-xs text-destructive">⚠️ بدون هذه الخطوة لن يستطيع التطبيق إرسال الرسائل!</p>
          </div>

          {/* Step 3 */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 3: تفعيل Cloud Server في التطبيق</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>افتح تطبيق SMSGate على هاتفك</li>
              <li>اذهب إلى <strong>Settings</strong> (الإعدادات)</li>
              <li>فعّل <strong>Cloud server</strong></li>
              <li>سجّل حساب أو سجّل دخول</li>
              <li>ستظهر لك 3 بيانات مهمة:
                <ul className="list-disc list-inside mr-4 mt-1">
                  <li><strong>Username</strong> (اسم المستخدم)</li>
                  <li><strong>Password</strong> (كلمة المرور)</li>
                  <li><strong>Device ID</strong> (معرّف الجهاز)</li>
                </ul>
              </li>
            </ol>
          </div>

          {/* Step 4 */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 4: إدخال البيانات في النظام</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>اختر الوضع <strong>"سحابي (Cloud)"</strong> أدناه</li>
              <li>أدخل <strong>Username</strong> و <strong>Password</strong> و <strong>Device ID</strong></li>
              <li>اضغط <strong>"حفظ الإعدادات"</strong></li>
              <li>اضغط <strong>"اختبار الاتصال"</strong> للتأكد</li>
            </ol>
          </div>

          {/* Step 5 */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 5: إرسال الرسائل</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>اذهب إلى تبويب <strong>"رصد الغياب"</strong></li>
              <li>حدد الطلاب الغائبين واحفظ الغياب</li>
              <li>لإرسال SMS لطالب واحد: اضغط أيقونة 📱 بجانب اسمه</li>
              <li>لإرسال للجميع: اضغط <strong>"إرسال SMS من هاتفك"</strong></li>
              <li>لإرسال واتساب: اضغط أيقونة 💬 بجانب اسم الطالب</li>
            </ol>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <p className="font-bold text-destructive">⚠️ ملاحظات مهمة:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li>يجب أن يكون تطبيق SMSGate <strong>مفتوحاً</strong> على هاتفك أثناء الإرسال</li>
              <li>تأكد من وجود <strong>رصيد كافٍ</strong> في شريحة SIM</li>
              <li>الرسائل تُرسل من <strong>رقم هاتفك الشخصي</strong></li>
              <li>عند تثبيت التطبيق من خارج المتجر، يجب <strong>السماح بالإعدادات المقيدة</strong> يدوياً</li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function SmsGatewaySettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SmsGatewayConfig>({
    mode: "cloud",
    serverUrl: "",
    login: "",
    password: "",
    deviceId: "",
  });
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = loadGatewayConfig();
    if (saved) setConfig(saved);
  }, []);

  const handleSave = () => {
    if (!config.login || !config.password) {
      toast({ title: "يرجى تعبئة اسم المستخدم وكلمة المرور", variant: "destructive" });
      return;
    }
    if (config.mode === "local" && !config.serverUrl) {
      toast({ title: "يرجى إدخال عنوان السيرفر المحلي", variant: "destructive" });
      return;
    }
    if (config.mode === "cloud" && !config.deviceId) {
      toast({ title: "يرجى إدخال Device ID من تطبيق الهاتف", variant: "destructive" });
      return;
    }
    saveGatewayConfig(config);
    toast({ title: "تم حفظ إعدادات بوابة SMS" });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setConnected(null);
    const ok = await testGatewayConnection(config);
    setConnected(ok);
    toast({
      title: ok ? "✅ متصل بالبوابة بنجاح" : "❌ فشل الاتصال",
      description: ok
        ? undefined
        : config.mode === "local"
          ? "تأكد من عنوان IP وأن التطبيق مفتوح على نفس الشبكة"
          : "تأكد من Username و Password وأن Cloud server مفعل داخل التطبيق",
      variant: ok ? "default" : "destructive",
    });
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      {/* Download Button */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base">📲 تطبيق SMSGate (مطلوب)</h3>
              <p className="text-sm text-muted-foreground">حمّل التطبيق على هاتفك الأندرويد لتتمكن من إرسال SMS مجاناً</p>
            </div>
            <div className="flex gap-2">
              <a
                href="https://play.google.com/store/apps/details?id=me.capcom.smsgateway"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="gap-2">
                  <Download className="h-4 w-4" /> تحميل من Google Play
                </Button>
              </a>
              <a
                href="https://github.com/capcom6/sms-gateway/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> تحميل APK مباشر
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <SmsInstructions />

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5" />
            إعدادات بوابة SMS
            {connected === true && <Badge variant="default" className="gap-1"><Wifi className="h-3 w-3" /> متصل</Badge>}
            {connected === false && <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> غير متصل</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-medium">وضع الاتصال</Label>
            <RadioGroup
              value={config.mode}
              onValueChange={(v) => setConfig((p) => ({ ...p, mode: v as GatewayMode }))}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              <label
                htmlFor="mode-cloud"
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  config.mode === "cloud" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <RadioGroupItem value="cloud" id="mode-cloud" className="mt-1" />
                <div>
                  <div className="flex items-center gap-1 font-medium">
                    <Globe className="h-4 w-4" /> سحابي (Cloud) - مُوصى به
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    يعمل من أي مكان عبر الإنترنت
                  </p>
                </div>
              </label>
              <label
                htmlFor="mode-local"
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  config.mode === "local" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <RadioGroupItem value="local" id="mode-local" className="mt-1" />
                <div>
                  <div className="flex items-center gap-1 font-medium">
                    <Router className="h-4 w-4" /> محلي (LAN)
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    يتطلب أن يكون الهاتف والكمبيوتر على نفس شبكة WiFi
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {config.mode === "local" && (
              <div className="space-y-1 md:col-span-2">
                <Label>عنوان السيرفر (IP:Port)</Label>
                <Input
                  dir="ltr"
                  placeholder="http://192.168.1.5:8080"
                  value={config.serverUrl}
                  onChange={(e) => setConfig((p) => ({ ...p, serverUrl: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>اسم المستخدم (Username)</Label>
              <Input
                dir="ltr"
                placeholder="Username من تطبيق SMSGate"
                value={config.login}
                onChange={(e) => setConfig((p) => ({ ...p, login: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>كلمة المرور (Password)</Label>
              <Input
                dir="ltr"
                type="password"
                placeholder="Password من تطبيق SMSGate"
                value={config.password}
                onChange={(e) => setConfig((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            {config.mode === "cloud" && (
              <div className="space-y-1 md:col-span-2">
                <Label>معرّف الجهاز (Device ID)</Label>
                <Input
                  dir="ltr"
                  placeholder="Device ID من تطبيق SMSGate"
                  value={config.deviceId}
                  onChange={(e) => setConfig((p) => ({ ...p, deviceId: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1 md:col-span-2">
              <Label>رقم الشريحة (SIM) للإرسال</Label>
              <RadioGroup
                value={String(config.simNumber || 0)}
                onValueChange={(v) => setConfig((p) => ({ ...p, simNumber: Number(v) || undefined }))}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="0" id="sim-auto" />
                  <span className="text-sm">تلقائي (الافتراضي)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="1" id="sim-1" />
                  <span className="text-sm">SIM 1</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="2" id="sim-2" />
                  <span className="text-sm">SIM 2</span>
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">اختر الشريحة التي تريد إرسال الرسائل منها (للهواتف ذات الشريحتين)</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="gap-1">
              <Save className="h-4 w-4" /> حفظ الإعدادات
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={testing || !config.login || !config.password}>
              {testing ? "جاري الاختبار..." : "🔌 اختبار الاتصال"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}