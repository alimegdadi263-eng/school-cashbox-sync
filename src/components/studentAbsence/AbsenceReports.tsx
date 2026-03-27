import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FileDown, FileText, RotateCcw, Trash2 } from "lucide-react";
import type { StudentAbsenceRecord } from "@/types/studentAbsence";
import { STUDENT_STORAGE_KEY } from "@/types/studentAbsence";
import { exportStudentAbsenceDocx, exportStudentAbsenceExcel } from "@/lib/exportStudentAbsence";

interface Props {
  userId: string;
  schoolName: string;
  directorateName?: string;
  principalName?: string;
}

export default function AbsenceReports({ userId, schoolName, directorateName, principalName }: Props) {
  const { toast } = useToast();
  const absenceKey = `${STUDENT_STORAGE_KEY}_${userId}`;
  const [records, setRecords] = useState<StudentAbsenceRecord[]>([]);
  const [filterClass, setFilterClass] = useState("");
  const [filterStudent, setFilterStudent] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(absenceKey);
      if (saved) setRecords(JSON.parse(saved));
    } catch {}
  }, [absenceKey]);

  // Poll for changes
  useEffect(() => {
    const poll = setInterval(() => {
      try {
        const saved = localStorage.getItem(absenceKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.length !== records.length) setRecords(parsed);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, [absenceKey, records.length]);

  const saveRecords = (list: StudentAbsenceRecord[]) => {
    setRecords(list);
    localStorage.setItem(absenceKey, JSON.stringify(list));
  };

  const classes = useMemo(() => [...new Set(records.map(r => r.className))], [records]);
  const studentsInClass = useMemo(() => {
    const filtered = filterClass ? records.filter(r => r.className === filterClass) : records;
    return [...new Set(filtered.map(r => r.studentName))];
  }, [records, filterClass]);

  const filtered = useMemo(() => {
    let result = records;
    if (filterClass) result = result.filter(r => r.className === filterClass);
    if (filterStudent) result = result.filter(r => r.studentName === filterStudent);
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [records, filterClass, filterStudent]);

  // Summary per student
  const summary = useMemo(() => {
    const map: Record<string, { name: string; className: string; count: number }> = {};
    const source = filterClass ? records.filter(r => r.className === filterClass) : records;
    for (const r of source) {
      if (!map[r.studentName]) map[r.studentName] = { name: r.studentName, className: r.className, count: 0 };
      map[r.studentName].count++;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [records, filterClass]);

  const deleteRecord = (id: string) => {
    saveRecords(records.filter(r => r.id !== id));
    toast({ title: "تم حذف السجل" });
  };

  const resetYear = () => {
    if (!confirm("هل أنت متأكد من مسح جميع سجلات غياب الطلبة؟")) return;
    saveRecords([]);
    toast({ title: "تم مسح جميع السجلات" });
  };

  const handleExportDocx = () => {
    exportStudentAbsenceDocx(records, schoolName, directorateName || "", principalName || "", filterClass || undefined, filterStudent || undefined);
  };

  const handleExportExcel = () => {
    exportStudentAbsenceExcel(records, schoolName, directorateName || "", filterClass || undefined, filterStudent || undefined);
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>📊 ملخص الغيابات</span>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleExportDocx}><FileText className="w-4 h-4 ml-1" /> تصدير Word</Button>
              <Button size="sm" variant="outline" onClick={handleExportExcel}><FileDown className="w-4 h-4 ml-1" /> تصدير Excel</Button>
              <Button size="sm" variant="destructive" onClick={resetYear}><RotateCcw className="w-4 h-4 ml-1" /> سنة جديدة</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">الصف</Label>
              <Select value={filterClass || "__all__"} onValueChange={v => { setFilterClass(v === "__all__" ? "" : v); setFilterStudent(""); }}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">جميع الصفوف</SelectItem>
                  {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الطالب</Label>
              <Select value={filterStudent || "__all__"} onValueChange={v => setFilterStudent(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">جميع الطلبة</SelectItem>
                  {studentsInClass.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          {summary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {summary.map(s => (
                <div key={s.name} className="border rounded-lg p-2 bg-muted/30 text-sm flex justify-between items-center">
                  <div>
                    <span className="font-bold">{s.name}</span>
                    <span className="text-muted-foreground mr-2">({s.className})</span>
                  </div>
                  <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded font-bold">{s.count} يوم</span>
                </div>
              ))}
            </div>
          )}

          {/* Detailed Records */}
          {filtered.length > 0 ? (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">م</TableHead>
                    <TableHead className="text-center">الطالب</TableHead>
                    <TableHead className="text-center">الصف</TableHead>
                    <TableHead className="text-center">التاريخ</TableHead>
                    <TableHead className="text-center">اليوم</TableHead>
                    <TableHead className="text-center w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, idx) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center font-medium">{r.studentName}</TableCell>
                      <TableCell className="text-center">{r.className}</TableCell>
                      <TableCell className="text-center">{r.date}</TableCell>
                      <TableCell className="text-center">{r.dayName}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => deleteRecord(r.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">لا توجد سجلات غياب</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
