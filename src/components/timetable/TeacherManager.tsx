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
    const normalized = normalizeSubjectName(newSubject.trim());
    setSubjects([...subjects, {
      subjectName: normalized,
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

  const getExcelCellText = (value: ExcelJS.CellValue | null | undefined): string => {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value).trim();
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") {
      if ("text" in value && typeof value.text === "string") return value.text.trim();
      if ("richText" in value && Array.isArray(value.richText)) {
        return value.richText.map(part => part.text || "").join("").trim();
      }
      if ("result" in value && value.result != null) return String(value.result).trim();
      if ("formula" in value && value.formula) return String(value.formula).trim();
    }
    return String(value).trim();
  };

  // Import teachers from Excel - supports exported format exactly and merged variants
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("لا يوجد أوراق");

      const importedMap = new Map<string, Teacher>();
      const customColumns = {
        teacher: 1,
        subject: 2,
        className: 3,
        section: 4,
        periods: 5,
        branch: 6,
      };

      let headerRow = 1;
      let exportColumns: { teacher: number; subject: number; classSection: number; periods: number } | null = null;

      ws.eachRow((row, rowNum) => {
        if (exportColumns) return;
        const values = Array.from({ length: Math.max(row.cellCount, 6) }, (_, idx) => getExcelCellText(row.getCell(idx + 1).value));

        const teacherIdx = values.findIndex(val => ["اسم المعلم", "اسم المعلم/ة"].includes(val));
        const subjectIdx = values.findIndex(val => val === "المادة");
        const classSectionIdx = values.findIndex(val => val === "الصف/الشعبة");
        const periodsIdx = values.findIndex(val => val === "الحصص الأسبوعية");

        if (teacherIdx >= 0 && subjectIdx >= 0 && classSectionIdx >= 0 && periodsIdx >= 0) {
          headerRow = rowNum;
          exportColumns = {
            teacher: teacherIdx + 1,
            subject: subjectIdx + 1,
            classSection: classSectionIdx + 1,
            periods: periodsIdx + 1,
          };
        } else if (teacherIdx >= 0 || subjectIdx >= 0) {
          headerRow = rowNum;
        }
      });

      let lastTeacherName = "";

      ws.eachRow((row, rowNum) => {
        if (rowNum <= headerRow) return;

        const rowValues = Array.from({ length: Math.max(row.cellCount, 6) }, (_, idx) => getExcelCellText(row.getCell(idx + 1).value));
        if (rowValues.every(val => !val)) return;

        const isSummaryRow = rowValues.some(val => val.includes("إجمالي المعلمين") || val.includes("إجمالي الحصص") || val.includes("المجموع"));
        if (isSummaryRow) return;

        let teacherName = "";
        let subjectName = "";
        let className = "";
        let section = "أ";
        let branch = "";
        let periods = 0;

        if (exportColumns) {
          teacherName = rowValues[exportColumns.teacher - 1] || lastTeacherName;
          subjectName = rowValues[exportColumns.subject - 1];
          const classSection = rowValues[exportColumns.classSection - 1];
          periods = Number(rowValues[exportColumns.periods - 1]) || 0;

          if (classSection.includes("/")) {
            const [rawClassName, rawSection = "أ"] = classSection.split("/");
            className = rawClassName.trim();
            section = rawSection.trim() || "أ";
          } else {
            className = classSection.trim();
          }
        } else {
          teacherName = rowValues[customColumns.teacher - 1] || lastTeacherName;
          subjectName = rowValues[customColumns.subject - 1];
          className = rowValues[customColumns.className - 1];
          section = rowValues[customColumns.section - 1] || "أ";
          periods = Number(rowValues[customColumns.periods - 1]) || 0;
          branch = rowValues[customColumns.branch - 1];
        }

        teacherName = teacherName.trim();
        subjectName = normalizeSubjectName(subjectName.trim());
        className = className.trim();
        section = section.trim() || "أ";
        branch = branch.trim();

        if (!teacherName) return;
        lastTeacherName = teacherName;
        if (!subjectName || !className || periods <= 0) return;

        let teacher = importedMap.get(teacherName);
        if (!teacher) {
          teacher = { id: crypto.randomUUID(), name: teacherName, subjects: [], blockedPeriods: [] };
          importedMap.set(teacherName, teacher);
        }

        const duplicateSubject = teacher.subjects.some(subject =>
          subject.subjectName === subjectName &&
          subject.className === className &&
          subject.section === section &&
          (subject.branch || "") === (branch || "") &&
          subject.periodsPerWeek === periods
        );

        if (!duplicateSubject) {
          teacher.subjects.push({
            subjectName,
            className,
            section,
            branch: branch || undefined,
            periodsPerWeek: periods,
          });
        }
      });

      const imported = Array.from(importedMap.values()).filter(teacher => teacher.subjects.length > 0);

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

  // Export teachers to Excel (same format as import)
  const handleExportExcel = async () => {
    if (teachers.length === 0) {
      toast({ title: "لا يوجد معلمون للتصدير", variant: "destructive" });
      return;
    }
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("كشف الأنصبة");
      ws.views = [{ rightToLeft: true }];

      const border: Partial<ExcelJS.Borders> = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
      const fontName = "Traditional Arabic";

      // Title
      const titleRow = ws.addRow(["كشف أنصبة المعلمين"]);
      ws.mergeCells(1, 1, 1, 6);
      titleRow.getCell(1).font = { name: fontName, bold: true, size: 16, color: { argb: "FF2B3A55" } };
      titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4A84B" } };
      titleRow.height = 35;

      ws.addRow([]);

      // Headers - same format as import
      const headerRow = ws.addRow(["م", "اسم المعلم/ة", "المادة", "الصف/الشعبة", "الحصص الأسبوعية", "إجمالي الأنصبة"]);
      headerRow.height = 30;
      headerRow.eachCell(c => {
        c.font = { name: fontName, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.border = border;
      });

      let rowNum = 0;
      for (const teacher of teachers) {
        const totalPeriods = teacher.subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);

        if (teacher.subjects.length === 0) {
          rowNum++;
          const row = ws.addRow([rowNum, teacher.name, "—", "—", 0, 0]);
          row.eachCell(c => { c.font = { name: fontName, size: 11 }; c.border = border; c.alignment = { horizontal: "center", vertical: "middle" }; });
          continue;
        }

        for (let si = 0; si < teacher.subjects.length; si++) {
          const s = teacher.subjects[si];
          const isFirst = si === 0;
          if (isFirst) rowNum++;
          const row = ws.addRow([
            isFirst ? rowNum : "",
            isFirst ? teacher.name : "",
            s.subjectName,
            `${s.className}/${s.section}`,
            s.periodsPerWeek,
            isFirst ? totalPeriods : "",
          ]);
          row.eachCell((c, colNum) => {
            c.font = { name: fontName, size: 11, bold: (colNum === 6 && isFirst) };
            c.border = border;
            c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          });
        }

        if (teacher.subjects.length > 1) {
          const startR = ws.rowCount - teacher.subjects.length + 1;
          const endR = ws.rowCount;
          ws.mergeCells(startR, 1, endR, 1);
          ws.mergeCells(startR, 2, endR, 2);
          ws.mergeCells(startR, 6, endR, 6);
        }
      }

      // Summary
      ws.addRow([]);
      const summaryRow = ws.addRow(["", `إجمالي المعلمين: ${teachers.length}`, "", "", "", `إجمالي الحصص: ${teachers.reduce((s, t) => s + t.subjects.reduce((ss, sub) => ss + sub.periodsPerWeek, 0), 0)}`]);
      summaryRow.eachCell(c => {
        c.font = { name: fontName, bold: true, size: 12 };
        c.alignment = { horizontal: "center", vertical: "middle" };
      });

      ws.getColumn(1).width = 6;
      ws.getColumn(2).width = 25;
      ws.getColumn(3).width = 20;
      ws.getColumn(4).width = 18;
      ws.getColumn(5).width = 18;
      ws.getColumn(6).width = 18;

      const { saveAs } = await import("file-saver");
      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `كشف_أنصبة_المعلمين.xlsx`);
      toast({ title: "تم تصدير كشف الأنصبة بنجاح" });
    } catch (err) {
      toast({ title: "خطأ في التصدير", description: String(err), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">إدارة المعلمين</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={teachers.length === 0}>
            <Download className="w-4 h-4 ml-1" />
            تصدير Excel
          </Button>
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
