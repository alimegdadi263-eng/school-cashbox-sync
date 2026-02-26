import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { School } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center">
            <School className="w-8 h-8 text-accent-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">مالية المدارس</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">تسجيل الدخول</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full gradient-accent text-accent-foreground" disabled={loading || lockoutRemaining > 0}>
              {lockoutRemaining > 0 ? `انتظر ${lockoutRemaining} ثانية` : loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
