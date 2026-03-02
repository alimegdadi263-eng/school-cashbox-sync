import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, Eye, EyeOff } from "lucide-react";

interface ChangePasswordDialogProps {
  targetUserId?: string;
  targetName?: string;
  trigger?: React.ReactNode;
}

export default function ChangePasswordDialog({ targetUserId, targetName, trigger }: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 8 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { newPassword };
      if (targetUserId) body.targetUserId = targetUserId;

      const { data, error } = await supabase.functions.invoke("change-password", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "تم بنجاح", description: "تم تغيير كلمة المرور" });
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل تغيير كلمة المرور", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
            <KeyRound className="w-3 h-3" />
            تغيير كلمة المرور
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تغيير كلمة المرور {targetName ? `- ${targetName}` : ""}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>كلمة المرور الجديدة</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8 أحرف على الأقل"
                required
                minLength={8}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>تأكيد كلمة المرور</Label>
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد إدخال كلمة المرور"
              required
            />
          </div>
          <Button type="submit" className="w-full gradient-accent text-accent-foreground" disabled={loading}>
            {loading ? "جاري التغيير..." : "تغيير كلمة المرور"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
