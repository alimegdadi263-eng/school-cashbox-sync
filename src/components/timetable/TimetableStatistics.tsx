import { useTimetable } from "@/context/TimetableContext";
import { parseClassKey, DAYS } from "@/types/timetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Download, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  exportClassStatisticsExcel,
  exportTeacherStatsExcel,
  exportDailyWorkloadExcel,
  exportAllStatisticsExcel,
} from "@/lib/exportTimetableStatistics";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "#f59e0b",
  "#10b981",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function TimetableStatistics() {
  const { teachers, timetable, periodsPerDay, getTeacherSchedule } = useTimetable();
  const { schoolName } = useAuth();
  const school = schoolName || "المدرسة";

  if (Object.keys(timetable).length === 0) return null;

  // --- إحصائيات الصفوف ---
  const classStats: { classKey: string; className: string; section: string; subjects: Record<string, number>; total: number }[] = [];

  for (const [classKey, days] of Object.entries(timetable)) {
    const { className, section } = parseClassKey(classKey);
    const subjects: Record<string, number> = {};
    let total = 0;
    days.forEach(periods => {
      periods.forEach(cell => {
        if (cell) {
          subjects[cell.subjectName] = (subjects[cell.subjectName] || 0) + 1;
          total++;
        }
      });
    });
    classStats.push({ classKey, className, section, subjects, total });
  }

  // --- كشف أنصبة المعلمين ---
  const teacherStats = teachers.map(t => {
    const schedule = getTeacherSchedule(t.id);
    const totalPeriods = schedule.length;
    const sixthCount = schedule.filter(s => s.period === periodsPerDay - 2).length;
    const seventhCount = schedule.filter(s => s.period === periodsPerDay - 1).length;
    const dailyCounts = DAYS.map((_, di) => schedule.filter(s => s.day === di).length);
    const subjectCounts: Record<string, number> = {};
    schedule.forEach(s => {
      subjectCounts[s.subjectName] = (subjectCounts[s.subjectName] || 0) + 1;
    });

    return {
      id: t.id,
      name: t.name,
      totalPeriods,
      sixthCount,
      seventhCount,
      dailyCounts,
      subjectCounts,
      leastDay: dailyCounts.indexOf(Math.min(...dailyCounts)),
      leastDayCount: Math.min(...dailyCounts),
    };
  });

  // --- جدول أشغال يومي ---
  const dailyLeastBusy = DAYS.map((dayName, dayIdx) => {
    const teacherDayCounts = teachers.map(t => {
      const count = getTeacherSchedule(t.id).filter(s => s.day === dayIdx).length;
      return { teacher: t, count };
    }).filter(x => x.count > 0).sort((a, b) => a.count - b.count);

    return {
      day: dayName,
      dayIdx,
      teachers: teacherDayCounts.slice(0, 3),
    };
  });

  const chartData = classStats.map(cs => ({
    name: `${cs.className}/${cs.section}`,
    total: cs.total,
  }));

  const allSubjects = Array.from(new Set(classStats.flatMap(cs => Object.keys(cs.subjects)))).sort();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">الإحصائيات والتقارير</CardTitle>
        <Button
          size="sm"
          onClick={() => exportAllStatisticsExcel(teachers, timetable, periodsPerDay, school)}
        >
          <Download className="w-4 h-4 ml-2" />
          تصدير الكل (Excel)
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="classes" dir="rtl">
          <TabsList className="mb-4">
            <TabsTrigger value="classes">إحصائيات الصفوف</TabsTrigger>
            <TabsTrigger value="teachers">أنصبة المعلمين</TabsTrigger>
            <TabsTrigger value="daily">أشغال يومية</TabsTrigger>
          </TabsList>

          {/* إحصائيات الصفوف */}
          <TabsContent value="classes" className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportClassStatisticsExcel(timetable, periodsPerDay, school)}
              >
                <FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel
              </Button>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" name="عدد الحصص">
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الصف/الشعبة</TableHead>
                    {allSubjects.map(s => (
                      <TableHead key={s} className="text-center text-xs">{s}</TableHead>
                    ))}
                    <TableHead className="text-center font-bold">المجموع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStats.map(cs => (
                    <TableRow key={cs.classKey}>
                      <TableCell className="font-medium">{cs.className}/{cs.section}</TableCell>
                      {allSubjects.map(s => (
                        <TableCell key={s} className="text-center">
                          {cs.subjects[s] || "-"}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted">{cs.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* أنصبة المعلمين */}
          <TabsContent value="teachers">
            <div className="flex justify-end mb-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportTeacherStatsExcel(teachers, timetable, periodsPerDay, school)}
              >
                <FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المعلم</TableHead>
                    <TableHead className="text-center">إجمالي الحصص</TableHead>
                    <TableHead className="text-center">السادسات</TableHead>
                    <TableHead className="text-center">السابعات</TableHead>
                    {DAYS.map(d => (
                      <TableHead key={d} className="text-center text-xs">{d}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherStats.map(ts => (
                    <TableRow key={ts.id}>
                      <TableCell className="font-medium">{ts.name}</TableCell>
                      <TableCell className="text-center font-bold">{ts.totalPeriods}</TableCell>
                      <TableCell className="text-center">{ts.sixthCount}</TableCell>
                      <TableCell className="text-center">{ts.seventhCount}</TableCell>
                      {ts.dailyCounts.map((c, i) => (
                        <TableCell
                          key={i}
                          className={`text-center ${c === ts.leastDayCount ? "bg-green-100 dark:bg-green-900/30 font-bold" : ""}`}
                        >
                          {c}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* أشغال يومية */}
          <TabsContent value="daily">
            <div className="flex justify-end mb-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportDailyWorkloadExcel(teachers, timetable, periodsPerDay, school)}
              >
                <FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {dailyLeastBusy.map(dl => (
                <Card key={dl.dayIdx} className="border">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm text-center">{dl.day}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-1 space-y-1">
                    <p className="text-xs text-muted-foreground text-center mb-2">الأقل حصصاً</p>
                    {dl.teachers.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center">لا يوجد</p>
                    ) : (
                      dl.teachers.map((t, i) => (
                        <div key={t.teacher.id} className={`text-xs p-1.5 rounded ${i === 0 ? "bg-green-100 dark:bg-green-900/30 font-medium" : "bg-muted"}`}>
                          {t.teacher.name} ({t.count} حصص)
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
