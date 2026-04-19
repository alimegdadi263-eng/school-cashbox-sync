import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Download, Play, Send, Trash2, Plug, AlertCircle } from "lucide-react";

// Replace with your published extension ID after loading it in Chrome
const DEFAULT_EXTENSION_ID = "";

type LogLevel = "pending" | "done" | "error" | "info";
interface LogEntry { id: number; level: LogLevel; message: string; time: string; }

declare global {
  interface Window { chrome?: any; }
}

export default function AjyalExtension() {
  const [extensionId, setExtensionId] = useState<string>(
    () => localStorage.getItem("ajyal_ext_id") || DEFAULT_EXTENSION_ID
  );
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [waitingAttendance, setWaitingAttendance] = useState(false);
  const portRef = useRef<any>(null);
  const idRef = useRef(0);

  const addLog = (level: LogLevel, message: string) => {
    idRef.current += 1;
    setLogs((prev) => [
      ...prev,
      { id: idRef.current, level, message, time: new Date().toLocaleTimeString("ar-EG") },
    ]);
  };

  const clearLogs = () => setLogs([]);

  const connect = () => {
    if (!window.chrome?.runtime?.connect) {
      addLog("error", "هذا المتصفح لا يدعم الإضافات (استخدم Chrome/Edge)");
      return;
    }
    if (!extensionId) {
      addLog("error", "أدخل معرّف الإضافة (Extension ID) أولاً");
      return;
    }
    try {
      const port = window.chrome.runtime.connect(extensionId, { name: "ajyal-web" });
      portRef.current = port;
      port.onMessage.addListener((msg: any) => {
        if (msg?.type === "log" && msg.entry) {
          addLog(msg.entry.level || "info", msg.entry.message || "");
        } else if (msg?.type === "status" && msg.status?.connected) {
          setConnected(true);
          addLog("done", "تم الاتصال بالإضافة");
        }
      });
      port.onDisconnect.addListener(() => {
        setConnected(false);
        addLog("error", "انقطع الاتصال بالإضافة");
      });
      port.postMessage({ type: "ping" });
      localStorage.setItem("ajyal_ext_id", extensionId);
    } catch (e: any) {
      addLog("error", `فشل الاتصال: ${e?.message || e}`);
    }
  };

  const sendCmd = (msg: any) => {
    if (!portRef.current) { addLog("error", "غير متصل بالإضافة"); return; }
    portRef.current.postMessage(msg);
  };

  const runExportImport = () => {
    clearLogs();
    addLog("info", "▶️ تصدير ثم استيراد الطلبة");
    sendCmd({ type: "runTask", task: "exportImportStudents" });
  };

  const runAttendance = () => {
    clearLogs();
    addLog("info", "▶️ تعبئة الغياب");
    setWaitingAttendance(true);
    sendCmd({ type: "runTask", task: "fillAttendance" });
  };

  const submitAttendance = () => {
    addLog("pending", "إرسال الغياب...");
    sendCmd({ type: "submitAttendance" });
    setWaitingAttendance(false);
  };

  const downloadExtension = async () => {
    try {
      const res = await fetch("/ajyal-extension.zip");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ajyal-extension.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      alert("تعذر تنزيل الإضافة: " + e.message);
    }
  };

  useEffect(() => {
    document.title = "أجيال - الأتمتة | الإدارة المدرسية";
  }, []);

  const iconFor = (l: LogLevel) =>
    l === "done" ? "✅" : l === "error" ? "❌" : l === "pending" ? "⏳" : "ℹ️";
  const colorFor = (l: LogLevel) =>
    l === "done" ? "text-success" : l === "error" ? "text-destructive" : l === "pending" ? "text-accent" : "text-muted-foreground";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary">أجيال — لوحة الأتمتة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            تحكم بإضافة Chrome لتنفيذ مهام منصة أجيال مع متابعة مباشرة لكل خطوة.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Control Panel */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="w-5 h-5 text-accent" /> لوحة التحكم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">معرّف الإضافة (Extension ID)</label>
                <div className="flex gap-2">
                  <Input
                    value={extensionId}
                    onChange={(e) => setExtensionId(e.target.value.trim())}
                    placeholder="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    className="font-mono text-xs"
                  />
                  <Button onClick={connect} variant={connected ? "secondary" : "default"}>
                    {connected ? "متصل ✓" : "اتصال"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  انسخه من <code>chrome://extensions</code> بعد تثبيت الإضافة.
                </p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h3 className="font-semibold text-primary">المهام</h3>
                <Button onClick={runExportImport} className="w-full justify-start gap-2" disabled={!connected}>
                  <Play className="w-4 h-4" />
                  المهمة 1: تصدير ثم استيراد الطلبة
                </Button>
                <Button onClick={runAttendance} variant="secondary" className="w-full justify-start gap-2" disabled={!connected}>
                  <Play className="w-4 h-4" />
                  المهمة 2: فتح صفحة الغياب
                </Button>
                {waitingAttendance && (
                  <Button onClick={submitAttendance} variant="default" className="w-full justify-start gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                    <Send className="w-4 h-4" />
                    إرسال الغياب الآن
                  </Button>
                )}
              </div>

              <div className="border-t pt-4 space-y-2">
                <h3 className="font-semibold text-primary">تثبيت الإضافة</h3>
                <Button onClick={downloadExtension} variant="outline" className="w-full justify-start gap-2">
                  <Download className="w-4 h-4" /> تنزيل ملف الإضافة (ZIP)
                </Button>
                <ol className="text-xs text-muted-foreground list-decimal pr-5 space-y-1">
                  <li>فك الضغط عن الملف.</li>
                  <li>افتح <code>chrome://extensions</code> وفعّل "وضع المطور".</li>
                  <li>اضغط "تحميل غير مضغوط" واختر مجلد الإضافة.</li>
                  <li>انسخ المعرّف الظاهر والصقه في الأعلى ثم اضغط "اتصال".</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Live Log */}
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-accent" /> السجل المباشر
              </CardTitle>
              <Button onClick={clearLogs} variant="ghost" size="sm" className="gap-1">
                <Trash2 className="w-4 h-4" /> مسح
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px] rounded-md border bg-card p-3">
                {logs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-12">
                    لا توجد خطوات بعد. ابدأ مهمة لمتابعة التنفيذ هنا.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {logs.map((log) => (
                      <li key={log.id} className={`flex items-start gap-2 text-sm ${colorFor(log.level)}`}>
                        <span className="shrink-0">{iconFor(log.level)}</span>
                        <span className="flex-1">{log.message}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{log.time}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
