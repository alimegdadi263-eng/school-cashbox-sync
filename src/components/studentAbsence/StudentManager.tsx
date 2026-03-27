import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, Download } from "lucide-react";
import type { StudentInfo } from "@/types/studentAbsence";
import { STUDENTS_LIST_KEY } from "@/types/studentAbsence";

interface Props {
  userId: string;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export default function StudentManager({ userId }: Props) {
  const { toast } = useToast();
  const storageKey = `${STUDENTS_LIST_KEY}_${userId}`;

  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [filterClass, setFilterClass] = useState("");

  // Custom classes management
  const classesKey = `student_classes_${userId}`;
  const [classes, setClasses] = useState<string[]>([]);
  const [newClass, setNewClass] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setStudents(JSON.parse(saved));
      const savedClasses = localStorage.getItem(classesKey);
      if (savedClasses) setClasses(JSON.parse(savedClasses));
    } catch {}
  }, [storageKey, classesKey]);

  const saveStudents = (list: StudentInfo[]) => {
    setStudents(list);
    localStorage.setItem(storageKey, JSON.stringify(list));
  };

  const saveClasses = (list: string[]) => {
    setClasses(list);
    localStorage.setItem(classesKey, JSON.stringify(list));
  };

  const addClass = () => {
    const trimmed = newClass.trim();
    if (!trimmed) return;
    if (classes.includes(trimmed)) {
      toast({ title: "الصف موجود مسبقاً", variant: "destructive" });
      return;
    }
    saveClasses([...classes, trimmed]);
    setNewClass("");
    toast({ title: "تم إضافة الصف" });
  };

  const removeClass = (c: string) => {
    saveClasses(classes.filter(x => x !== c));
  };

  const addStudent = () => {
    if (!name.trim()) { toast({ title: "أدخل اسم الطالب", variant: "destructive" }); return; }
    if (!className) { toast({ title: "اختر الصف", variant: "destructive" }); return; }
    if (!parentPhone.trim()) { toast({ title: "أدخل رقم ولي الأمر", variant: "destructive" }); return; }

    const student: StudentInfo = {
      id: generateId(),
      name: name.trim(),
      className,
      parentPhone: parentPhone.trim(),
      parentName: parentName.trim() || undefined,
    };
    saveStudents([...students, student]);
    setName(""); setParentPhone(""); setParentName("");
    toast({ title: "تم إضافة الطالب" });
  };

  const deleteStudent = (id: string) => {
    saveStudents(students.filter(s => s.id !== id));
    toast({ title: "تم حذف الطالب" });
  };

  const filtered = filterClass ? students.filter(s => s.className === filterClass) : students;
  const uniqueClasses = [...new Set(students.map(s => s.className))];

  // Export students as CSV
  const exportCSV = () => {
    const header = "اسم الطالب,الصف,رقم ولي الأمر,اسم ولي الأمر\n";
    const rows = students.map(s => `${s.name},${s.className},${s.parentPhone},${s.parentName || ""}`).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "students.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Import from CSV
  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      const newStudents: StudentInfo[] = [];
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts.length >= 3) {
          newStudents.push({
            id: generateId(),
            name: parts[0].trim(),
            className: parts[1].trim(),
            parentPhone: parts[2].trim(),
            parentName: parts[3]?.trim() || undefined,
          });
          // Auto-add class if not exists
          if (!classes.includes(parts[1].trim())) {
            classes.push(parts[1].trim());
          }
        }
      }
      if (newStudents.length > 0) {
        saveStudents([...students, ...newStudents]);
        saveClasses([...classes]);
        toast({ title: `تم استيراد ${newStudents.length} طالب` });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Classes Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📚 إدارة الصفوف</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {classes.map(c => (
              <div key={c} className="flex items-center gap-1 bg-muted rounded-lg px-3 py-1.5 text-sm">
                <span>{c}</span>
                <button onClick={() => removeClass(c)} className="text-destructive hover:text-destructive/80 mr-1">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newClass} onChange={e => setNewClass(e.target.value)} placeholder="اسم الصف (مثال: العاشر أ)" className="max-w-xs" onKeyDown={e => e.key === "Enter" && addClass()} />
            <Button size="sm" onClick={addClass}><Plus className="w-4 h-4 ml-1" /> إضافة صف</Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Student */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">➕ إضافة طالب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>اسم الطالب</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الطالب" />
            </div>
            <div className="space-y-1">
              <Label>الصف</Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>رقم ولي الأمر</Label>
              <Input value={parentPhone} onChange={e => setParentPhone(e.target.value)} placeholder="07XXXXXXXX" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>اسم ولي الأمر (اختياري)</Label>
              <Input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="اسم ولي الأمر" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={addStudent}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 ml-1" /> تصدير CSV</Button>
            <label>
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 ml-1" /> استيراد CSV</span></Button>
              <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      {students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📋 قائمة الطلبة ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Select value={filterClass || "__all__"} onValueChange={v => setFilterClass(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-52"><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">جميع الصفوف</SelectItem>
                  {uniqueClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">م</TableHead>
                    <TableHead className="text-center">اسم الطالب</TableHead>
                    <TableHead className="text-center">الصف</TableHead>
                    <TableHead className="text-center">رقم ولي الأمر</TableHead>
                    <TableHead className="text-center">اسم ولي الأمر</TableHead>
                    <TableHead className="text-center w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, idx) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center font-medium">{s.name}</TableCell>
                      <TableCell className="text-center">{s.className}</TableCell>
                      <TableCell className="text-center" dir="ltr">{s.parentPhone}</TableCell>
                      <TableCell className="text-center">{s.parentName || "-"}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => deleteStudent(s.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
