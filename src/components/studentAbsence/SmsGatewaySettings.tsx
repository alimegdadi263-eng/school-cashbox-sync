import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Save, Wifi, WifiOff, ExternalLink } from "lucide-react";
import { loadGatewayConfig, saveGatewayConfig, type SmsGatewayConfig } from "@/lib/smsGateway";

export default function SmsGatewaySettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SmsGatewayConfig>({
    serverUrl: "",
    login: "",
    password: "",
  });
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = loadGatewayConfig();
    if (saved) setConfig(saved);
  }, []);

  const handleSave = () => {
    if (!config.serverUrl || !config.login || !config.password) {
      toast({ title: "يرجى تعبئة جميع الحقول", variant: "destructive" });
      return;
    }
    saveGatewayConfig(config);
    toast({ title: "تم حفظ إعدادات بوابة SMS" });
  };

  const testConnection = async () => {
    setTesting(true);
    setConnected(null);
    try {
      const url = `${config.serverUrl.replace(/\/$/, "")}/message`;
      const auth = btoa(`${config.login}:${config.password}`);
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
      });
      // Even a 405 means the server is reachable
      setConnected(res.status !== 0);
      toast({
        title: res.status !== 0 ? "✅ متصل بالبوابة بنجاح" : "❌ فشل الاتصال",
        variant: res.status !== 0 ? "default" : "destructive",
      });
    } catch {
      setConnected(false);
      toast({ title: "❌ فشل الاتصال - تأكد من عنوان IP والتطبيق مفتوح", variant: "destructive" });
    }
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
            <li>حمّل تطبيق <strong>SMS Gateway</strong> من Google Play على هاتفك</li>
            <li>افتح التطبيق وفعّل السيرفر المحلي (Local Server)</li>
            <li>انسخ عنوان IP والمنفذ (مثلاً: <code dir="ltr">http://192.168.1.5:8080</code>)</li>
            <li>انسخ اسم المستخدم وكلمة المرور من التطبيق</li>
            <li>الصق البيانات هنا واضغط حفظ</li>
          </ol>
          <a
            href="https://play.google.com/store/apps/details?id=me.capcom.smsgateway"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
          >
            <ExternalLink className="h-3 w-3" /> تحميل التطبيق من Google Play
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>عنوان السيرفر (IP:Port)</Label>
            <Input
              dir="ltr"
              placeholder="http://192.168.1.5:8080"
              value={config.serverUrl}
              onChange={e => setConfig(p => ({ ...p, serverUrl: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>اسم المستخدم</Label>
            <Input
              dir="ltr"
              placeholder="Login"
              value={config.login}
              onChange={e => setConfig(p => ({ ...p, login: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>كلمة المرور</Label>
            <Input
              dir="ltr"
              type="password"
              placeholder="Password"
              value={config.password}
              onChange={e => setConfig(p => ({ ...p, password: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="gap-1">
            <Save className="h-4 w-4" /> حفظ الإعدادات
          </Button>
          <Button variant="outline" onClick={testConnection} disabled={testing || !config.serverUrl}>
            {testing ? "جاري الاختبار..." : "🔌 اختبار الاتصال"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
