import { useState, useEffect } from "react";
import { useTimetable } from "@/context/TimetableContext";
import type { Teacher, SubjectAssignment, BlockedPeriod } from "@/types/timetable";
import { CLASS_NAMES, SECTIONS, DEFAULT_SUBJECTS, SECONDARY_CLASSES, normalizeSubjectName } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit, UserPlus, X, Upload, FileSpreadsheet, FileText, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BlockedPeriodsEditor from "./BlockedPeriodsEditor";
import * as ExcelJS from "exceljs";

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
  const [newBranch, setNewBranch] = useState("");
  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const [savedBranches, setSavedBranches] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem("school_saved_branches");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
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
      branch: SECONDARY_CLASSES.includes(newClass) ? newBranch : undefined,
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

  // Import teachers from Excel - supports multiple formats
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("لا يوجد أوراق");

      const imported: Teacher[] = [];

      // Detect format: check if column headers contain "الصف/الشعبة" (merged format)
      // Format A (كشف أنصبة): م | اسم المعلم | المادة | الصف/الشعبة | الحصص | إجمالي
      // Format B (simple): اسم المعلم | المادة | الصف | الشعبة | الحصص | الفرع

      let isMergedFormat = false;
      let headerRow = 0;
      
      // Find header row and detect format
      ws.eachRow((row, rowNum) => {
        if (headerRow > 0) return;
        for (let c = 1; c <= 6; c++) {
          const val = String(row.getCell(c).value || "").trim();
          if (val.includes("الصف") && val.includes("الشعبة")) {
            isMergedFormat = true;
            headerRow = rowNum;
            return;
          }
          if (val === "المادة" || val === "اسم المعلم" || val === "اسم المعلم/ة") {
            headerRow = rowNum;
          }
        }
      });

      if (headerRow === 0) headerRow = 1; // fallback

      if (isMergedFormat) {
        // Format A: teacher name only on first row, subsequent rows inherit
        // Columns: م(1) | اسم المعلم(2) | المادة(3) | الصف/الشعبة(4) | الحصص(5) | إجمالي(6)
        let currentTeacher: Teacher | null = null;

        ws.eachRow((row, rowNum) => {
          if (rowNum <= headerRow) return;
          
          const col1 = String(row.getCell(1).value || "").trim();
          const col2 = String(row.getCell(2).value || "").trim();
          const col3 = String(row.getCell(3).value || "").trim(); // المادة
          const col4 = String(row.getCell(4).value || "").trim(); // الصف/الشعبة
          const col5 = row.getCell(5).value; // الحصص

          // Skip summary/empty rows
          if (col2.includes("إجمالي") || col2.includes("المجموع")) return;
          if (!col3 && !col4) return;

          // New teacher if col1 has a number or col2 has a name
          if (col2 && (col1 && !isNaN(Number(col1)))) {
            currentTeacher = { id: crypto.randomUUID(), name: col2, subjects: [], blockedPeriods: [] };
            imported.push(currentTeacher);
          }

          if (!currentTeacher) return;
          if (!col3 || !col4) return;

          // Parse "الصف/الشعبة" - e.g. "الحادي عشر/أ"
          let className = "";
          let section = "أ";
          
          if (col4.includes("/")) {
            const parts = col4.split("/");
            className = parts[0].trim();
            section = parts[1].trim();
          } else {
            className = col4;
          }

          const periods = Number(col5) || 1;

          currentTeacher.subjects.push({
            subjectName: col3,
            className,
            section,
            branch: undefined,
            periodsPerWeek: periods,
          });

          // Auto-add new subjects to custom subjects list
          if (!allSubjects.includes(col3) && !imported.some(t => t === currentTeacher)) {
            // Will be added after loop
          }
        });

        // Collect all unique subjects and add missing ones to custom list
        const newSubjectsSet = new Set<string>();
        imported.forEach(t => t.subjects.forEach(s => {
          if (!allSubjects.includes(s.subjectName) && !newSubjectsSet.has(s.subjectName)) {
            newSubjectsSet.add(s.subjectName);
          }
        }));
        if (newSubjectsSet.size > 0) {
          const updatedCustom = [...customSubjects, ...Array.from(newSubjectsSet)];
          setCustomSubjects(updatedCustom);
          localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(updatedCustom));
        }

      } else {
        // Format B (simple): each row is independent
        ws.eachRow((row, rowNum) => {
          if (rowNum <= headerRow) return;
          const name = String(row.getCell(1).value || "").trim();
          if (!name) return;
          const subject = String(row.getCell(2).value || "").trim();
          const className = String(row.getCell(3).value || "").trim();
          const section = String(row.getCell(4).value || "أ").trim();
          const periods = Number(row.getCell(5).value) || 3;
          const branch = String(row.getCell(6).value || "").trim();

          let teacher = imported.find(t => t.name === name);
          if (!teacher) {
            teacher = { id: crypto.randomUUID(), name, subjects: [], blockedPeriods: [] };
            imported.push(teacher);
          }
          if (subject && className) {
            teacher.subjects.push({
              subjectName: subject,
              className,
              section,
              branch: branch || undefined,
              periodsPerWeek: periods,
            });
          }
        });
      }

      // Check for duplicate teacher names with existing teachers
      let skipped = 0;
      const toAdd = imported.filter(t => {
        if (teachers.some(existing => existing.name === t.name)) {
          skipped++;
          return false;
        }
        return true;
      });

      toAdd.forEach(t => addTeacher(t));
      
      const totalSubjects = toAdd.reduce((sum, t) => sum + t.subjects.length, 0);
      const totalPeriods = toAdd.reduce((sum, t) => sum + t.subjects.reduce((s, sub) => s + sub.periodsPerWeek, 0), 0);
      
      let msg = `تم استيراد ${toAdd.length} معلم (${totalSubjects} مادة، ${totalPeriods} حصة)`;
      if (skipped > 0) msg += ` - تم تخطي ${skipped} معلم مكرر`;
      
      toast({ title: msg });
    } catch (err) {
      toast({ title: "خطأ في استيراد الملف", description: String(err), variant: "destructive" });
    }
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">إدارة المعلمين</CardTitle>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="w-4 h-4 ml-1" />
                استيراد Excel
              </span>
            </Button>
          </label>
          <Button onClick={openAdd} size="sm">
            <UserPlus className="w-4 h-4 ml-2" />
            إضافة معلم
          </Button>
        </div>
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
                          {s.subjectName} - {s.className}{s.branch ? ` ${s.branch}` : ''}/{s.section} ({s.periodsPerWeek})
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
              
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                <div>
                  <Label className="text-xs">المادة</Label>
                  <Select value={newSubject} onValueChange={setNewSubject}>
                    <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                    <SelectContent>
                      {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">الصف</Label>
                  <Select value={newClass} onValueChange={v => { setNewClass(v); if (!SECONDARY_CLASSES.includes(v)) setNewBranch(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLASS_NAMES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {SECONDARY_CLASSES.includes(newClass) && (
                  <div>
                    <Label className="text-xs">الحقل</Label>
                    <div className="relative">
                      <Input
                        value={newBranch}
                        onChange={e => setNewBranch(e.target.value)}
                        onBlur={() => {
                          const trimmed = newBranch.trim();
                          if (trimmed && !savedBranches.includes(trimmed)) {
                            const updated = [...savedBranches, trimmed];
                            setSavedBranches(updated);
                            localStorage.setItem("school_saved_branches", JSON.stringify(updated));
                          }
                        }}
                        placeholder="ادخل اسم الحقل"
                        list="branch-suggestions"
                        className="h-9"
                      />
                      <datalist id="branch-suggestions">
                        {savedBranches.map(b => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                  </div>
                )}
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

              {/* إضافة مادة جديدة */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">إضافة مادة غير موجودة بالقائمة</Label>
                  <Input
                    value={customSubjectInput}
                    onChange={e => setCustomSubjectInput(e.target.value)}
                    placeholder="اسم المادة الجديدة..."
                    onKeyDown={e => e.key === "Enter" && addCustomSubject()}
                  />
                </div>
                <Button onClick={addCustomSubject} size="sm" variant="outline" className="self-end">
                  <Plus className="w-4 h-4 ml-1" /> إضافة للقائمة
                </Button>
              </div>

              {subjects.length > 0 && (
                <div className="space-y-1 mt-2">
                  {subjects.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted px-3 py-1.5 rounded text-sm">
                      <span>{s.subjectName} - الصف {s.className}{s.branch ? ` ${s.branch}` : ''} / شعبة {s.section} ({s.periodsPerWeek} حصص)</span>
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
