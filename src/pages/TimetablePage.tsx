import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import TeacherManager from "@/components/timetable/TeacherManager";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import DailyScheduleManager from "@/components/timetable/DailyScheduleManager";
import { useTimetable } from "@/context/TimetableContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Wand2, Trash2, FileSpreadsheet, FileText, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { parseClassKey } from "@/types/timetable";
import {
  exportClassTimetableExcel,
  exportTeacherTimetableExcel,
  exportFullSchoolTimetableExcel,
  exportMalhafaExcel,
  exportMalhafaTransposedExcel,
  exportTeacherWorkloadExcel,
} from "@/lib/exportTimetableExcel";
import {
  exportClassTimetableDocx,
  exportTeacherTimetableDocx,
  exportFullSchoolTimetableDocx,
  exportMalhafaDocx,
  exportMalhafaTransposedDocx,
} from "@/lib/exportTimetableDocx";
import { useAuth } from "@/hooks/useAuth";

export default function TimetablePage() {
  const { teachers, timetable, periodsPerDay, setPeriodsPerDay, generateTimetable, getAllClassKeys, clearTimetable } = useTimetable();
  const { schoolName } = useAuth();
  const classKeys = getAllClassKeys();

  const [exportClassKey, setExportClassKey] = useState("");
  const [exportTeacherId, setExportTeacherId] = useState("");

  const handleGenerate = () => {
    if (teachers.length === 0) {
      toast({ title: "أضف معلمين أولاً", variant: "destructive" });
      return;
    }
    generateTimetable();
    toast({ title: "تم توليد الجدول بنجاح!" });
  };

  const handleClear = () => {
    clearTimetable();
    toast({ title: "تم مسح الجدول" });
  };

  const school = schoolName || "المدرسة";

  return (
    <AppLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">الجدول المدرسي</h1>
            <p className="text-muted-foreground text-sm">إدارة وتوليد الجدول الأسبوعي للحصص</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-sm">عدد الحصص:</Label>
              <Select value={String(periodsPerDay)} onValueChange={v => setPeriodsPerDay(Number(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 6, 7].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate}>
              <Wand2 className="w-4 h-4 ml-2" />
              توليد الجدول
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="w-4 h-4 ml-2" />
              مسح الجدول
            </Button>
          </div>
        </div>

        <TeacherManager />

        <TimetableGrid />

        <DailyScheduleManager />

        {/* Export Section */}
        {Object.keys(timetable).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">تصدير الجداول</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Export single class */}
              <div className="flex flex-wrap gap-3 items-end border-b border-border pb-4">
                <div>
                  <Label className="text-xs">تصدير جدول صف</Label>
                  <Select value={exportClassKey} onValueChange={setExportClassKey}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="اختر الصف" />
                    </SelectTrigger>
                    <SelectContent>
                      {classKeys.map(k => {
                        const { className, section } = parseClassKey(k);
                        return <SelectItem key={k} value={k}>{className}/{section}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" disabled={!exportClassKey} onClick={() => {
                  if (exportClassKey && timetable[exportClassKey])
                    exportClassTimetableExcel(exportClassKey, timetable[exportClassKey], periodsPerDay, school);
                }}>
                  <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel
                </Button>
                <Button size="sm" variant="outline" disabled={!exportClassKey} onClick={() => {
                  if (exportClassKey && timetable[exportClassKey])
                    exportClassTimetableDocx(exportClassKey, timetable[exportClassKey], periodsPerDay, school);
                }}>
                  <FileText className="w-4 h-4 ml-1" /> Word
                </Button>
              </div>

              {/* Export single teacher */}
              <div className="flex flex-wrap gap-3 items-end border-b border-border pb-4">
                <div>
                  <Label className="text-xs">تصدير جدول معلم</Label>
                  <Select value={exportTeacherId} onValueChange={setExportTeacherId}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="اختر المعلم" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" disabled={!exportTeacherId} onClick={() => {
                  const t = teachers.find(x => x.id === exportTeacherId);
                  if (t) exportTeacherTimetableExcel(t, timetable, periodsPerDay, school);
                }}>
                  <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel
                </Button>
                <Button size="sm" variant="outline" disabled={!exportTeacherId} onClick={() => {
                  const t = teachers.find(x => x.id === exportTeacherId);
                  if (t) exportTeacherTimetableDocx(t, timetable, periodsPerDay, school);
                }}>
                  <FileText className="w-4 h-4 ml-1" /> Word
                </Button>
              </div>

              {/* Export full school */}
              <div className="flex flex-wrap gap-3 border-b border-border pb-4">
                <Button onClick={() => exportFullSchoolTimetableExcel(timetable, periodsPerDay, school)}>
                  <Download className="w-4 h-4 ml-2" />
                  تصدير الجدول الكامل (Excel)
                </Button>
                <Button variant="outline" onClick={() => exportFullSchoolTimetableDocx(timetable, periodsPerDay, school)}>
                  <Download className="w-4 h-4 ml-2" />
                  تصدير الجدول الكامل (Word)
                </Button>
              </div>

              {/* Export Malhafa */}
              <div className="flex flex-wrap gap-3 border-b border-border pb-4">
                <Button className="bg-amber-700 hover:bg-amber-800 text-white" onClick={() => exportMalhafaExcel(timetable, periodsPerDay, school)}>
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  تصدير الملحفة (Excel)
                </Button>
                <Button variant="outline" className="border-amber-700 text-amber-700 hover:bg-amber-50" onClick={() => exportMalhafaDocx(timetable, periodsPerDay, school)}>
                  <FileText className="w-4 h-4 ml-2" />
                  تصدير الملحفة (Word)
                </Button>
              </div>

              {/* Export Malhafa Transposed */}
              <div className="flex flex-wrap gap-3">
                <Button className="bg-teal-700 hover:bg-teal-800 text-white" onClick={() => exportMalhafaTransposedExcel(timetable, periodsPerDay, school)}>
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  ملحفة معكوسة (Excel)
                </Button>
                <Button variant="outline" className="border-teal-700 text-teal-700 hover:bg-teal-50" onClick={() => exportMalhafaTransposedDocx(timetable, periodsPerDay, school)}>
                  <FileText className="w-4 h-4 ml-2" />
                  ملحفة معكوسة (Word)
                </Button>
              </div>

              {/* Export Teacher Workload */}
              <div className="flex flex-wrap gap-3">
                <Button className="bg-indigo-700 hover:bg-indigo-800 text-white" onClick={() => exportTeacherWorkloadExcel(teachers, timetable, periodsPerDay, school)}>
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  كشف أنصبة المعلمين (Excel)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
