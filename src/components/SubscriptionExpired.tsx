import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";

export default function SubscriptionExpired() {
  const { signOut, schoolName } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">الاشتراك منتهي</h1>
        <p className="text-muted-foreground">
          عذراً، اشتراك <span className="font-semibold text-foreground">{schoolName || "مدرستك"}</span> غير نشط حالياً.
          يرجى التواصل مع إدارة النظام لتجديد الاشتراك.
        </p>
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          للتواصل مع الدعم الفني أو تجديد الاشتراك، يرجى الاتصال بمدير النظام.
        </div>
        <Button variant="outline" onClick={signOut} className="mt-4">
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
