import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  BookOpen, 
  PlusCircle, 
  Settings, 
  FileText,
  FolderOpen,
  School,
  Users,
  LogOut,
  CircleHelp,
  Code,
  Presentation,
  CalendarDays,
  ClipboardList,
  ChevronDown,
  Wallet,
  Archive,
  Download,
  Loader2,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNetwork } from "@/context/NetworkContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  children: NavItem[];
}

type SidebarEntry = NavItem | NavGroup;

function isGroup(entry: SidebarEntry): entry is NavGroup {
  return "children" in entry;
}

export default function AppSidebar() {
  const location = useLocation();
  const { isAdmin, schoolName, signOut } = useAuth();
  const { state: networkState } = useNetwork();

  const clientRole = networkState.clientRole;
  const isClient = networkState.mode === "client";

  const financePaths = ["/cashbook", "/transaction", "/summary", "/forms", "/sdi-analysis"];
  const financeActive = financePaths.includes(location.pathname);
  const [financeOpen, setFinanceOpen] = useState(financeActive);

  const isElectron = typeof window !== "undefined" && ((window as any).electronAPI?.runUpdateAction || (window as any).electronAPI?.checkForUpdates);
  const [updateStatus, setUpdateStatus] = useState<string>("idle");
  const [updateVersion, setUpdateVersion] = useState("");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [currentVersion, setCurrentVersion] = useState<string>((window as any).electronAPI?.appVersion || "2.0.1");

  useEffect(() => {
    if (!isElectron) return;

    void (window as any).electronAPI?.getAppVersion?.().then((version: string) => {
      if (version) setCurrentVersion(version);
    });

    const unsubscribe = (window as any).electronAPI.onUpdateStatus?.((data: { status: string; version?: string; progress?: number }) => {
      setUpdateStatus(data.status);
      if (data.version) setUpdateVersion(data.version);
      if (data.progress !== undefined) setUpdateProgress(data.progress);
    });

    return () => {
      unsubscribe?.();
    };
  }, [isElectron]);

  const hasUpdate = updateStatus === "available" || updateStatus === "downloaded";
  const isUpdating = updateStatus === "checking" || updateStatus === "downloading";

  const handleUpdateClick = () => {
    if (!isElectron) return;
    const api = (window as any).electronAPI;
    if (api?.runUpdateAction) {
      api.runUpdateAction();
      return;
    }
    api?.checkForUpdates?.();
  };
  // Assistant paths: timetable, exams, committees
  const assistantPaths = ["/timetable", "/exams", "/committees"];
  // Secretary paths: secretary, committees
  const secretaryPaths = ["/secretary", "/committees"];

  const allEntries: SidebarEntry[] = [
    { path: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    {
      label: "مالية المدرسة",
      icon: Wallet,
      children: [
        { path: "/cashbook", label: "دفتر الصندوق", icon: BookOpen },
        { path: "/transaction", label: "إضافة حركة", icon: PlusCircle },
        { path: "/summary", label: "خلاصة الحسابات", icon: FileText },
        { path: "/forms", label: "المعاملات المالية", icon: FolderOpen },
        { path: "/sdi-analysis", label: "تحليل منحة SDI", icon: BarChart3 },
      ],
    },
    { path: "/timetable", label: "الجدول المدرسي", icon: CalendarDays },
    { path: "/exams", label: "جداول الامتحانات", icon: ClipboardList },
    { path: "/secretary", label: "السكرتير", icon: Archive },
    { path: "/committees", label: "اللجان", icon: Users },
    { path: "/instructions", label: "التعليمات", icon: CircleHelp },
    { path: "/settings", label: "الإعدادات", icon: Settings },
    ...(isAdmin ? [
      { path: "/users", label: "إدارة المستخدمين", icon: Users },
      { path: "/code-docs", label: "توثيق الكود", icon: Code },
      { path: "/presentation", label: "العرض التقديمي", icon: Presentation },
    ] : []),
  ];

  // Filter entries based on client role
  const entries: SidebarEntry[] = isClient && clientRole
    ? allEntries.filter((entry) => {
        if (isGroup(entry)) return false; // hide finance group for clients
        const allowedPaths = clientRole === "assistant" ? assistantPaths : secretaryPaths;
        return allowedPaths.includes((entry as NavItem).path);
      })
    : allEntries;

  const renderLink = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        }`}
      >
        <item.icon className="w-5 h-5" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="gradient-sidebar w-64 min-h-screen flex flex-col border-l border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
            <School className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-sidebar-foreground font-bold text-lg leading-tight">الادارة المدرسية</h1>
            <p className="text-sidebar-foreground/60 text-xs">{schoolName || "نظام إدارة مالية"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {entries.map((entry, idx) => {
          if (isGroup(entry)) {
            return (
              <div key={idx}>
                <button
                  onClick={() => setFinanceOpen(!financeOpen)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    financeActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <entry.icon className="w-5 h-5" />
                  <span className="flex-1 text-right">{entry.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${financeOpen ? "rotate-180" : ""}`} />
                </button>
                {financeOpen && (
                  <div className="mr-4 mt-1 space-y-1 border-r border-sidebar-border/40 pr-2">
                    {entry.children.map(renderLink)}
                  </div>
                )}
              </div>
            );
          }
          return renderLink(entry);
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        {/* Update Button */}
        {/* Update Button - always visible */}
        <Button
          variant="ghost"
          onClick={handleUpdateClick}
          disabled={isUpdating}
          className={`w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 relative ${
            hasUpdate ? "text-primary font-semibold" : ""
          }`}
        >
          {isUpdating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <div className="relative">
              <Download className="w-5 h-5" />
              {hasUpdate && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full animate-pulse" />
              )}
            </div>
          )}
          <span className="flex-1 text-right">
            {updateStatus === "checking" ? `جاري التحقق من GitHub Releases...` :
             updateStatus === "available" ? `تحديث متاح ${updateVersion} • الحالي ${currentVersion}` :
             updateStatus === "downloading" ? `تحميل ${updateProgress}% • الجديد ${updateVersion}` :
             updateStatus === "downloaded" ? `جاهز للتثبيت ${updateVersion}` :
             "التحديثات"}
          </span>
        </Button>
        {updateStatus === "downloading" && (
          <Progress value={updateProgress} className="h-1.5 mx-2" />
        )}

        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </Button>
        <p className="text-sidebar-foreground/40 text-xs text-center">
          {isAdmin ? "مدير النظام" : "مدرسة"} • الإصدار {currentVersion}
        </p>
        <p className="text-sidebar-foreground/40 text-[10px] text-center mt-1">
          © {new Date().getFullYear()} Ali Megdadi. جميع الحقوق محفوظة
        </p>
      </div>
    </aside>
  );
}
