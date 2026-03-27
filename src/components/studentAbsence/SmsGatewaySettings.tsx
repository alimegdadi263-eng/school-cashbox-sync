import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Save, Wifi, WifiOff, ExternalLink, Globe, Router } from "lucide-react";
import {
  loadGatewayConfig,
  saveGatewayConfig,
  testGatewayConnection,
  type SmsGatewayConfig,
  type GatewayMode,
} from "@/lib/smsGateway";

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="h-5 w-5" />
          إعدادات بوابة SMS (من هاتفك)
          {connected === true && <Badge variant="default" className="gap-1"><Wifi className="h-3 w-3" /> متصل</Badge>}
          {connected === false && <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> غير متصل</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
          <p className="font-medium">📱 الخطوات:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>فعّل <strong>Cloud server</strong> داخل التطبيق</li>
            <li>انسخ <strong>Username</strong> و <strong>Password</strong> و <strong>Device ID</strong></li>
            <li>اختر الوضع المناسب أدناه</li>
            <li>الصق البيانات واضغط حفظ</li>
            <li>اضغط اختبار الاتصال</li>
          </ol>
          <a
            href="https://sms-gate.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
          >
            <ExternalLink className="h-3 w-3" /> فتح موقع SMSGate
          </a>
        </div>

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
                  <Globe className="h-4 w-4" /> سحابي (Cloud)
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
            <Label>اسم المستخدم</Label>
            <Input
              dir="ltr"
              placeholder="Username"
              value={config.login}
              onChange={(e) => setConfig((p) => ({ ...p, login: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>كلمة المرور</Label>
            <Input
              dir="ltr"
              type="password"
              placeholder="Password"
              value={config.password}
              onChange={(e) => setConfig((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          {config.mode === "cloud" && (
            <div className="space-y-1 md:col-span-2">
              <Label>Device ID</Label>
              <Input
                dir="ltr"
                placeholder="NPGICmoRvcMFX0gvH_t7W"
                value={config.deviceId}
                onChange={(e) => setConfig((p) => ({ ...p, deviceId: e.target.value }))}
              />
            </div>
          )}
        </div>

        {config.mode === "cloud" && (
          <div className="rounded-lg border border-border bg-accent/30 p-3 text-xs text-muted-foreground">
            💡 من الصورة التي أرسلتها: انسخ أيضًا <strong>Device ID</strong> لأنه مطلوب في الإصدار الجديد من SMSGate.
          </div>
        )}

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
  );
}
