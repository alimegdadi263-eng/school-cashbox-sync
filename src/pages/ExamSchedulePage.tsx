import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { useTimetable } from "@/context/TimetableContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, FileSpreadsheet, Plus, Trash2, Edit2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ar } from "date-fns/locale";
import { parseClassKey, DAYS } from "@/types/timetable";
import { toast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const EXAM_TYPES = [
  { id: "first", label: "امتحان الشهر الأول" },
  { id: "second", label: "امتحان الشهر الثاني" },
  { id: "final", label: "الامتحان النهائي" },
] as const;

type ExamTypeId = typeof EXAM_TYPES[number]["id"];

interface ExamEntry {
  id: string;
  subjectName: string;
  date: string; // yyyy-mm-dd
  dayName: string;
  period?: string; // e.g. "الحصة 1-2"
}

interface ClassExamSchedule {
  classKey: string;
  examType: ExamTypeId;
  entries: ExamEntry[];
}

const STORAGE_KEY = "exam-schedules-data";
const FONT_NAME = "Traditional Arabic";

function loadSchedules(userId: string): ClassExamSchedule[] {
  try {
    const d = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

function saveSchedules(userId: string, data: ClassExamSchedule[]) {
  localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(data));
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr);
  const dayIdx = d.getDay(); // 0=Sun
  const map: Record<number, string> = { 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة", 6: "السبت" };
  return map[dayIdx] || "";
}

export default function ExamSchedulePage() {
  const { teachers, getAllClassKeys } = useTimetable();
  const { user, schoolName: authSchoolName } = useAuth();
  const userId = user?.id || "anonymous";
  const schoolName = authSchoolName || "المدرسة";

  const classKeys = getAllClassKeys();
  const [schedules, setSchedules] = useState<ClassExamSchedule[]>(() => loadSchedules(userId));
  const [selectedClass, setSelectedClass] = useState(classKeys[0] || "");
  const [activeExamType, setActiveExamType] = useState<ExamTypeId>("first");
  const [startDate, setStartDate] = useState<Date | undefined>();

  // Get subjects for selected class from teachers
  const classSubjects = (() => {
    const subs = new Set<string>();
    teachers.forEach(t => {
      t.subjects.forEach(s => {
        const key = `${s.className}-${s.section}`;
        if (key === selectedClass) subs.add(s.subjectName);
      });
    });
    return Array.from(subs);
  })();

  const currentSchedule = schedules.find(
    s => s.classKey === selectedClass && s.examType === activeExamType
  );

  const updateSchedules = useCallback((updated: ClassExamSchedule[]) => {
    setSchedules(updated);
    saveSchedules(userId, updated);
  }, [userId]);

  // Auto-generate schedule from start date for one class
  const generateSchedule = () => {
    if (!startDate || !selectedClass || classSubjects.length === 0) {
      toast({ title: "اختر الصف وتاريخ البداية أولاً", variant: "destructive" });
      return;
    }

    const entries: ExamEntry[] = [];
    let currentDate = new Date(startDate);

    for (const subject of classSubjects) {
      while (currentDate.getDay() === 5 || currentDate.getDay() === 6) {
        currentDate = addDays(currentDate, 1);
      }
      const dateStr = format(currentDate, "yyyy-MM-dd");
      entries.push({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        subjectName: subject,
        date: dateStr,
        dayName: getDayName(dateStr),
      });
      currentDate = addDays(currentDate, 1);
    }

    const newSchedules = schedules.filter(
      s => !(s.classKey === selectedClass && s.examType === activeExamType)
    );
    newSchedules.push({ classKey: selectedClass, examType: activeExamType, entries });
    updateSchedules(newSchedules);
    toast({ title: "تم توليد جدول الامتحانات" });
  };

  // Auto-generate for ALL classes and ALL exam types
  const generateAllSchedules = () => {
    if (!startDate) {
      toast({ title: "اختر تاريخ البداية أولاً", variant: "destructive" });
      return;
    }

    let newSchedules = [...schedules];
    let totalGenerated = 0;

    for (const examType of EXAM_TYPES) {
      for (const classKey of classKeys) {
        // Get subjects for this class
        const subs = new Set<string>();
        teachers.forEach(t => {
          t.subjects.forEach(s => {
            const key = `${s.className}-${s.section}`;
            if (key === classKey) subs.add(s.subjectName);
          });
        });
        const subjects = Array.from(subs);
        if (subjects.length === 0) continue;

        const entries: ExamEntry[] = [];
        let currentDate = new Date(startDate);

        for (const subject of subjects) {
          while (currentDate.getDay() === 5 || currentDate.getDay() === 6) {
            currentDate = addDays(currentDate, 1);
          }
          const dateStr = format(currentDate, "yyyy-MM-dd");
          entries.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            subjectName: subject,
            date: dateStr,
            dayName: getDayName(dateStr),
          });
          currentDate = addDays(currentDate, 1);
        }

        newSchedules = newSchedules.filter(
          s => !(s.classKey === classKey && s.examType === examType.id)
        );
        newSchedules.push({ classKey, examType: examType.id, entries });
        totalGenerated++;
      }
    }

    updateSchedules(newSchedules);
    toast({ title: `تم توليد ${totalGenerated} جدول امتحانات لجميع الصفوف والأنواع` });
  };

  // Add empty entry
  const addEntry = () => {
    const entry: ExamEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      subjectName: "",
      date: format(new Date(), "yyyy-MM-dd"),
      dayName: getDayName(format(new Date(), "yyyy-MM-dd")),
    };
    if (currentSchedule) {
      const updated = schedules.map(s =>
        s.classKey === selectedClass && s.examType === activeExamType
          ? { ...s, entries: [...s.entries, entry] }
          : s
      );
      updateSchedules(updated);
    } else {
      updateSchedules([...schedules, { classKey: selectedClass, examType: activeExamType, entries: [entry] }]);
    }
  };

  const updateEntry = (entryId: string, field: keyof ExamEntry, value: string) => {
    const updated = schedules.map(s => {
      if (s.classKey === selectedClass && s.examType === activeExamType) {
        return {
          ...s,
          entries: s.entries.map(e => {
            if (e.id === entryId) {
              const newEntry = { ...e, [field]: value };
              if (field === "date") newEntry.dayName = getDayName(value);
              return newEntry;
            }
            return e;
          }),
        };
      }
      return s;
    });
    updateSchedules(updated);
  };

  const removeEntry = (entryId: string) => {
    const updated = schedules.map(s => {
      if (s.classKey === selectedClass && s.examType === activeExamType) {
        return { ...s, entries: s.entries.filter(e => e.id !== entryId) };
      }
      return s;
    });
    updateSchedules(updated);
  };

  const updateEntryDate = (entryId: string, date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    updateEntry(entryId, "date", dateStr);
  };

  // Export Excel
  const exportExcel = async () => {
    if (!currentSchedule || currentSchedule.entries.length === 0) {
      toast({ title: "لا يوجد جدول للتصدير", variant: "destructive" });
      return;
    }

    const { className, section } = parseClassKey(selectedClass);
    const examLabel = EXAM_TYPES.find(e => e.id === activeExamType)?.label || "";

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("جدول الامتحانات");
    ws.views = [{ rightToLeft: true }];

    const border: Partial<ExcelJS.Borders> = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
    const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
    const headerFont: Partial<ExcelJS.Font> = { name: FONT_NAME, bold: true, size: 14 };
    const dataFont: Partial<ExcelJS.Font> = { name: FONT_NAME, size: 12 };

    // Title
    ws.mergeCells("A1:E1");
    ws.getCell("A1").value = schoolName;
    ws.getCell("A1").font = { name: FONT_NAME, bold: true, size: 18 };
    ws.getCell("A1").alignment = centerAlign;

    ws.mergeCells("A2:E2");
    ws.getCell("A2").value = `${examLabel} - الصف ${className} / شعبة ${section}`;
    ws.getCell("A2").font = { name: FONT_NAME, bold: true, size: 14 };
    ws.getCell("A2").alignment = centerAlign;

    ws.addRow([]);

    // Headers
    const hRow = ws.addRow(["م", "المادة", "التاريخ", "اليوم", "ملاحظات"]);
    hRow.height = 30;
    hRow.eachCell(c => {
      c.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
      c.alignment = centerAlign;
      c.border = border;
    });

    currentSchedule.entries.forEach((entry, idx) => {
      const row = ws.addRow([idx + 1, entry.subjectName, entry.date, entry.dayName, entry.period || ""]);
      row.height = 28;
      row.eachCell(c => {
        c.font = dataFont;
        c.alignment = centerAlign;
        c.border = border;
      });
    });

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 25;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 14;
    ws.getColumn(5).width = 20;

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `جدول_امتحانات_${className}_${section}_${examLabel}.xlsx`);
    toast({ title: "تم تصدير جدول الامتحانات" });
  };

  return (
    <AppLayout>
      <div className="space-y-6" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">جداول الامتحانات</h1>
          <p className="text-muted-foreground text-sm">إنشاء وإدارة جداول امتحانات الشهر الأول والثاني والنهائي لكل صف</p>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>اختر الصف</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الصف" />
                  </SelectTrigger>
                  <SelectContent>
                    {classKeys.map(k => {
                      const { className, section } = parseClassKey(k);
                      return <SelectItem key={k} value={k}>{className} / {section}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>تاريخ بداية الامتحانات</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-right", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {startDate ? format(startDate, "yyyy/MM/dd") : "اختر التاريخ"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={generateSchedule} disabled={!selectedClass || !startDate} className="flex-1">
                  توليد للصف المحدد
                </Button>
                <Button onClick={generateAllSchedules} disabled={!startDate} variant="secondary" className="flex-1">
                  توليد لجميع الصفوف
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Type Tabs */}
        {selectedClass && (
          <Tabs value={activeExamType} onValueChange={v => setActiveExamType(v as ExamTypeId)}>
            <TabsList className="grid w-full grid-cols-3">
              {EXAM_TYPES.map(et => (
                <TabsTrigger key={et.id} value={et.id}>{et.label}</TabsTrigger>
              ))}
            </TabsList>

            {EXAM_TYPES.map(et => (
              <TabsContent key={et.id} value={et.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>
                        {et.label} - {(() => { const p = parseClassKey(selectedClass); return `${p.className} / ${p.section}`; })()}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={addEntry}>
                          <Plus className="w-4 h-4 ml-1" /> إضافة مادة
                        </Button>
                        <Button size="sm" onClick={exportExcel} disabled={!currentSchedule?.entries.length}>
                          <FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!currentSchedule || currentSchedule.entries.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p>لا يوجد جدول لهذا الصف. اختر تاريخ البداية واضغط "توليد تلقائي"</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10 text-center">م</TableHead>
                              <TableHead className="text-center">المادة</TableHead>
                              <TableHead className="w-40 text-center">التاريخ</TableHead>
                              <TableHead className="w-24 text-center">اليوم</TableHead>
                              <TableHead className="text-center">ملاحظات</TableHead>
                              <TableHead className="w-16 text-center">حذف</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentSchedule.entries.map((entry, idx) => (
                              <TableRow key={entry.id}>
                                <TableCell className="text-center">{idx + 1}</TableCell>
                                <TableCell>
                                  {classSubjects.length > 0 ? (
                                    <Select value={entry.subjectName} onValueChange={v => updateEntry(entry.id, "subjectName", v)}>
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="اختر المادة" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {classSubjects.map(s => (
                                          <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      value={entry.subjectName}
                                      onChange={e => updateEntry(entry.id, "subjectName", e.target.value)}
                                      className="h-8"
                                      placeholder="اسم المادة"
                                    />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm" className="w-full text-xs">
                                        <CalendarIcon className="w-3 h-3 ml-1" />
                                        {entry.date}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                        mode="single"
                                        selected={entry.date ? new Date(entry.date) : undefined}
                                        onSelect={(d) => updateEntryDate(entry.id, d)}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                                <TableCell className="text-center text-sm">{entry.dayName}</TableCell>
                                <TableCell>
                                  <Input
                                    value={entry.period || ""}
                                    onChange={e => updateEntry(entry.id, "period", e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="ملاحظات"
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button size="sm" variant="ghost" onClick={() => removeEntry(entry.id)} className="text-destructive h-7 w-7 p-0">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
