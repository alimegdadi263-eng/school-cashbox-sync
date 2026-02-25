import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Trash2 } from "lucide-react";

interface SchoolUser {
  id: string;
  school_name: string;
  email: string;
  role: string;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<SchoolUser[]>([]);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, school_name");

    if (profiles) {
      // Get roles for each profile
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const userList = profiles.map((p) => ({
        id: p.id,
        school_name: p.school_name || "",
        email: "",
        role: roles?.find((r) => r.user_id === p.id)?.role || "school",
      }));
      setUsers(userList);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !schoolName) {
      toast({ title: "خطأ", description: "يرجى تعبئة جميع الحقول", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Use edge function to create user
      const { data, error } = await supabase.functions.invoke("create-school-user", {
        body: { email, password, schoolName },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "تم بنجاح", description: `تم إنشاء حساب لـ ${schoolName}` });
      setEmail("");
      setPassword("");
      setSchoolName("");
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الحساب",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              إضافة حساب مدرسة جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>اسم المدرسة</Label>
                <Input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="المدرسة الثانوية الشاملة"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="school@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="كلمة مرور قوية"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="gradient-accent text-accent-foreground" disabled={loading}>
                {loading ? "جاري الإنشاء..." : "إنشاء حساب"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              المستخدمون ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">لا يوجد مستخدمون بعد</p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{user.school_name || "بدون اسم"}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.role === "admin" ? "مدير النظام" : "مدرسة"}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-semibold ${
                      user.role === "admin" 
                        ? "bg-primary/10 text-primary" 
                        : "bg-success/10 text-success"
                    }`}>
                      {user.role === "admin" ? "مدير" : "مدرسة"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
