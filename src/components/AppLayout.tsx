import { ReactNode, useState } from "react";
import { Menu, School, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppSidebar from "./AppSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {menuOpen && <Button variant="ghost" className="fixed inset-0 z-40 h-auto w-auto rounded-none bg-foreground/30 p-0 md:hidden" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} />}
      <div className={`fixed inset-y-0 right-0 z-50 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <Button variant="ghost" size="icon" className="absolute left-3 top-3 z-10 text-sidebar-foreground md:hidden" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة">
          <X className="h-5 w-5" />
        </Button>
        <AppSidebar onNavigate={() => setMenuOpen(false)} />
      </div>
      <main className="min-w-0 flex-1 overflow-auto">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-accent/20 bg-card/95 px-4 shadow-sm backdrop-blur md:hidden">
          <div className="flex items-center gap-3 font-bold text-primary"><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-accent"><School className="h-5 w-5" /></span> إدارة المدرسة</div>
          <Button variant="outline" size="icon" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة"><Menu className="h-5 w-5" /></Button>
        </header>
        <div className="mx-auto max-w-[1440px] animate-fade-in p-4 md:p-7 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
