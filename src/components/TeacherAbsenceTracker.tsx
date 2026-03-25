import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Plus, Trash2, FileDown, FileText, CalendarIcon, UserX, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimetable } from "@/context/TimetableContext";
import type { TeacherAbsenceRecord, AbsenceType } from "@/types/teacherAbsence";
import { ABSENCE_TYPES, ABSENCE_STORAGE_KEY } from "@/types/teacherAbsence";
import { exportAbsenceReportDocx, exportAbsenceReportExcel } from "@/lib/exportAbsenceReport";

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getElectronLanHelper() {
  return (window as any)?.electronAPI?.lan;
}

async function lanSyncSave(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify(data));
  const lan = getElectronLanHelper();
  if (!lan) return;
  try {
    const conn = await lan.isConnected();
    if (conn?.connected) await lan.setData(key, data);
  } catch {}
}

interface Props {
  userId: string;
  schoolName: string;
}

export default function TeacherAbsenceTracker({ userId, schoolName }: Props) {
  const { teachers } = useTimetable();
  const { toast } = useToast();

  const storageKey = `${ABSENCE_STORAGE_KEY}_${userId}`;
  const [records, setRecords] = useState<TeacherAbsenceRecord[]>([]);
  const [teacherName, setTeacherName] = useState("");
  const [absenceDate, setAbsenceDate] = useState<Date | undefined>();
  const [absenceType, setAbsenceType] = useState<AbsenceType>("عرضية");
  const [notes, setNotes] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");

  // Reload records (also called when tab is focused to pick up interrogation-synced records)
  const loadData = async () => {
    const lan = getElectronLanHelper();
    if (lan) {
      try {
        const conn = await lan.isConnected();
        if (conn?.connected && conn?.mode === "client") {
          const result = await lan.getData(storageKey);
          if (result?.success && result.data) {
            setRecords(result.data);
            localStorage.setItem(storageKey, JSON.stringify(result.data));
            return;
          }
        }
      } catch {}
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setRecords(JSON.parse(saved));
    } catch {}
  };

  useEffect(() => {
    loadData();
    // Listen for storage changes from other tabs/components (interrogation form sync)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try { setRecords(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    // Also poll localStorage every 2s to catch same-tab writes
    const poll = setInterval(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.length !== records.length) setRecords(parsed);
        }
      } catch {}
    }, 2000);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(poll);
    };
  }, [storageKey]);

  const saveRecords = (newRecords: TeacherAbsenceRecord[]) => {
    setRecords(newRecords);
    lanSyncSave(storageKey, newRecords);
  };

  const addRecord = () => {
    if (!teacherName.trim()) {
      toast({ title: "اختر اسم المعلم", variant: "destructive" });
      return;
    }
    if (!absenceDate) {
      toast({ title: "اختر تاريخ الغياب", variant: "destructive" });
      return;
    }

    const dayIndex = absenceDate.getDay();
    const dayName = DAYS_AR[dayIndex];

    const newRecord: TeacherAbsenceRecord = {
      id: generateId(),
      teacherName: teacherName.trim(),
      date: format(absenceDate, "yyyy/MM/dd"),
      dayName,
      absenceType,
      notes: notes.trim() || undefined,
    };

    const updated = [newRecord, ...records];
    saveRecords(updated);
    setTeacherName("");
    setAbsenceDate(undefined);
    setNotes("");
    toast({ title: "تم تسجيل الغياب" });
  };

  const deleteRecord = (id: string) => {
    saveRecords(records.filter(r => r.id !== id));
    toast({ title: "تم حذف السجل" });
  };

  const resetYear = () => {
    if (!confirm("هل أنت متأكد من مسح جميع سجلات الغياب لبدء سنة جديدة؟")) return;
    saveRecords([]);
    toast({ title: "تم مسح سجلات الغياب - سنة جديدة" });
  };
    saveRecords(records.filter(r => r.id !== id));
    toast({ title: "تم حذف السجل" });
  };

  const filtered = filterTeacher
    ? records.filter(r => r.teacherName === filterTeacher)
    : records;

  const uniqueTeachers = [...new Set(records.map(r => r.teacherName))];

  // Summary
  const summary: Record<string, { عرضية: number; مرضية: number; "عدم صرف": number; "غير ذلك": number; total: number }> = {};
  for (const rec of filtered) {
    if (!summary[rec.teacherName]) summary[rec.teacherName] = { عرضية: 0, مرضية: 0, "عدم صرف": 0, "غير ذلك": 0, total: 0 };
    if (summary[rec.teacherName][rec.absenceType as keyof typeof summary[string]] !== undefined) {
      (summary[rec.teacherName] as any)[rec.absenceType]++;
    }
    summary[rec.teacherName].total++;
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Add Record */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserX className="w-5 h-5" /> تسجيل غياب معلم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>اسم المعلم</Label>
              {teachers.length > 0 ? (
                <Select value={teacherName} onValueChange={setTeacherName}>
                  <SelectTrigger><SelectValue placeholder="اختر المعلم" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="اسم المعلم" />
              )}
            </div>
            <div className="space-y-1">
              <Label>تاريخ الغياب</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-right h-9", !absenceDate && "text-muted-foreground")}>
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {absenceDate ? format(absenceDate, "yyyy/MM/dd") : "اختر التاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={absenceDate} onSelect={setAbsenceDate} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>نوع الغياب</Label>
              <Select value={absenceType} onValueChange={v => setAbsenceType(v as AbsenceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ABSENCE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>ملاحظات</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" />
            </div>
          </div>
          <Button onClick={addRecord}>
            <Plus className="w-4 h-4 ml-2" /> تسجيل الغياب
          </Button>
        </CardContent>
      </Card>

      {/* Filter & Export */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📊 سجل الغيابات ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">تصفية حسب المعلم</Label>
                <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    {uniqueTeachers.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportAbsenceReportExcel(records, filterTeacher, schoolName)}>
                <FileDown className="w-4 h-4 ml-1" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportAbsenceReportDocx(records, filterTeacher, schoolName)}>
                <FileText className="w-4 h-4 ml-1" /> Word
              </Button>
            </div>

            {/* Summary */}
            {Object.keys(summary).length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="font-semibold mb-2 text-sm">ملخص الغيابات:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(summary).map(([name, counts]) => (
                    <div key={name} className="text-xs border rounded p-2 bg-background">
                      <span className="font-bold">{name}</span>: عرضية ({counts.عرضية}) • مرضية ({counts.مرضية}) • غير ذلك ({counts["غير ذلك"]}) = <span className="font-bold">{counts.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">م</TableHead>
                    <TableHead className="text-center">المعلم</TableHead>
                    <TableHead className="text-center">التاريخ</TableHead>
                    <TableHead className="text-center">اليوم</TableHead>
                    <TableHead className="text-center">النوع</TableHead>
                    <TableHead className="text-center">ملاحظات</TableHead>
                    <TableHead className="text-center w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((rec, idx) => (
                    <TableRow key={rec.id}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center font-medium">{rec.teacherName}</TableCell>
                      <TableCell className="text-center">{rec.date}</TableCell>
                      <TableCell className="text-center">{rec.dayName}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          rec.absenceType === "عرضية" && "bg-yellow-100 text-yellow-800",
                          rec.absenceType === "مرضية" && "bg-red-100 text-red-800",
                          rec.absenceType === "غير ذلك" && "bg-gray-100 text-gray-800",
                        )}>
                          {rec.absenceType}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{rec.notes || "-"}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => deleteRecord(rec.id)}>
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
