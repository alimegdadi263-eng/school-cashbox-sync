import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  BookOpen, 
  PlusCircle, 
  Settings, 
  FileText,
  School
} from "lucide-react";

const navItems = [
  { path: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { path: "/cashbook", label: "دفتر الصندوق", icon: BookOpen },
  { path: "/transaction", label: "إضافة حركة", icon: PlusCircle },
  { path: "/summary", label: "خلاصة الحسابات", icon: FileText },
  { path: "/settings", label: "الإعدادات", icon: Settings },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="gradient-sidebar w-64 min-h-screen flex flex-col border-l border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
            <School className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-sidebar-foreground font-bold text-lg leading-tight">مالية المدارس</h1>
            <p className="text-sidebar-foreground/60 text-xs">نظام إدارة مالية</p>
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

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-sidebar-foreground/40 text-xs text-center">الإصدار 1.0</p>
      </div>
    </aside>
  );
}
