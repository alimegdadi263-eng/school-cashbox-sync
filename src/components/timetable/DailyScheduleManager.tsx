import { useState } from "react";
import { useTimetable } from "@/context/TimetableContext";
import { DAYS, parseClassKey } from "@/types/timetable";
import type { ClassTimetable } from "@/types/timetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarDays, UserX } from "lucide-react";

export default function DailyScheduleManager() {
  const { teachers, timetable, periodsPerDay, generateDailySchedule } = useTimetable();
  const [selectedDay, setSelectedDay] = useState(0);
  const [absentTeacherIds, setAbsentTeacherIds] = useState<string[]>([]);
  const [dailyResult, setDailyResult] = useState<ClassTimetable | null>(null);

  const toggleAbsent = (id: string) => {
    setAbsentTeacherIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    const result = generateDailySchedule(selectedDay, absentTeacherIds);
    setDailyResult(result);
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
