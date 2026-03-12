import { useState, useEffect } from "react";
import { Download, Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function UpdateNotification() {
  const isElectron = typeof window !== "undefined" && (window as any).electronAPI?.checkForUpdates;
  const [status, setStatus] = useState<string>("idle");
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    (window as any).electronAPI.onUpdateStatus?.((data: { status: string; version?: string; progress?: number }) => {
      setStatus(data.status);
      if (data.version) setVersion(data.version);
      if (data.progress !== undefined) setProgress(data.progress);
      // Auto-expand when update available
      if (data.status === "available" || data.status === "downloading" || data.status === "downloaded") {
        setExpanded(true);
      }
    });
  }, [isElectron]);

  if (!isElectron) return null;
  // Only show when there's an update or actively checking/downloading
  if (status === "idle" || status === "not-available") return null;

  const handleClick = () => {
    if (status === "available") {
      // Trigger the update check which will show the native dialog to download
      (window as any).electronAPI.checkForUpdates();
    } else if (status === "downloaded") {
      (window as any).electronAPI.checkForUpdates();
    }
    setExpanded(!expanded);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-fade-in" dir="rtl">
      <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden max-w-xs">
        <button
          onClick={handleClick}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          {status === "checking" && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          {status === "available" && (
            <div className="relative">
              <Download className="w-5 h-5 text-primary" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full animate-pulse" />
            </div>
          )}
          {status === "downloading" && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          {status === "downloaded" && <CheckCircle className="w-5 h-5 text-green-500" />}
          {status === "error" && <RefreshCw className="w-5 h-5 text-destructive" />}

          <div className="flex-1 text-right">
            <p className="text-sm font-medium text-foreground">
              {status === "checking" && "جاري التحقق..."}
              {status === "available" && `تحديث جديد ${version}`}
              {status === "downloading" && `جاري التحميل ${progress}%`}
              {status === "downloaded" && "جاهز للتثبيت"}
              {status === "error" && "خطأ في التحديث"}
            </p>
          </div>

          {status === "available" && (
            <Badge variant="default" className="text-xs">
              تحديث
            </Badge>
          )}
        </button>

        {status === "downloading" && (
          <div className="px-4 pb-3">
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </div>
    </div>
  );
}
