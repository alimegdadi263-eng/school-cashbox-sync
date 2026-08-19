import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Save, Wifi, WifiOff, Globe, Router, Download, BookOpen, ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check } from "lucide-react";
import {
  loadGatewayProfiles,
  saveGatewayProfiles,
  testGatewayConnection,
  MASTER_DEFAULTS,
  type SmsGatewayConfig,
  type GatewayMode,
  type GatewayProvider,
} from "@/lib/smsGateway";

function SmsInstructions() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="cursor-pointer pb-2" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            📖 دليل الربط مع تطبيق SMS Gateway Master (خطوة بخطوة)
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 1: تثبيت التطبيق</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>ثبّت تطبيق <strong>SMS Gateway Master</strong> على هاتف أندرويد يحتوي شريحة فعّالة</li>
              <li>امنح التطبيق صلاحية <strong>الرسائل SMS</strong> من إعدادات الهاتف ← التطبيقات ← الأذونات</li>
              <li>عطّل <strong>توفير البطارية</strong> للتطبيق ليبقى يعمل في الخلفية</li>
            </ol>
          </div>
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 2: تشغيل السيرفر ونسخ مفتاح API</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>افتح التطبيق واضغط <strong>Start / تشغيل السيرفر</strong></li>
              <li>سيظهر عنوان مثل <code dir="ltr">http://192.168.1.5:8080</code> — انسخه</li>
              <li>من شاشة الإعدادات انسخ <strong>API Key</strong> (مفتاح الـ API)</li>
              <li>تأكد أن الهاتف والحاسوب على <strong>نفس شبكة الواي فاي</strong></li>
            </ol>
          </div>
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 3: إدخال البيانات هنا</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>اضغط <strong>"+ إضافة هاتف جديد"</strong> واختر نوع البوابة <strong>SMS Gateway Master</strong></li>
              <li>ألصق <strong>عنوان السيرفر</strong> و <strong>مفتاح API</strong></li>
              <li>اختر شريحة SIM إن كان الهاتف يحوي شريحتين</li>
              <li>اضغط <strong>اختبار الاتصال</strong> ثم <strong>حفظ الكل</strong></li>
            </ol>
          </div>
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <p className="font-bold text-primary">الخطوة 4 (اختياري): إعدادات متقدمة</p>
            <p className="text-muted-foreground">
              إذا كان إصدار التطبيق يستخدم مساراً أو أسماء حقول مختلفة، افتح <strong>إعدادات متقدمة</strong> داخل بطاقة الهاتف
              وعدّل المسار (<code dir="ltr">/sendsms</code>) وأسماء الحقول (<code dir="ltr">apikey / number / message / sim</code>)
              أو غيّر الطريقة إلى <code dir="ltr">POST</code> حسب ما هو مكتوب في شاشة API داخل التطبيق.
            </p>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <p className="font-bold text-destructive">⚠️ ملاحظات مهمة:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li>يجب أن يكون سيرفر التطبيق <strong>مشغّلاً</strong> على الهاتف أثناء الإرسال</li>
              <li>الربط المحلي يعمل عبر نسخة سطح المكتب أو على نفس الشبكة (عنوان <code dir="ltr">http://</code>)</li>
              <li>تأكد من وجود <strong>رصيد كافٍ</strong> في شريحة SIM</li>
              <li>عند إضافة عدة هواتف، يتم <strong>توزيع الرسائل تلقائياً</strong> بالتناوب</li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

const emptyProfile = (): SmsGatewayConfig => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  name: "",
  provider: "master",
  mode: "local",
  serverUrl: "",
  login: "",
  password: "",
  deviceId: "",
  apiKey: "",
  sendPath: MASTER_DEFAULTS.sendPath,
  httpMethod: MASTER_DEFAULTS.httpMethod,
  apiKeyParam: MASTER_DEFAULTS.apiKeyParam,
  phoneParam: MASTER_DEFAULTS.phoneParam,
  messageParam: MASTER_DEFAULTS.messageParam,
  simParam: MASTER_DEFAULTS.simParam,
});


function GatewayProfileCard({
  profile,
  index,
  onUpdate,
  onDelete,
  onTest,
}: {
  profile: SmsGatewayConfig;
  index: number;
  onUpdate: (p: SmsGatewayConfig) => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(!profile.login); // auto-open if new

  const handleTest = async () => {
    setTesting(true);
    setConnected(null);
    const ok = await testGatewayConnection(profile);
    setConnected(ok);
    setTesting(false);
    onTest();
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span>{profile.name || `هاتف ${index + 1}`}</span>
            {connected === true && <Badge variant="default" className="gap-1 text-xs"><Wifi className="h-3 w-3" /> متصل</Badge>}
            {connected === false && <Badge variant="destructive" className="gap-1 text-xs"><WifiOff className="h-3 w-3" /> غير متصل</Badge>}
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditing(!editing)}>
              {editing ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {editing && (
        <CardContent className="space-y-3 pt-0">
          <div className="space-y-1">
            <Label>اسم الهاتف (للتمييز)</Label>
            <Input
              placeholder="مثال: هاتف أحمد"
              value={profile.name || ""}
              onChange={(e) => onUpdate({ ...profile, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">وضع الاتصال</Label>
            <RadioGroup
              value={profile.mode}
              onValueChange={(v) => onUpdate({ ...profile, mode: v as GatewayMode })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="cloud" />
                <span className="text-sm flex items-center gap-1"><Globe className="h-3 w-3" /> سحابي</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="local" />
                <span className="text-sm flex items-center gap-1"><Router className="h-3 w-3" /> محلي</span>
              </label>
            </RadioGroup>
          </div>
          {profile.mode === "local" && (
            <div className="space-y-1">
              <Label>عنوان السيرفر</Label>
              <Input dir="ltr" placeholder="http://192.168.1.5:8080" value={profile.serverUrl}
                onChange={(e) => onUpdate({ ...profile, serverUrl: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Username</Label>
              <Input dir="ltr" placeholder="من تطبيق SMSGate" value={profile.login}
                onChange={(e) => onUpdate({ ...profile, login: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input dir="ltr" type="password" placeholder="من تطبيق SMSGate" value={profile.password}
                onChange={(e) => onUpdate({ ...profile, password: e.target.value })} />
            </div>
          </div>
          {profile.mode === "cloud" && (
            <div className="space-y-1">
              <Label>Device ID</Label>
              <Input dir="ltr" placeholder="من تطبيق SMSGate" value={profile.deviceId}
                onChange={(e) => onUpdate({ ...profile, deviceId: e.target.value })} />
            </div>
          )}
          <div className="space-y-1">
            <Label>شريحة SIM</Label>
            <RadioGroup
              value={String(profile.simNumber || 0)}
              onValueChange={(v) => onUpdate({ ...profile, simNumber: Number(v) || undefined })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="0" />
                <span className="text-sm">تلقائي</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="1" />
                <span className="text-sm">SIM 1</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="2" />
                <span className="text-sm">SIM 2</span>
              </label>
            </RadioGroup>
          </div>
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !profile.login || !profile.password}>
            {testing ? "جاري الاختبار..." : "🔌 اختبار الاتصال"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

export default function SmsGatewaySettings() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<SmsGatewayConfig[]>([]);

  useEffect(() => {
    setProfiles(loadGatewayProfiles());
  }, []);

  const handleAddProfile = () => {
    setProfiles(prev => [...prev, emptyProfile()]);
  };

  const handleUpdateProfile = (index: number, updated: SmsGatewayConfig) => {
    setProfiles(prev => prev.map((p, i) => i === index ? updated : p));
  };

  const handleDeleteProfile = (index: number) => {
    setProfiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      saveGatewayProfiles(next);
      return next;
    });
    toast({ title: "تم حذف الهاتف" });
  };

  const handleSaveAll = () => {
    const invalid = profiles.find(p => !p.login || !p.password);
    if (invalid) {
      toast({ title: "يرجى تعبئة بيانات جميع الهواتف", variant: "destructive" });
      return;
    }
    const cloudInvalid = profiles.find(p => p.mode === "cloud" && !p.deviceId);
    if (cloudInvalid) {
      toast({ title: `يرجى إدخال Device ID للهاتف "${cloudInvalid.name || "بدون اسم"}"`, variant: "destructive" });
      return;
    }
    saveGatewayProfiles(profiles);
    toast({ title: `تم حفظ ${profiles.length} هاتف/هواتف بنجاح ✅` });
  };

  return (
    <div className="space-y-4">
      {/* Download */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base">📲 تطبيق SMSGate (مطلوب)</h3>
              <p className="text-sm text-muted-foreground">حمّل التطبيق على هاتفك الأندرويد لإرسال SMS مجاناً</p>
            </div>
            <div className="flex gap-2">
              <a href="https://play.google.com/store/apps/details?id=me.capcom.smsgateway" target="_blank" rel="noopener noreferrer">
                <Button className="gap-2"><Download className="h-4 w-4" /> Google Play</Button>
              </a>
              <a href="/downloads/SMSGate.apk" download="SMSGate.apk">
                <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> تحميل APK مباشر</Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <SmsInstructions />

      {/* Profiles */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          📱 الهواتف المربوطة ({profiles.length})
        </h3>
        <div className="flex gap-2">
          <Button onClick={handleAddProfile} variant="outline" className="gap-1">
            <Plus className="h-4 w-4" /> إضافة هاتف جديد
          </Button>
          {profiles.length > 0 && (
            <Button onClick={handleSaveAll} className="gap-1">
              <Save className="h-4 w-4" /> حفظ الكل
            </Button>
          )}
        </div>
      </div>

      {profiles.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Smartphone className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-1">لا توجد هواتف مربوطة</p>
            <p className="text-sm mb-3">اضغط "إضافة هاتف جديد" لربط أول هاتف</p>
            <Button onClick={handleAddProfile} className="gap-1">
              <Plus className="h-4 w-4" /> إضافة هاتف جديد
            </Button>
          </CardContent>
        </Card>
      )}

      {profiles.length > 1 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          💡 عند إرسال رسائل جماعية، سيتم <strong>توزيع الرسائل تلقائياً بالتناوب</strong> على جميع الهواتف لتسريع الإرسال وتجنب الحظر.
        </div>
      )}

      <div className="space-y-3">
        {profiles.map((profile, index) => (
          <GatewayProfileCard
            key={profile.id || index}
            profile={profile}
            index={index}
            onUpdate={(p) => handleUpdateProfile(index, p)}
            onDelete={() => handleDeleteProfile(index)}
            onTest={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
