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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function AppSidebar() {
  const location = useLocation();
  const { isAdmin, schoolName, signOut } = useAuth();

  const navItems = [
    { path: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    { path: "/cashbook", label: "دفتر الصندوق", icon: BookOpen },
    { path: "/transaction", label: "إضافة حركة", icon: PlusCircle },
    { path: "/summary", label: "خلاصة الحسابات", icon: FileText },
    { path: "/forms", label: "المعاملات المالية", icon: FolderOpen },
    { path: "/instructions", label: "التعليمات", icon: CircleHelp },
    { path: "/settings", label: "الإعدادات", icon: Settings },
    ...(isAdmin ? [
      { path: "/users", label: "إدارة المستخدمين", icon: Users },
      { path: "/code-docs", label: "توثيق الكود", icon: Code },
    ] : []),
  ];

  return (
    <aside className="gradient-sidebar w-64 min-h-screen flex flex-col border-l border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
            <School className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-sidebar-foreground font-bold text-lg leading-tight">مالية المدارس</h1>
            <p className="text-sidebar-foreground/60 text-xs">{schoolName || "نظام إدارة مالية"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
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
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </Button>
        <p className="text-sidebar-foreground/40 text-xs text-center">
          {isAdmin ? "مدير النظام" : "مدرسة"} • الإصدار 1.0
        </p>
        <p className="text-sidebar-foreground/40 text-[10px] text-center mt-1">
          © {new Date().getFullYear()} Ali Megdadi. جميع الحقوق محفوظة
        </p>
      </div>
    </aside>
  );
}
