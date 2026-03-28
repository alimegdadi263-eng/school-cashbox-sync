import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays, isWeekend, eachDayOfInterval, isFriday, isSaturday } from "date-fns";
import { CalendarIcon, FileText, FileDown, BarChart3, Users, School, GraduationCap, UserCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentInfo, StudentAbsenceRecord } from "@/types/studentAbsence";
import { STUDENTS_LIST_KEY, STUDENT_STORAGE_KEY } from "@/types/studentAbsence";
import { exportAbsenceStatisticsDocx, exportAbsenceStatisticsExcel } from "@/lib/exportAbsenceStatistics";

interface Props {
  userId: string;
  schoolName: string;
  directorateName?: string;
  principalName?: string;
}

type ViewLevel = "school" | "grade" | "section" | "per-student";

// Count school days (exclude Fridays and Saturdays - Jordan weekend)
function countSchoolDays(from: Date, to: Date): number {
  if (from > to) return 0;
  const days = eachDayOfInterval({ start: from, end: to });
  return days.filter(d => !isFriday(d) && !isSaturday(d)).length;
}

// Get academic year start (Sep 1) for current school year
function getAcademicYearStart(): Date {
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 8, 1); // Sep 1
}

export default function AbsenceStatistics({ userId, schoolName, directorateName, principalName }: Props) {
  const { toast } = useToast();
  const studentsKey = `${STUDENTS_LIST_KEY}_${userId}`;
  const absenceKey = `${STUDENT_STORAGE_KEY}_${userId}`;

  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [records, setRecords] = useState<StudentAbsenceRecord[]>([]);
  const [viewLevel, setViewLevel] = useState<ViewLevel>("school");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [singleDate, setSingleDate] = useState<Date>(new Date());
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());

  useEffect(() => {
    try {
      const s = localStorage.getItem(studentsKey);
      if (s) setStudents(JSON.parse(s));
      const r = localStorage.getItem(absenceKey);
      if (r) setRecords(JSON.parse(r));
    } catch {}
  }, [studentsKey, absenceKey]);

  useEffect(() => {
    const poll = setInterval(() => {
      try {
        const s = localStorage.getItem(studentsKey);
        if (s) { const p = JSON.parse(s); if (p.length !== students.length) setStudents(p); }
        const r = localStorage.getItem(absenceKey);
        if (r) { const p = JSON.parse(r); if (p.length !== records.length) setRecords(p); }
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, [studentsKey, absenceKey, students.length, records.length]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const parts = s.className.trim().split(" ");
      if (parts.length >= 1 && parts[0]) set.add(parts[0]);
    });
    return [...set].filter(Boolean);
  }, [students]);

  const sections = useMemo(() => {
    if (!filterGrade) return [];
    const set = new Set<string>();
    students.forEach(s => {
      if (s.className.startsWith(filterGrade)) set.add(s.className);
    });
    return [...set].sort();
  }, [students, filterGrade]);

  // Academic year school days
  const academicYearStart = useMemo(() => getAcademicYearStart(), []);
  const totalSchoolDays = useMemo(() => countSchoolDays(academicYearStart, new Date()), [academicYearStart]);

  const dateFilteredRecords = useMemo(() => {
    if (dateMode === "single") {
      const ds = format(singleDate, "yyyy/MM/dd");
      return records.filter(r => r.date === ds);
    } else {
      const from = format(dateFrom, "yyyy/MM/dd");
      const to = format(dateTo, "yyyy/MM/dd");
      return records.filter(r => r.date >= from && r.date <= to);
    }
  }, [records, dateMode, singleDate, dateFrom, dateTo]);

  const getStudentsByLevel = useMemo(() => {
    if (viewLevel === "school" || viewLevel === "per-student") return students;
    if (viewLevel === "grade" && filterGrade) return students.filter(s => s.className.startsWith(filterGrade));
    if (viewLevel === "section" && filterSection) return students.filter(s => s.className === filterSection);
    return students;
  }, [students, viewLevel, filterGrade, filterSection]);

  const levelFilteredRecords = useMemo(() => {
    if (viewLevel === "school" || viewLevel === "per-student") return dateFilteredRecords;
    if (viewLevel === "grade" && filterGrade) return dateFilteredRecords.filter(r => r.className.startsWith(filterGrade));
    if (viewLevel === "section" && filterSection) return dateFilteredRecords.filter(r => r.className === filterSection);
    return dateFilteredRecords;
  }, [dateFilteredRecords, viewLevel, filterGrade, filterSection]);

  const totalStudents = getStudentsByLevel.length;
  const absentStudentIds = useMemo(() => new Set(levelFilteredRecords.map(r => r.studentId)), [levelFilteredRecords]);
  const absentCount = absentStudentIds.size;
  const presentCount = totalStudents - absentCount;
  const absentPercentage = totalStudents > 0 ? ((absentCount / totalStudents) * 100).toFixed(1) : "0";
  const presentPercentage = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : "0";

  const classBreakdown = useMemo(() => {
    const relevantStudents = getStudentsByLevel;
    const classMap: Record<string, { total: number; absent: number; absentNames: string[] }> = {};
    relevantStudents.forEach(s => {
      if (!classMap[s.className]) classMap[s.className] = { total: 0, absent: 0, absentNames: [] };
      classMap[s.className].total++;
    });
    levelFilteredRecords.forEach(r => {
      if (!classMap[r.className]) classMap[r.className] = { total: 0, absent: 0, absentNames: [] };
      if (!classMap[r.className].absentNames.includes(r.studentName)) {
        classMap[r.className].absent++;
        classMap[r.className].absentNames.push(r.studentName);
      }
    });
    return Object.entries(classMap)
      .map(([cls, data]) => ({
        className: cls, total: data.total, absent: data.absent,
        present: data.total - data.absent, absentNames: data.absentNames,
        percentage: data.total > 0 ? ((data.absent / data.total) * 100).toFixed(1) : "0"
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }, [getStudentsByLevel, levelFilteredRecords]);

  const studentDetail = useMemo(() => {
    if (viewLevel !== "section") return [];
    const relevant = getStudentsByLevel;
    return relevant.map(s => ({
      ...s,
      isAbsent: absentStudentIds.has(s.id),
      absenceDays: levelFilteredRecords.filter(r => r.studentId === s.id).length,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [viewLevel, getStudentsByLevel, absentStudentIds, levelFilteredRecords]);

  // Per-student cumulative absence (uses ALL records, not date-filtered)
  const perStudentAbsence = useMemo(() => {
    if (viewLevel !== "per-student") return [];
    const countMap: Record<string, number> = {};
    records.forEach(r => {
      countMap[r.studentId] = (countMap[r.studentId] || 0) + 1;
    });
    return students.map(s => ({
      id: s.id,
      name: s.name,
      className: s.className,
      totalAbsence: countMap[s.id] || 0,
      percentage: totalSchoolDays > 0 ? (((countMap[s.id] || 0) / totalSchoolDays) * 100).toFixed(1) : "0",
      status: (countMap[s.id] || 0) >= 15 ? "خطر" : (countMap[s.id] || 0) >= 10 ? "إنذار" : (countMap[s.id] || 0) >= 5 ? "متابعة" : "عادي",
    })).sort((a, b) => b.totalAbsence - a.totalAbsence);
  }, [viewLevel, students, records, totalSchoolDays]);

  const dateLabel = dateMode === "single"
    ? format(singleDate, "yyyy/MM/dd")
    : `${format(dateFrom, "yyyy/MM/dd")} - ${format(dateTo, "yyyy/MM/dd")}`;

  const levelLabel = viewLevel === "school" ? "المدرسة كاملة"
    : viewLevel === "grade" ? `الصف: ${filterGrade}`
    : viewLevel === "per-student" ? "إحصائية فردية لكل طالب"
    : `الشعبة: ${filterSection}`;

  const handleExportDocx = () => {
    exportAbsenceStatisticsDocx({
      classBreakdown, studentDetail, totalStudents, absentCount, presentCount,
      absentPercentage, presentPercentage, dateLabel, levelLabel,
      schoolName, directorateName: directorateName || "", principalName: principalName || "",
      viewLevel, perStudentAbsence, totalSchoolDays,
    });
    toast({ title: "تم تصدير الإحصائية بصيغة Word" });
  };

  const handleExportExcel = () => {
    exportAbsenceStatisticsExcel({
      classBreakdown, studentDetail, totalStudents, absentCount, presentCount,
      absentPercentage, presentPercentage, dateLabel, levelLabel,
      schoolName, directorateName: directorateName || "", viewLevel,
      perStudentAbsence, totalSchoolDays,
    });
    toast({ title: "تم تصدير الإحصائية بصيغة Excel" });
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📊 إعدادات الإحصائية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {/* View Level */}
            <div className="space-y-1">
              <Label className="text-xs">مستوى العرض</Label>
              <Select value={viewLevel} onValueChange={v => { setViewLevel(v as ViewLevel); setFilterGrade(""); setFilterSection(""); }}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">المدرسة كاملة</SelectItem>
                  <SelectItem value="grade">الصف (جميع الشعب)</SelectItem>
                  <SelectItem value="section">شعبة واحدة</SelectItem>
                  <SelectItem value="per-student">إحصائية كل طالب</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {viewLevel !== "per-student" && (
              <>
                {/* Date Mode */}
                <div className="space-y-1">
                  <Label className="text-xs">نوع التاريخ</Label>
                  <Select value={dateMode} onValueChange={v => setDateMode(v as "single" | "range")}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">يوم واحد</SelectItem>
                      <SelectItem value="range">فترة زمنية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dateMode === "single" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">التاريخ</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 w-44 justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {format(singleDate, "yyyy/MM/dd")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={singleDate} onSelect={d => d && setSingleDate(d)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">من</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-9 w-40 justify-start text-right">
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {format(dateFrom, "yyyy/MM/dd")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">إلى</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-9 w-40 justify-start text-right">
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {format(dateTo, "yyyy/MM/dd")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
              </>
            )}

            {(viewLevel === "grade" || viewLevel === "section") && (
              <div className="space-y-1">
                <Label className="text-xs">الصف</Label>
                <Select value={filterGrade || "__none__"} onValueChange={v => { setFilterGrade(v === "__none__" ? "" : v); setFilterSection(""); }}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">اختر الصف</SelectItem>
                    {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {viewLevel === "section" && filterGrade && (
              <div className="space-y-1">
                <Label className="text-xs">الشعبة</Label>
                <Select value={filterSection || "__none__"} onValueChange={v => setFilterSection(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">اختر الشعبة</SelectItem>
                    {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className={cn("grid gap-3", viewLevel === "per-student" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4")}>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center">
            <School className="w-8 h-8 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold text-primary">{totalStudents}</p>
            <p className="text-xs text-muted-foreground">إجمالي الطلبة</p>
          </CardContent>
        </Card>
        {viewLevel === "per-student" ? (
          <>
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 text-center">
                <CalendarIcon className="w-8 h-8 mx-auto mb-1 text-amber-600" />
                <p className="text-2xl font-bold text-amber-600">{totalSchoolDays}</p>
                <p className="text-xs text-muted-foreground">أيام الدراسة هذا العام</p>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-1 text-destructive" />
                <p className="text-2xl font-bold text-destructive">
                  {perStudentAbsence.filter(s => s.totalAbsence >= 10).length}
                </p>
                <p className="text-xs text-muted-foreground">طلاب بحاجة متابعة (10+ أيام)</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{presentCount}</p>
                <p className="text-xs text-muted-foreground">حاضر ({presentPercentage}%)</p>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-1 text-destructive" />
                <p className="text-2xl font-bold text-destructive">{absentCount}</p>
                <p className="text-xs text-muted-foreground">غائب ({absentPercentage}%)</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-1 text-amber-600" />
                <p className="text-2xl font-bold text-amber-600">{dateLabel}</p>
                <p className="text-xs text-muted-foreground">{levelLabel}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Per-Student Cumulative Absence Table */}
      {viewLevel === "per-student" && perStudentAbsence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span><UserCheck className="inline w-5 h-5 ml-1" /> إحصائية غياب كل طالب (منذ بداية العام)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExportDocx}><FileText className="w-4 h-4 ml-1" /> Word</Button>
                <Button size="sm" variant="outline" onClick={handleExportExcel}><FileDown className="w-4 h-4 ml-1" /> Excel</Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">م</TableHead>
                    <TableHead className="text-center">اسم الطالب</TableHead>
                    <TableHead className="text-center">الصف/الشعبة</TableHead>
                    <TableHead className="text-center">أيام الغياب</TableHead>
                    <TableHead className="text-center">نسبة الغياب</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perStudentAbsence.map((s, idx) => (
                    <TableRow key={s.id} className={cn(
                      s.status === "خطر" ? "bg-destructive/10" :
                      s.status === "إنذار" ? "bg-amber-50" :
                      s.status === "متابعة" ? "bg-yellow-50" : ""
                    )}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center font-medium">{s.name}</TableCell>
                      <TableCell className="text-center text-sm">{s.className}</TableCell>
                      <TableCell className="text-center font-bold">{s.totalAbsence}</TableCell>
                      <TableCell className="text-center">{s.percentage}%</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-bold",
                          s.status === "خطر" ? "bg-destructive/20 text-destructive" :
                          s.status === "إنذار" ? "bg-amber-100 text-amber-700" :
                          s.status === "متابعة" ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"
                        )}>
                          {s.status === "خطر" ? "🔴 " : s.status === "إنذار" ? "🟡 " : s.status === "متابعة" ? "🟠 " : "🟢 "}
                          {s.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Breakdown Table */}
      {classBreakdown.length > 0 && viewLevel !== "section" && viewLevel !== "per-student" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span><GraduationCap className="inline w-5 h-5 ml-1" /> تفصيل حسب الصفوف</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExportDocx}><FileText className="w-4 h-4 ml-1" /> Word</Button>
                <Button size="sm" variant="outline" onClick={handleExportExcel}><FileDown className="w-4 h-4 ml-1" /> Excel</Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">م</TableHead>
                    <TableHead className="text-center">الصف/الشعبة</TableHead>
                    <TableHead className="text-center">العدد الكلي</TableHead>
                    <TableHead className="text-center">الحضور</TableHead>
                    <TableHead className="text-center">الغياب</TableHead>
                    <TableHead className="text-center">نسبة الغياب</TableHead>
                    <TableHead className="text-center">أسماء الغائبين</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classBreakdown.map((row, idx) => (
                    <TableRow key={row.className}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center font-medium">{row.className}</TableCell>
                      <TableCell className="text-center">{row.total}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{row.present}</TableCell>
                      <TableCell className="text-center text-destructive font-medium">{row.absent}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-bold",
                          Number(row.percentage) >= 20 ? "bg-destructive/20 text-destructive" :
                          Number(row.percentage) >= 10 ? "bg-amber-100 text-amber-700" :
                          "bg-green-100 text-green-700"
                        )}>
                          {row.percentage}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{row.absentNames.join("، ") || "-"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell className="text-center" colSpan={2}>المجموع</TableCell>
                    <TableCell className="text-center">{totalStudents}</TableCell>
                    <TableCell className="text-center text-green-600">{presentCount}</TableCell>
                    <TableCell className="text-center text-destructive">{absentCount}</TableCell>
                    <TableCell className="text-center">{absentPercentage}%</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Detail for Section View */}
      {viewLevel === "section" && filterSection && studentDetail.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span><Users className="inline w-5 h-5 ml-1" /> تفصيل طلبة {filterSection}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExportDocx}><FileText className="w-4 h-4 ml-1" /> Word</Button>
                <Button size="sm" variant="outline" onClick={handleExportExcel}><FileDown className="w-4 h-4 ml-1" /> Excel</Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">م</TableHead>
                    <TableHead className="text-center">اسم الطالب</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    {dateMode === "range" && <TableHead className="text-center">أيام الغياب</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentDetail.map((s, idx) => (
                    <TableRow key={s.id} className={s.isAbsent ? "bg-destructive/5" : ""}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center font-medium">{s.name}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-bold",
                          s.isAbsent ? "bg-destructive/20 text-destructive" : "bg-green-100 text-green-700"
                        )}>
                          {s.isAbsent ? "غائب" : "حاضر"}
                        </span>
                      </TableCell>
                      {dateMode === "range" && (
                        <TableCell className="text-center font-medium">{s.absenceDays > 0 ? s.absenceDays : "-"}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {totalStudents === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            لا يوجد طلبة مسجلين. اذهب إلى "إدارة الطلبة" لإضافة الطلبة أولاً.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
