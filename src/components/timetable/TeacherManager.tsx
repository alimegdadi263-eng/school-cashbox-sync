import { useState, useEffect } from "react";
import { useTimetable } from "@/context/TimetableContext";
import type { Teacher, SubjectAssignment, BlockedPeriod } from "@/types/timetable";
import { CLASS_NAMES, SECTIONS, DEFAULT_SUBJECTS } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit, UserPlus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BlockedPeriodsEditor from "./BlockedPeriodsEditor";

const CUSTOM_SUBJECTS_KEY = "school_custom_subjects";

export default function TeacherManager() {
  const { teachers, addTeacher, updateTeacher, removeTeacher, periodsPerDay } = useTimetable();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [name, setName] = useState("");
  const [subjects, setSubjects] = useState<SubjectAssignment[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [newClass, setNewClass] = useState(CLASS_NAMES[0]);
  const [newSection, setNewSection] = useState(SECTIONS[0]);
  const [newPeriods, setNewPeriods] = useState(3);
  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);

  // Load custom subjects from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_SUBJECTS_KEY);
      if (saved) setCustomSubjects(JSON.parse(saved));
    } catch {}
  }, []);

  const allSubjects = [...DEFAULT_SUBJECTS, ...customSubjects];

  const addCustomSubject = () => {
    const trimmed = customSubjectInput.trim();
    if (!trimmed) return;
    if (allSubjects.includes(trimmed)) {
      toast({ title: "المادة موجودة بالفعل", variant: "destructive" });
      return;
    }
    const updated = [...customSubjects, trimmed];
    setCustomSubjects(updated);
    localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(updated));
    setNewSubject(trimmed);
    setCustomSubjectInput("");
    toast({ title: `تمت إضافة المادة: ${trimmed}` });
  };
  const [newPeriods, setNewPeriods] = useState(3);

  const resetForm = () => {
    setName("");
    setSubjects([]);
    setBlockedPeriods([]);
    setNewSubject("");
    setNewClass(CLASS_NAMES[0]);
    setNewSection(SECTIONS[0]);
    setNewPeriods(3);
    setEditingTeacher(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setName(t.name);
    setSubjects([...t.subjects]);
    setBlockedPeriods([...(t.blockedPeriods || [])]);
    setDialogOpen(true);
  };

  const addSubjectRow = () => {
    if (!newSubject.trim()) {
      toast({ title: "أدخل اسم المادة", variant: "destructive" });
      return;
    }
    setSubjects([...subjects, {
      subjectName: newSubject.trim(),
      className: newClass,
      section: newSection,
      periodsPerWeek: newPeriods,
    }]);
    setNewSubject("");
  };

  const removeSubjectRow = (idx: number) => {
    setSubjects(subjects.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "أدخل اسم المعلم", variant: "destructive" });
      return;
    }
    if (subjects.length === 0) {
      toast({ title: "أضف مادة واحدة على الأقل", variant: "destructive" });
      return;
    }

    if (editingTeacher) {
      updateTeacher({ ...editingTeacher, name: name.trim(), subjects, blockedPeriods });
      toast({ title: "تم تحديث المعلم بنجاح" });
    } else {
      addTeacher({ id: crypto.randomUUID(), name: name.trim(), subjects, blockedPeriods });
      toast({ title: "تم إضافة المعلم بنجاح" });
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    removeTeacher(id);
    toast({ title: "تم حذف المعلم" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">إدارة المعلمين</CardTitle>
        <Button onClick={openAdd} size="sm">
          <UserPlus className="w-4 h-4 ml-2" />
          إضافة معلم
        </Button>
      </CardHeader>
      <CardContent>
        {teachers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">لا يوجد معلمون بعد. أضف معلماً للبدء.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المعلم</TableHead>
                <TableHead className="text-right">المواد والصفوف</TableHead>
                <TableHead className="text-right">إجمالي الحصص</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.subjects.map((s, i) => (
                        <span key={i} className="inline-block bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded">
                          {s.subjectName} - {s.className}/{s.section} ({s.periodsPerWeek})
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{t.subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTeacher ? "تعديل معلم" : "إضافة معلم جديد"}</DialogTitle>
            <DialogDescription>أدخل بيانات المعلم والمواد التي يدرسها</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>اسم المعلم</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المعلم" />
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-base font-semibold">المواد الدراسية</Label>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                <div>
                  <Label className="text-xs">المادة</Label>
                  <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="اسم المادة" />
                </div>
                <div>
                  <Label className="text-xs">الصف</Label>
                  <Select value={newClass} onValueChange={setNewClass}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLASS_NAMES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">الشعبة</Label>
                  <Select value={newSection} onValueChange={setNewSection}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">حصص/أسبوع</Label>
                  <Input type="number" min={1} max={35} value={newPeriods} onChange={e => setNewPeriods(Number(e.target.value))} />
                </div>
                <Button onClick={addSubjectRow} size="sm" className="self-end">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {subjects.length > 0 && (
                <div className="space-y-1 mt-2">
                  {subjects.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted px-3 py-1.5 rounded text-sm">
                      <span>{s.subjectName} - الصف {s.className} / شعبة {s.section} ({s.periodsPerWeek} حصص)</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSubjectRow(i)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <BlockedPeriodsEditor
              periodsPerDay={periodsPerDay}
              blockedPeriods={blockedPeriods}
              onChange={setBlockedPeriods}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editingTeacher ? "حفظ التعديلات" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
