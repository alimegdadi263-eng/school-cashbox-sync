import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNetwork } from "@/context/NetworkContext";
import { useToast } from "@/hooks/use-toast";
import {
  Server,
  Monitor,
  Wifi,
  WifiOff,
  Copy,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function NetworkModeSelector() {
  const { state, startServer, stopServer, connectToServer, disconnect, ping } = useNetwork();
  const { toast } = useToast();
  const [clientIp, setClientIp] = useState("");
  const [clientPort, setClientPort] = useState("9753");
  const [loading, setLoading] = useState(false);

  const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.lan;

  if (!isElectron) return null;

  const handleStartServer = async () => {
    setLoading(true);
    await startServer();
    setLoading(false);
    if (!state.error) {
      toast({ title: "تم تشغيل السيرفر", description: "يمكن للأجهزة الأخرى الاتصال الآن" });
    }
  };

  const handleConnect = async () => {
    if (!clientIp.trim()) {
      toast({ title: "خطأ", description: "أدخل عنوان IP السيرفر", variant: "destructive" });
      return;
    }
    setLoading(true);
    await connectToServer(clientIp.trim(), parseInt(clientPort) || 9753);
    setLoading(false);
  };

  const handleDisconnect = async () => {
    if (state.mode === "server") await stopServer();
    else await disconnect();
    toast({ title: "تم قطع الاتصال" });
  };

  const handlePing = async () => {
    const ok = await ping();
    toast({
      title: ok ? "الاتصال يعمل ✓" : "فشل الاتصال",
      variant: ok ? "default" : "destructive",
    });
  };

  const copyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    toast({ title: "تم النسخ", description: ip });
  };

  // Connected state
  if (state.mode !== "standalone") {
    return (
      <Card className="shadow-card border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {state.mode === "server" ? (
              <Server className="w-5 h-5 text-primary" />
            ) : (
              <Monitor className="w-5 h-5 text-primary" />
            )}
            وضع الشبكة المحلية
            <Badge variant={state.connected ? "default" : "destructive"} className="mr-auto">
              {state.connected ? (
                <><Wifi className="w-3 h-3 ml-1" /> متصل</>
              ) : (
                <><WifiOff className="w-3 h-3 ml-1" /> غير متصل</>
              )}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-muted/30 space-y-2">
            <p className="text-sm font-medium">
              {state.mode === "server" ? "يعمل كجهاز رئيسي (Server)" : "متصل بالجهاز الرئيسي (Client)"}
            </p>
            {state.mode === "server" && state.localIPs.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">عناوين IP للاتصال:</p>
                {state.localIPs.map((ip) => (
                  <div key={ip.address} className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-background px-2 py-0.5 rounded border">
                      {ip.address}:{state.serverPort}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyIp(`${ip.address}:${state.serverPort}`)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground">({ip.name})</span>
                  </div>
                ))}
              </div>
            )}
            {state.mode === "client" && (
              <p className="text-xs text-muted-foreground">
                السيرفر: <code className="font-mono">{state.serverIp}:{state.serverPort}</code>
              </p>
            )}
          </div>

          {state.error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {state.error}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePing}>
              <CheckCircle className="w-4 h-4 ml-1" />
              فحص الاتصال
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              <WifiOff className="w-4 h-4 ml-1" />
              قطع الاتصال
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Selection state
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wifi className="w-5 h-5" />
          الشبكة المحلية (LAN)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          شغّل عدة أجهزة على نفس الشبكة المحلية بدون إنترنت. جهاز واحد يكون رئيسي والباقي تتصل به.
        </p>

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            {state.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Server Option */}
          <div className="p-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors space-y-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">جهاز رئيسي (Server)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              شغّل هذا الجهاز كسيرفر. قاعدة البيانات ستكون هنا.
            </p>
            <Button
              onClick={handleStartServer}
              disabled={loading}
              className="w-full"
              size="sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Server className="w-4 h-4 ml-1" />}
              تشغيل كجهاز رئيسي
            </Button>
          </div>

          {/* Client Option */}
          <div className="p-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors space-y-3">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">اتصال بجهاز رئيسي (Client)</span>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">عنوان IP السيرفر</Label>
                <Input
                  value={clientIp}
                  onChange={(e) => setClientIp(e.target.value)}
                  placeholder="192.168.1.100 أو 192.168.1.100:9753"
                  className="h-8 text-sm font-mono"
                  dir="ltr"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  يمكنك لصق العنوان المنسوخ كاملًا سواء كان IP فقط أو IP:PORT
                </p>
              </div>
              <div>
                <Label className="text-xs">المنفذ (Port)</Label>
                <Input
                  value={clientPort}
                  onChange={(e) => setClientPort(e.target.value)}
                  placeholder="9753"
                  className="h-8 text-sm font-mono"
                  dir="ltr"
                />
              </div>
            </div>
            <Button
              onClick={handleConnect}
              disabled={loading}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Monitor className="w-4 h-4 ml-1" />}
              اتصال
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
