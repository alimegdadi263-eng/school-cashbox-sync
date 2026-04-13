import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFinance } from "@/context/FinanceContext";
import { generateCommitteeDocx, CommitteeMember } from "@/lib/generateCommitteeDocx";
import { Plus, Trash2, FileText, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLE_OPTIONS = ["رئيسا", "نائب الرئيس", "عضوا", "معلم", "مساعد مدير", "مرشد", "سكرتير", "طالب"];

export default function CommitteesPage() {
  const { toast } = useToast();
  const { state } = useFinance();

  const [committeeName, setCommitteeName] = useState("");
  const [academicYear, setAcademicYear] = useState("2025/2026");
  const [directorName, setDirectorName] = useState(state.directorName || "");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [members, setMembers] = useState<CommitteeMember[]>([
    { name: "", role: "رئيسا" },
    { name: "", role: "عضوا" },
    { name: "", role: "عضوا" },
    { name: "", role: "عضوا" },
  ]);

  // Saved committees
  const [savedCommittees, setSavedCommittees] = useState<Array<{
    id: string;
    committeeName: string;
    academicYear: string;
    directorName: string;
    schoolPhone: string;
    members: CommitteeMember[];
  }>>(() => {
    try {
      const saved = localStorage.getItem("school-committees");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const addMember = () => {
    setMembers([...members, { name: "", role: "عضوا" }]);
  };

  const removeMember = (index: number) => {
    if (members.length <= 2) {
      toast({ title: "يجب وجود عضوين على الأقل", variant: "destructive" });
      return;
    }
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof CommitteeMember, value: string) => {
    setMembers(members.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleSave = () => {
    if (!committeeName.trim()) {
      toast({ title: "أدخل اسم اللجنة", variant: "destructive" });
      return;
    }
    const newCommittee = {
      id: Date.now().toString(),
      committeeName,
      academicYear,
      directorName,
      schoolPhone,
      members: members.filter(m => m.name.trim()),
    };
    const updated = [...savedCommittees, newCommittee];
    setSavedCommittees(updated);
    localStorage.setItem("school-committees", JSON.stringify(updated));
    toast({ title: "تم حفظ اللجنة بنجاح" });
  };

  const handleExport = async () => {
    if (!committeeName.trim()) {
      toast({ title: "أدخل اسم اللجنة", variant: "destructive" });
      return;
    }
    const filledMembers = members.filter(m => m.name.trim());
    if (filledMembers.length === 0) {
      toast({ title: "أدخل أعضاء اللجنة", variant: "destructive" });
      return;
    }
    await generateCommitteeDocx({
      committeeName,
      academicYear,
      members: filledMembers,
      directorName,
      schoolPhone,
      schoolName: state.schoolName,
      directorateName: state.directorateName,
    });
    toast({ title: "تم تصدير كتاب اللجنة بنجاح" });
  };

  const loadCommittee = (committee: typeof savedCommittees[0]) => {
    setCommitteeName(committee.committeeName);
    setAcademicYear(committee.academicYear);
    setDirectorName(committee.directorName);
    setSchoolPhone(committee.schoolPhone);
    setMembers(committee.members.length > 0 ? committee.members : [{ name: "", role: "رئيسا" }, { name: "", role: "عضوا" }]);
  };

  const deleteCommittee = (id: string) => {
    const updated = savedCommittees.filter(c => c.id !== id);
    setSavedCommittees(updated);
    localStorage.setItem("school-committees", JSON.stringify(updated));
    toast({ title: "تم حذف اللجنة" });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl" dir="rtl">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">اللجان المدرسية</h1>
            <p className="text-muted-foreground text-sm">إنشاء وإدارة كتب تشكيل اللجان</p>
          </div>
        </div>

        {/* Committee Form */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">بيانات اللجنة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم اللجنة</Label>
                <Input
                  value={committeeName}
                  onChange={e => setCommitteeName(e.target.value)}
                  placeholder='مثال: مبادرة "مقدام" و الأفكار الريادية'
                />
              </div>
              <div className="space-y-2">
                <Label>العام الدراسي</Label>
                <Input
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  placeholder="2025/2026"
                />
              </div>
              <div className="space-y-2">
                <Label>اسم مدير المدرسة</Label>
                <Input
                  value={directorName}
                  onChange={e => setDirectorName(e.target.value)}
                  placeholder="اسم المدير"
                />
              </div>
              <div className="space-y-2">
                <Label>تلفون المدرسة</Label>
                <Input
                  value={schoolPhone}
                  onChange={e => setSchoolPhone(e.target.value)}
                  placeholder="مثال: 7340130"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">أعضاء اللجنة</CardTitle>
            <Button size="sm" variant="outline" onClick={addMember}>
              <Plus className="w-4 h-4 ml-1" />
              إضافة عضو
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-bold text-muted-foreground w-8">{index + 1}-</span>
                <div className="flex-1">
                  <Input
                    value={member.name}
                    onChange={e => updateMember(index, "name", e.target.value)}
                    placeholder="اسم العضو"
                    className="h-9"
                  />
                </div>
                <div className="w-36">
                  <Select value={member.role} onValueChange={v => updateMember(index, "role", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeMember(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleSave} className="gradient-accent text-accent-foreground">
            حفظ اللجنة
          </Button>
          <Button onClick={handleExport} variant="outline">
            <FileText className="w-4 h-4 ml-2" />
            تصدير كتاب اللجنة (Word)
          </Button>
        </div>

        {/* Saved Committees */}
        {savedCommittees.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">اللجان المحفوظة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {savedCommittees.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{c.committeeName}</p>
                      <p className="text-xs text-muted-foreground">{c.academicYear} • {c.members.length} أعضاء</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadCommittee(c)}>تحميل</Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        await generateCommitteeDocx({
                          ...c,
                          schoolName: state.schoolName,
                          directorateName: state.directorateName,
                        });
                        toast({ title: "تم التصدير" });
                      }}>
                        <FileText className="w-4 h-4 ml-1" />
                        تصدير
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCommittee(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
