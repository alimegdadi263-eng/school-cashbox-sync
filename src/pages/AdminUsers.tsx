import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserPlus, Users, ShieldCheck, ShieldOff, Trash2, Eye, EyeOff, Clock, Search, Download } from "lucide-react";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface SchoolUser {
  id: string;
  school_name: string;
  email: string;
  password: string;
  role: string;
  is_active: boolean;
  subscription_expires_at: string | null;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = async () => {
    const [profilesRes, rolesRes, credsRes] = await Promise.all([
      supabase.from("profiles").select("id, school_name, is_active, subscription_expires_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("school_credentials").select("user_id, email, password_plain"),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const creds = credsRes.data || [];

    const userList = profiles.map((p) => {
      const cred = creds.find((c) => c.user_id === p.id);
      return {
        id: p.id,
        school_name: p.school_name || "",
        email: cred?.email || "",
        password: cred?.password_plain || "",
        role: roles.find((r) => r.user_id === p.id)?.role || "school",
        is_active: p.is_active,
        subscription_expires_at: p.subscription_expires_at,
      };
    });
    setUsers(userList);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedSchool = schoolName.trim();

    if (!trimmedEmail || !password || !trimmedSchool) {
      toast({ title: "خطأ", description: "يرجى تعبئة جميع الحقول", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 255) {
      toast({ title: "خطأ", description: "بريد إلكتروني غير صالح", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 8 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (trimmedSchool.length > 100) {
      toast({ title: "خطأ", description: "اسم المدرسة طويل جداً", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { data, error } = await supabase.functions.invoke("create-school-user", {
        body: { email, password, schoolName },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Set subscription expiry to 1 year
      if (data?.userId) {
        await supabase.from("profiles").update({
          subscription_expires_at: expiresAt.toISOString(),
        }).eq("id", data.userId);
      }

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

  const toggleUserActive = async (userId: string, currentlyActive: boolean) => {
    const updates: Record<string, any> = { is_active: !currentlyActive };
    
    // If activating, set subscription to 1 year from now
    if (!currentlyActive) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      updates.subscription_expires_at = expiresAt.toISOString();
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      toast({ title: "خطأ", description: "فشل في تحديث الحالة", variant: "destructive" });
    } else {
      toast({
        title: "تم",
        description: currentlyActive ? "تم إيقاف الاشتراك" : "تم تفعيل الاشتراك لمدة سنة",
      });
      fetchUsers();
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-school-user", {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "تم الحذف", description: `تم حذف حساب ${userName}` });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حذف الحساب",
        variant: "destructive",
      });
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const filteredUsers = users.filter((u) =>
    u.school_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("المستخدمون", { views: [{ rightToLeft: true }] });

    ws.columns = [
      { header: "اسم المدرسة", key: "school", width: 30 },
      { header: "البريد الإلكتروني", key: "email", width: 30 },
      { header: "كلمة المرور", key: "password", width: 20 },
      { header: "الدور", key: "role", width: 12 },
      { header: "الحالة", key: "status", width: 12 },
      { header: "بداية الاشتراك", key: "start", width: 18 },
      { header: "نهاية الاشتراك", key: "end", width: 18 },
      { header: "الأيام المتبقية", key: "days", width: 15 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.alignment = { horizontal: "center" };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };

    users.forEach((u) => {
      const daysLeft = u.subscription_expires_at
        ? Math.max(0, Math.ceil((new Date(u.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
      ws.addRow({
        school: u.school_name || "بدون اسم",
        email: u.email,
        password: u.password,
        role: u.role === "admin" ? "مدير" : "مدرسة",
        status: u.role === "admin" ? "—" : u.is_active ? "مفعّل" : "موقوف",
        start: u.subscription_expires_at
          ? new Date(new Date(u.subscription_expires_at).getTime() - 365 * 24 * 60 * 60 * 1000).toLocaleDateString("ar-EG")
          : "—",
        end: u.subscription_expires_at
          ? new Date(u.subscription_expires_at).toLocaleDateString("ar-EG")
          : "—",
        days: daysLeft !== null ? (daysLeft > 0 ? daysLeft : "منتهي") : "—",
      });
    });

    ws.eachRow((row) => {
      row.alignment = { horizontal: "center", vertical: "middle" };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `المستخدمون_${new Date().toLocaleDateString("ar-EG")}.xlsx`);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>

        {/* Create user form */}
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

        {/* Users list */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                المستخدمون ({users.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={handleExportExcel} className="text-xs gap-1">
                <Download className="w-4 h-4" />
                تصدير Excel
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم المدرسة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {searchQuery ? "لا توجد نتائج مطابقة" : "لا يوجد مستخدمون بعد"}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => {
                  const daysLeft = user.subscription_expires_at
                    ? Math.max(0, Math.ceil((new Date(user.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : null;

                  return (
                  <div key={user.id} className="p-4 rounded-lg bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{user.school_name || "بدون اسم"}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.role === "admin" ? "مدير النظام" : "مدرسة"}
                          {user.role !== "admin" && (
                            <span className={`mr-2 ${user.is_active ? "text-success" : "text-destructive"}`}>
                              • {user.is_active ? "نشط" : "موقوف"}
                            </span>
                          )}
                        </p>
                        {user.role !== "admin" && user.subscription_expires_at && (
                          <div className="text-xs mt-1 space-y-0.5">
                            <p className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span className={daysLeft !== null && daysLeft <= 30 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                                {daysLeft !== null ? (daysLeft > 0 ? `متبقي ${daysLeft} يوم` : "منتهي الصلاحية") : "—"}
                              </span>
                            </p>
                            <p className="text-muted-foreground flex gap-3 mr-4">
                              <span>من: {new Date(new Date(user.subscription_expires_at).getTime() - 365 * 24 * 60 * 60 * 1000).toLocaleDateString("ar-EG")}</span>
                              <span>إلى: {new Date(user.subscription_expires_at).toLocaleDateString("ar-EG")}</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-semibold ${
                          user.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : user.is_active
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive"
                        }`}>
                          {user.role === "admin" ? "مدير" : user.is_active ? "مفعّل" : "موقوف"}
                        </span>
                        <ChangePasswordDialog
                          targetUserId={user.id}
                          targetName={user.school_name || user.email}
                        />
                        {user.role !== "admin" && (
                          <>
                            <Button
                              size="sm"
                              variant={user.is_active ? "destructive" : "default"}
                              onClick={() => toggleUserActive(user.id, user.is_active)}
                              className="text-xs h-7 px-3"
                            >
                              {user.is_active ? (
                                <><ShieldOff className="w-3 h-3 ml-1" /> إيقاف</>
                              ) : (
                                <><ShieldCheck className="w-3 h-3 ml-1" /> تفعيل</>
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" className="text-xs h-7 px-2">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف حساب "{user.school_name}"؟ لا يمكن التراجع عن هذا الإجراء.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.school_name)}>
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Credentials display */}
                    {user.email && (
                      <div className="flex items-center gap-4 text-xs bg-background/50 rounded p-2 border border-border/50">
                        <span className="text-muted-foreground">البريد:</span>
                        <span className="font-mono">{user.email}</span>
                        {user.password && (
                          <>
                            <span className="text-muted-foreground mr-2">كلمة المرور:</span>
                            <span className="font-mono">
                              {visiblePasswords[user.id] ? user.password : "••••••••"}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={() => togglePasswordVisibility(user.id)}
                            >
                              {visiblePasswords[user.id] ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
