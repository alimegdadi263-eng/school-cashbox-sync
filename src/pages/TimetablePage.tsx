import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import TeacherManager from "@/components/timetable/TeacherManager";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import MalhafaView from "@/components/timetable/MalhafaView";
import DailyScheduleManager from "@/components/timetable/DailyScheduleManager";
import TimetableStatistics from "@/components/timetable/TimetableStatistics";
import { useTimetable } from "@/context/TimetableContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Wand2, Trash2, FileSpreadsheet, FileText, Download, Loader2,
  Users, CalendarDays, LayoutGrid, BarChart3, CalendarClock, FileDown,
} from "lucide-react";
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
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("teachers");

  const handleGenerate = () => {
    if (teachers.length === 0) {
      toast({ title: "أضف معلمين أولاً", variant: "destructive" });
      return;
    }
    generateTimetable();
    toast({ title: "تم توليد الجدول بنجاح!" });
    setActiveTab("grid");
  };

  const handleClear = () => {
    clearTimetable();
    toast({ title: "تم مسح الجدول" });
  };

  const school = schoolName || "المدرسة";

  const safeExport = useCallback(async (label: string, fn: () => Promise<void> | void) => {
    if (exporting) return;
    setExporting(true);
    toast({ title: `جاري تصدير ${label}...` });
    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      await fn();
      toast({ title: `تم تصدير ${label} بنجاح ✅` });
    } catch (err: any) {
      console.error("Export error:", err);
      toast({ title: `فشل التصدير: ${err?.message || "خطأ غير معروف"}`, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const hasTimetable = Object.keys(timetable).length > 0;

  return (
    <AppLayout>
      <div className="space-y-4" dir="rtl">
        {/* Header with title + global actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">الجدول المدرسي</h1>
            <p className="text-muted-foreground text-sm">إدارة وتوليد الجدول الأسبوعي للحصص</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-sm">عدد الحصص:</Label>
              <Select value={String(periodsPerDay)} onValueChange={v => setPeriodsPerDay(Number(v))}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 6, 7].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate}>
              <Wand2 className="w-4 h-4 ml-2" /> توليد الجدول
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="w-4 h-4 ml-2" /> مسح الجدول
            </Button>
          </div>
        </div>

        {/* Horizontal Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
            <TabsTrigger value="teachers" className="flex items-center gap-1.5 py-2.5">
              <Users className="w-4 h-4" /> المعلمون
            </TabsTrigger>
            <TabsTrigger value="grid" className="flex items-center gap-1.5 py-2.5">
              <LayoutGrid className="w-4 h-4" /> الجدول
            </TabsTrigger>
            <TabsTrigger value="malhafa" className="flex items-center gap-1.5 py-2.5">
              <CalendarDays className="w-4 h-4" /> الملحفة
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-1.5 py-2.5">
              <BarChart3 className="w-4 h-4" /> الإحصائيات
            </TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-1.5 py-2.5">
              <CalendarClock className="w-4 h-4" /> الجدول اليومي
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-1.5 py-2.5" disabled={!hasTimetable}>
              <FileDown className="w-4 h-4" /> التصدير
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teachers" className="mt-4">
            <TeacherManager />
          </TabsContent>

          <TabsContent value="grid" className="mt-4">
            <TimetableGrid />
          </TabsContent>

          <TabsContent value="malhafa" className="mt-4">
            <MalhafaView />
          </TabsContent>

          <TabsContent value="statistics" className="mt-4">
            <TimetableStatistics />
          </TabsContent>

          <TabsContent value="daily" className="mt-4">
            <DailyScheduleManager />
          </TabsContent>

          <TabsContent value="export" className="mt-4">
            {hasTimetable ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    تصدير الجداول
                    {exporting && <Loader2 className="w-4 h-4 animate-spin" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Export single class */}
                  <div className="flex flex-wrap gap-3 items-end border-b border-border pb-4">
                    <div>
                      <Label className="text-xs">تصدير جدول صف</Label>
                      <Select value={exportClassKey} onValueChange={setExportClassKey}>
                        <SelectTrigger className="w-52"><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                        <SelectContent>
                          {classKeys.map(k => {
                            const { className, section } = parseClassKey(k);
                            return <SelectItem key={k} value={k}>{className}/{section}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" disabled={!exportClassKey || exporting} onClick={() => {
                      if (exportClassKey && timetable[exportClassKey])
                        safeExport("جدول الصف", () => exportClassTimetableExcel(exportClassKey, timetable[exportClassKey], periodsPerDay, school));
                    }}>
                      <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel
                    </Button>
                    <Button size="sm" variant="outline" disabled={!exportClassKey || exporting} onClick={() => {
                      if (exportClassKey && timetable[exportClassKey])
                        safeExport("جدول الصف", () => exportClassTimetableDocx(exportClassKey, timetable[exportClassKey], periodsPerDay, school));
                    }}>
                      <FileText className="w-4 h-4 ml-1" /> Word
                    </Button>
                  </div>

                  {/* Export single teacher */}
                  <div className="flex flex-wrap gap-3 items-end border-b border-border pb-4">
                    <div>
                      <Label className="text-xs">تصدير جدول معلم</Label>
                      <Select value={exportTeacherId} onValueChange={setExportTeacherId}>
                        <SelectTrigger className="w-52"><SelectValue placeholder="اختر المعلم" /></SelectTrigger>
                        <SelectContent>
                          {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" disabled={!exportTeacherId || exporting} onClick={() => {
                      const t = teachers.find(x => x.id === exportTeacherId);
                      if (t) safeExport("جدول المعلم", () => exportTeacherTimetableExcel(t, timetable, periodsPerDay, school));
                    }}>
                      <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel
                    </Button>
                    <Button size="sm" variant="outline" disabled={!exportTeacherId || exporting} onClick={() => {
                      const t = teachers.find(x => x.id === exportTeacherId);
                      if (t) safeExport("جدول المعلم", () => exportTeacherTimetableDocx(t, timetable, periodsPerDay, school));
                    }}>
                      <FileText className="w-4 h-4 ml-1" /> Word
                    </Button>
                  </div>

                  {/* Export full school */}
                  <div className="flex flex-wrap gap-3 border-b border-border pb-4">
                    <Button disabled={exporting} onClick={() => safeExport("الجدول الكامل", () => exportFullSchoolTimetableExcel(timetable, periodsPerDay, school))}>
                      <Download className="w-4 h-4 ml-2" /> تصدير الجدول الكامل (Excel)
                    </Button>
                    <Button variant="outline" disabled={exporting} onClick={() => safeExport("الجدول الكامل", () => exportFullSchoolTimetableDocx(timetable, periodsPerDay, school))}>
                      <Download className="w-4 h-4 ml-2" /> تصدير الجدول الكامل (Word)
                    </Button>
                  </div>

                  {/* Export Malhafa */}
                  <div className="flex flex-wrap gap-3 border-b border-border pb-4">
                    <Button className="bg-amber-700 hover:bg-amber-800 text-white" disabled={exporting} onClick={() => safeExport("الملحفة", () => exportMalhafaExcel(timetable, periodsPerDay, school))}>
                      <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير الملحفة (Excel)
                    </Button>
                    <Button variant="outline" className="border-amber-700 text-amber-700 hover:bg-amber-50" disabled={exporting} onClick={() => safeExport("الملحفة", () => exportMalhafaDocx(timetable, periodsPerDay, school))}>
                      <FileText className="w-4 h-4 ml-2" /> تصدير الملحفة (Word)
                    </Button>
                  </div>

                  {/* Export Malhafa Transposed */}
                  <div className="flex flex-wrap gap-3 border-b border-border pb-4">
                    <Button className="bg-teal-700 hover:bg-teal-800 text-white" disabled={exporting} onClick={() => safeExport("الملحفة المعكوسة", () => exportMalhafaTransposedExcel(timetable, periodsPerDay, school))}>
                      <FileSpreadsheet className="w-4 h-4 ml-2" /> ملحفة معكوسة (Excel)
                    </Button>
                    <Button variant="outline" className="border-teal-700 text-teal-700 hover:bg-teal-50" disabled={exporting} onClick={() => safeExport("الملحفة المعكوسة", () => exportMalhafaTransposedDocx(timetable, periodsPerDay, school))}>
                      <FileText className="w-4 h-4 ml-2" /> ملحفة معكوسة (Word)
                    </Button>
                  </div>

                  {/* Export Teacher Workload */}
                  <div className="flex flex-wrap gap-3">
                    <Button className="bg-indigo-700 hover:bg-indigo-800 text-white" disabled={exporting} onClick={() => safeExport("كشف الأنصبة", () => exportTeacherWorkloadExcel(teachers, timetable, periodsPerDay, school))}>
                      <FileSpreadsheet className="w-4 h-4 ml-2" /> كشف أنصبة المعلمين (Excel)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  قم بتوليد الجدول أولاً لتتمكن من التصدير
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
