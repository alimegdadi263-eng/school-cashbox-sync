import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LockKeyhole, Mail, School } from "lucide-react";

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
        clearInterval(lockoutTimerRef.current!);
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
    <div className="academic-grid min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <Card className="relative w-full max-w-sm overflow-hidden border-primary/10 shadow-card">
        <div className="flex h-2 w-full" aria-hidden="true">
          <span className="flex-1 bg-primary" />
          <span className="w-1/3 bg-accent" />
        </div>
        <CardHeader className="space-y-5 px-8 pb-4 pt-9 text-center">
          <div className="relative mx-auto flex h-20 w-20 rotate-3 items-center justify-center rounded-2xl gradient-primary shadow-card-hover">
            <span className="absolute inset-0 scale-110 rounded-2xl border-2 border-accent/30" />
            <School className="h-10 w-10 -rotate-3 text-accent" />
          </div>
          <div>
            <CardTitle className="text-2xl text-primary">الإدارة المدرسية</CardTitle>
            <p className="mt-1 text-xs font-medium text-muted-foreground">منصة الإدارة الذكية المتكاملة</p>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-9">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label className="pr-1 text-xs font-bold text-primary/70">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-12 rounded-xl border-primary/15 bg-background/70 pr-11 focus-visible:ring-accent" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="pr-1 text-xs font-bold text-primary/70">كلمة المرور</Label>
              <div className="relative">
                <LockKeyhole className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-12 rounded-xl border-primary/15 bg-background/70 pr-11 focus-visible:ring-accent" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
            </div>
            <Button type="submit" className="h-13 w-full gap-2 rounded-xl bg-primary font-bold text-primary-foreground shadow-card hover:bg-sidebar-accent" disabled={loading || lockoutRemaining > 0}>
              {lockoutRemaining > 0 ? `انتظر ${lockoutRemaining} ثانية` : loading ? "جاري الدخول..." : "تسجيل الدخول"}
              <ArrowLeft className="h-4 w-4 opacity-70" />
            </Button>
          </form>
          <div className="mt-9 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <span className="h-px w-8 bg-accent/40" />
            <span>نظام الإدارة المدرسية</span>
            <span className="h-px w-8 bg-accent/40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
