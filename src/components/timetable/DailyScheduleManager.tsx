import { useState } from "react";
import { useTimetable } from "@/context/TimetableContext";
import { DAYS, parseClassKey } from "@/types/timetable";
import type { ClassTimetable } from "@/types/timetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, UserX, Plus, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { exportDailyScheduleExcel, exportDailyScheduleDocx } from "@/lib/exportDailySchedule";
import { useAuth } from "@/hooks/useAuth";

interface DutyTeacher {
  id: string;
  name: string;
  location: string;
}

export default function DailyScheduleManager() {
  const { teachers, timetable, periodsPerDay, generateDailySchedule } = useTimetable();
  const { schoolName } = useAuth();
  const [selectedDay, setSelectedDay] = useState(0);
  const [absentTeacherIds, setAbsentTeacherIds] = useState<string[]>([]);
  const [dailyResult, setDailyResult] = useState<ClassTimetable | null>(null);
  const [dutyTeachers, setDutyTeachers] = useState<DutyTeacher[]>([]);

  const toggleAbsent = (id: string) => {
    setAbsentTeacherIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    const result = generateDailySchedule(selectedDay, absentTeacherIds);
    setDailyResult(result);
  };

  const addDutyTeacher = () => {
    setDutyTeachers(prev => [...prev, { id: Date.now().toString(), name: "", location: "" }]);
  };

  const updateDutyTeacher = (id: string, field: "name" | "location", value: string) => {
    setDutyTeachers(prev => prev.map(dt => dt.id === id ? { ...dt, [field]: value } : dt));
  };

  const removeDutyTeacher = (id: string) => {
    setDutyTeachers(prev => prev.filter(dt => dt.id !== id));
  };

  if (Object.keys(timetable).length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          الجدول اليومي وإدارة الغياب
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-sm">اختر اليوم</Label>
            <Select value={String(selectedDay)} onValueChange={v => setSelectedDay(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate}>
            <CalendarDays className="w-4 h-4 ml-2" />
            إصدار الجدول اليومي
          </Button>
        </div>

        {/* Absent teachers */}
        <div className="border rounded-lg p-3 space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-1">
            <UserX className="w-4 h-4" />
            المعلمون الغائبون
          </Label>
          <div className="flex flex-wrap gap-3">
            {teachers.map(t => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={absentTeacherIds.includes(t.id)}
                  onCheckedChange={() => toggleAbsent(t.id)}
                />
                {t.name}
              </label>
            ))}
          </div>
          {absentTeacherIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              سيتم حذف حصص الغائبين وضغط الجدول (الأولوية لحذف الحصص الأخيرة)
            </p>
          )}
        </div>

        {/* Duty Teachers */}
        <div className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">المناوبون</Label>
            <Button size="sm" variant="outline" onClick={addDutyTeacher}>
              <Plus className="w-4 h-4 ml-1" /> إضافة مناوب
            </Button>
          </div>
          {dutyTeachers.length > 0 && (
            <div className="space-y-2">
              {dutyTeachers.map(dt => (
                <div key={dt.id} className="flex items-center gap-2">
                  <Input
                    value={dt.name}
                    onChange={e => updateDutyTeacher(dt.id, "name", e.target.value)}
                    placeholder="اسم المناوب"
                    className="h-9 flex-1"
                  />
                  <Input
                    value={dt.location}
                    onChange={e => updateDutyTeacher(dt.id, "location", e.target.value)}
                    placeholder="المكان (مثال: الساحة، البوابة)"
                    className="h-9 flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeDutyTeacher(dt.id)} className="h-8 w-8 text-destructive shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {dutyTeachers.length === 0 && (
            <p className="text-xs text-muted-foreground">اضغط "إضافة مناوب" لإدخال أسماء المناوبين وأماكنهم</p>
          )}
        </div>

        {/* Result */}
        {dailyResult && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">جدول يوم {DAYS[selectedDay]}:</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="border border-border p-2 text-right">الصف</th>
                    {Array.from({ length: periodsPerDay }, (_, i) => (
                      <th key={i} className="border border-border p-2 text-center">الحصة {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dailyResult).sort(([a], [b]) => a.localeCompare(b)).map(([classKey, days]) => {
                    const { className, section } = parseClassKey(classKey);
                    const periods = days[0] || [];
                    return (
                      <tr key={classKey} className="hover:bg-muted/30">
                        <td className="border border-border p-2 font-medium bg-muted/50">{className}/{section}</td>
                        {Array.from({ length: periodsPerDay }, (_, pi) => {
                          const cell = periods[pi];
                          return (
                            <td key={pi} className="border border-border p-1 text-center min-w-[90px]">
                              {cell ? (
                                <div>
                                  <div className="font-medium text-xs">{cell.subjectName}</div>
                                  <div className="text-muted-foreground text-[10px]">{cell.teacherName}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40 text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Duty Teachers in print */}
            {dutyTeachers.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <h4 className="font-semibold text-sm mb-2">المناوبون:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {dutyTeachers.map(dt => (
                    <div key={dt.id} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{dt.name || "—"}</span>
                      {dt.location && <span className="text-muted-foreground">({dt.location})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export buttons */}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button size="sm" onClick={() => {
                const school = schoolName || "المدرسة";
                const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
                exportDailyScheduleExcel(dailyResult, selectedDay, periodsPerDay, school, absentNames, dutyTeachers);
              }}>
                <FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const school = schoolName || "المدرسة";
                const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
                exportDailyScheduleDocx(dailyResult, selectedDay, periodsPerDay, school, absentNames, dutyTeachers);
              }}>
                <FileText className="w-4 h-4 ml-1" /> تصدير Word
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
