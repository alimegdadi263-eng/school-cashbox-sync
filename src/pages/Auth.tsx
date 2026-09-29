import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarDays, ClipboardList, LockKeyhole, Mail, School, Users } from "lucide-react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60_000; // 1 minute

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const attemptsRef = useRef(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const startLockout = () => {
    const unlockAt = Date.now() + LOCKOUT_DURATION;
    lockoutTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        const timer = lockoutTimerRef.current;
        if (timer) clearInterval(timer);
        lockoutTimerRef.current = null;
        attemptsRef.current = 0;
      }
    }, 1000);
    setLockoutRemaining(Math.ceil(LOCKOUT_DURATION / 1000));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutRemaining > 0) {
      toast({ title: "محاولات كثيرة", description: `انتظر ${lockoutRemaining} ثانية`, variant: "destructive" });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || trimmedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "خطأ", description: "بريد إلكتروني غير صالح", variant: "destructive" });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      toast({ title: "خطأ", description: "كلمة المرور غير صالحة", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) {
        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          startLockout();
          toast({ title: "تم قفل الحساب مؤقتاً", description: "حاولت كثيراً، انتظر دقيقة", variant: "destructive" });
        } else {
          toast({
            title: "خطأ في تسجيل الدخول",
            description: `تحقق من البيانات (${MAX_ATTEMPTS - attemptsRef.current} محاولات متبقية)`,
            variant: "destructive",
          });
        }
        return;
      }
      attemptsRef.current = 0;
      toast({ title: "تم تسجيل الدخول بنجاح" });
    } catch (error: any) {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="academic-grid flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-accent/20 bg-card shadow-formal">
        <div className="relative border-t-4 border-accent bg-primary px-8 py-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-accent bg-card shadow-formal">
            <School className="h-11 w-11 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">نظام إدارة المدرسة</h1>
          <p className="mt-1 text-sm font-medium text-accent">البوابة الإدارية المتكاملة</p>
        </div>
        <div className="px-8 py-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label className="pr-1 text-sm font-semibold text-primary">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-foreground/70" />
                <Input className="h-12 rounded-lg border-border bg-background pr-10 focus-visible:ring-accent" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="أدخل البريد الإلكتروني" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="pr-1 text-sm font-semibold text-primary">كلمة المرور</Label>
              <div className="relative">
                <LockKeyhole className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-foreground/70" />
                <Input className="h-12 rounded-lg border-border bg-background pr-10 focus-visible:ring-accent" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
            </div>
            <Button type="submit" className="h-12 w-full gap-2 rounded-lg font-bold shadow-card" disabled={loading || lockoutRemaining > 0}>
              {lockoutRemaining > 0 ? `انتظر ${lockoutRemaining} ثانية` : loading ? "جاري الدخول..." : "تسجيل الدخول"}
              <ArrowLeft className="h-4 w-4 opacity-70" />
            </Button>
          </form>
          <div className="mt-7 border-t pt-5">
            <p className="mb-4 text-center text-[11px] text-muted-foreground">الوصول إلى الأقسام الإدارية</p>
            <div className="flex items-center justify-around text-primary/70">
              {[{ label: "الطلبة", icon: Users }, { label: "الجدول", icon: CalendarDays }, { label: "السجلات", icon: ClipboardList }].map(({ label, icon: Icon }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-background"><Icon className="h-4 w-4" /></span>
                  <span className="text-[10px] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
