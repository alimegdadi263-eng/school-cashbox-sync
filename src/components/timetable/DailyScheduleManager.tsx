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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { CalendarDays, UserX, Plus, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { exportDailyScheduleExcel, exportDailyScheduleDocx, exportDailyScheduleExcelInverted, exportDailyScheduleDocxInverted, exportDailyScheduleMatrixExcel, exportDailyScheduleMatrixDocx } from "@/lib/exportDailySchedule";
import { useAuth } from "@/hooks/useAuth";
import { loadGatewayProfiles, sendBulkSmsMultiGateway } from "@/lib/smsGateway";
import { toast } from "@/hooks/use-toast";
import { MessageSquare, Loader2 } from "lucide-react";

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
  const [sending, setSending] = useState(false);
  /** الخانة المحدّدة للتبديل اليدوي (اضغط خانة ثم خانة أخرى للتبديل) */
  const [selectedCell, setSelectedCell] = useState<{ classKey: string; period: number } | null>(null);
  /** خانة فارغة يتم إسناد حصة إشغال يدوية لها */
  const [occupyCell, setOccupyCell] = useState<{ classKey: string; period: number } | null>(null);
  const [occupyTeacherId, setOccupyTeacherId] = useState("");
  const [occupyLabel, setOccupyLabel] = useState("إشغال");

  /** المعلمون المتاحون (غير غائبين وليس لديهم حصة في نفس الحصة) لإسناد إشغال */
  const availableTeachers = (period: number) => {
    if (!dailyResult) return teachers;
    return teachers.filter(t => {
      if (absentTeacherIds.includes(t.id)) return false;
      return !Object.values(dailyResult).some(days => days[0]?.[period]?.teacherId === t.id);
    });
  };

  const applyOccupy = () => {
    if (!dailyResult || !occupyCell || !occupyTeacherId) return;
    const teacher = teachers.find(t => t.id === occupyTeacherId);
    if (!teacher) return;
    const next: ClassTimetable = JSON.parse(JSON.stringify(dailyResult));
    next[occupyCell.classKey][0][occupyCell.period] = {
      teacherId: teacher.id,
      teacherName: teacher.name,
      subjectName: occupyLabel.trim() || "إشغال",
    };
    setDailyResult(next);
    setOccupyCell(null);
    setOccupyTeacherId("");
    setOccupyLabel("إشغال");
    toast({ title: "تم إسناد حصة الإشغال" });
  };


  const toggleAbsent = (id: string) => {
    setAbsentTeacherIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    const result = generateDailySchedule(selectedDay, absentTeacherIds);
    setDailyResult(result);
  };

  /**
   * التبديل اليدوي بين خانتين في الجدول اليومي بعد إصداره.
   * يمنع النظام أي تعارض:
   * 1. لا يجوز أن يكون المعلم في صفّين في نفس الحصة.
   * 2. لا يجوز إسناد حصة لمعلم غائب.
   */
  const handleCellClick = (classKey: string, period: number) => {
    if (!dailyResult) return;
    if (!selectedCell) {
      setSelectedCell({ classKey, period });
      return;
    }
    if (selectedCell.classKey === classKey && selectedCell.period === period) {
      setSelectedCell(null);
      return;
    }

    const a = selectedCell;
    const b = { classKey, period };
    const cellA = dailyResult[a.classKey]?.[0]?.[a.period] || null;
    const cellB = dailyResult[b.classKey]?.[0]?.[b.period] || null;

    if (!cellA && !cellB) {
      setSelectedCell(null);
      return;
    }

    // منع إسناد حصة لمعلم غائب
    const absent = (cell: typeof cellA) => cell && absentTeacherIds.includes(cell.teacherId);
    if (absent(cellA) || absent(cellB)) {
      toast({ title: "تعذّر التبديل", description: "لا يمكن إسناد حصة لمعلم غائب", variant: "destructive" });
      setSelectedCell(null);
      return;
    }

    // فحص تعارض المعلم في نفس الحصة داخل صفوف أخرى
    const isTeacherBusy = (teacherId: string, targetPeriod: number, ignore: { classKey: string; period: number }[]) =>
      Object.entries(dailyResult).some(([ck, days]) => {
        const cell = days[0]?.[targetPeriod];
        if (!cell) return false;
        if (ignore.some(ig => ig.classKey === ck && ig.period === targetPeriod)) return false;
        return cell.teacherId === teacherId;
      });

    if (cellA && isTeacherBusy(cellA.teacherId, b.period, [a, b])) {
      toast({ title: "تعارض", description: `${cellA.teacherName} لديه حصة أخرى في الحصة ${b.period + 1}`, variant: "destructive" });
      setSelectedCell(null);
      return;
    }
    if (cellB && isTeacherBusy(cellB.teacherId, a.period, [a, b])) {
      toast({ title: "تعارض", description: `${cellB.teacherName} لديه حصة أخرى في الحصة ${a.period + 1}`, variant: "destructive" });
      setSelectedCell(null);
      return;
    }

    // تنفيذ التبديل على نسخة جديدة
    const next: ClassTimetable = JSON.parse(JSON.stringify(dailyResult));
    const rowA = next[a.classKey][0];
    const rowB = next[b.classKey][0];
    const tmp = rowA[a.period] ?? null;
    rowA[a.period] = rowB[b.period] ?? null;
    rowB[b.period] = tmp;

    setDailyResult(next);
    setSelectedCell(null);
    toast({ title: "تم التبديل بنجاح" });
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

  /**
   * إرسال رسائل نصية للمعلمين المتأثرين بتعديل الجدول اليومي
   * (بسبب غياب معلم أو مغادرته) عبر نفس بوابة الرسائل المستخدمة في غياب الطلبة.
   */
  const buildAffectedMessages = () => {
    if (!dailyResult) return [] as { teacherId: string; phone: string; text: string }[];
    const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
    // المعلمون الذين تغيّرت حصصهم مقارنة بالجدول الأصلي لذلك اليوم
    const changed = new Map<string, { period: number; className: string; subjectName: string }[]>();

    Object.entries(dailyResult).forEach(([classKey, days]) => {
      const { className, section } = parseClassKey(classKey);
      const original = timetable[classKey]?.[selectedDay] || [];
      const updated = days[0] || [];
      for (let p = 0; p < periodsPerDay; p++) {
        const before = original[p];
        const after = updated[p];
        const sameCell = before?.teacherId === after?.teacherId && before?.subjectName === after?.subjectName;
        if (sameCell) continue;
        if (after) {
          const list = changed.get(after.teacherId) || [];
          list.push({ period: p + 1, className: `${className}/${section}`, subjectName: after.subjectName });
          changed.set(after.teacherId, list);
        }
      }
    });

    const msgs: { teacherId: string; phone: string; text: string }[] = [];
    changed.forEach((periods, teacherId) => {
      const teacher = teachers.find(t => t.id === teacherId);
      if (!teacher || !teacher.phone?.trim()) return;
      const lines = periods
        .sort((a, b) => a.period - b.period)
        .map(x => `الحصة ${x.period}: ${x.subjectName} - ${x.className}`)
        .join("\n");
      const reason = absentNames.length > 0 ? `بسبب غياب/مغادرة: ${absentNames.join("، ")}` : "بسبب تعديل الجدول";
      msgs.push({
        teacherId,
        phone: teacher.phone.trim(),
        text: `${schoolName || "المدرسة"}\nالأستاذ/ة ${teacher.name}\nتم تعديل جدول يوم ${DAYS[selectedDay]} ${reason}.\nحصصك الجديدة:\n${lines}`,
      });
    });
    return msgs;
  };

  const handleSendSms = async () => {
    const msgs = buildAffectedMessages();
    if (msgs.length === 0) {
      toast({ title: "لا توجد رسائل للإرسال", description: "تأكد من إدخال أرقام هواتف المعلمين المتأثرين بالتعديل", variant: "destructive" });
      return;
    }
    const profiles = loadGatewayProfiles();
    if (profiles.length === 0) {
      toast({ title: "لا توجد بوابة رسائل", description: "أضف بوابة الرسائل من إعدادات غياب الطلبة أولاً", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { sent, failed } = await sendBulkSmsMultiGateway(
        profiles,
        msgs.map(m => ({ phone: m.phone, text: m.text }))
      );
      toast({
        title: `تم إرسال ${sent} رسالة`,
        description: failed.length > 0 ? `فشل إرسال ${failed.length} رسالة` : "تم إشعار جميع المعلمين المتأثرين",
        variant: failed.length > 0 ? "destructive" : "default",
      });
    } finally {
      setSending(false);
    }
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">جدول يوم {DAYS[selectedDay]}:</h3>
              <p className="text-xs text-muted-foreground">
                التبديل اليدوي: اضغط على الحصة الأولى ثم على الحصة الثانية لتبديلهما (مع منع التعارض)
                {selectedCell && " — تم تحديد خانة، اختر الخانة الثانية"}
              </p>
            </div>
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
                            <td
                              key={pi}
                              onClick={() => handleCellClick(classKey, pi)}
                              title="اضغط للتبديل اليدوي"
                              className={`border border-border p-1 text-center min-w-[90px] cursor-pointer transition-colors ${
                                selectedCell?.classKey === classKey && selectedCell?.period === pi
                                  ? "ring-2 ring-primary bg-primary/10"
                                  : "hover:bg-accent/20"
                              }`}
                            >
                              {cell ? (
                                <div>
                                  <div className="font-medium text-xs">{cell.subjectName}</div>
                                  <div className="text-muted-foreground text-[10px]">{cell.teacherName}</div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOccupyCell({ classKey, period: pi });
                                    setOccupyTeacherId("");
                                    setOccupyLabel("إشغال");
                                  }}
                                  className="text-[10px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
                                >
                                  + إشغال
                                </button>
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
              <span className="text-xs text-muted-foreground self-center ml-1">عادي:</span>
              <Button size="sm" onClick={() => {
                const school = schoolName || "المدرسة";
                const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
                exportDailyScheduleExcel(dailyResult, selectedDay, periodsPerDay, school, absentNames, dutyTeachers);
              }}>
                <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const school = schoolName || "المدرسة";
                const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
                exportDailyScheduleDocx(dailyResult, selectedDay, periodsPerDay, school, absentNames, dutyTeachers);
              }}>
                <FileText className="w-4 h-4 ml-1" /> Word
              </Button>

              <span className="text-xs text-muted-foreground self-center mr-3 ml-1">معكوس:</span>
              <Button size="sm" variant="secondary" onClick={() => {
                const school = schoolName || "المدرسة";
                const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
                exportDailyScheduleExcelInverted(dailyResult, selectedDay, periodsPerDay, school, absentNames, dutyTeachers);
              }}>
                <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel معكوس
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const school = schoolName || "المدرسة";
                const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
                exportDailyScheduleDocxInverted(dailyResult, selectedDay, periodsPerDay, school, absentNames, dutyTeachers);
              }}>
                <FileText className="w-4 h-4 ml-1" /> Word معكوس
              </Button>

              <span className="text-xs text-muted-foreground self-center mr-3 ml-1">موضوع + معلم:</span>
              <Button size="sm" variant="secondary" onClick={() => {
                const school = schoolName || "المدرسة";
                const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
                exportDailyScheduleMatrixExcel(dailyResult, selectedDay, periodsPerDay, school, absentNames, dutyTeachers);
              }}>
                <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel موضوع/معلم
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const school = schoolName || "المدرسة";
                const absentNames = teachers.filter(t => absentTeacherIds.includes(t.id)).map(t => t.name);
                exportDailyScheduleMatrixDocx(dailyResult, selectedDay, periodsPerDay, school, absentNames, dutyTeachers);
              }}>
                <FileText className="w-4 h-4 ml-1" /> Word موضوع/معلم
              </Button>
            </div>


            {/* إشعار المعلمين برسائل نصية */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button size="sm" variant="default" onClick={handleSendSms} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <MessageSquare className="w-4 h-4 ml-1" />}
                إرسال رسائل للمعلمين المتأثرين
              </Button>
              <span className="text-xs text-muted-foreground">
                {buildAffectedMessages().length} معلم لديه رقم هاتف وتغيّر جدوله
              </span>
            </div>
          </div>
        )}

        {/* إسناد حصة إشغال يدوياً لخانة فارغة */}
        <Dialog open={!!occupyCell} onOpenChange={(o) => { if (!o) setOccupyCell(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إسناد حصة إشغال</DialogTitle>
              <DialogDescription>
                {occupyCell && `${parseClassKey(occupyCell.classKey).className}/${parseClassKey(occupyCell.classKey).section} - الحصة ${occupyCell.period + 1}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">المعلم</Label>
                <Select value={occupyTeacherId} onValueChange={setOccupyTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر معلماً متاحاً" />
                  </SelectTrigger>
                  <SelectContent>
                    {occupyCell && availableTeachers(occupyCell.period).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {occupyCell && availableTeachers(occupyCell.period).length === 0 && (
                  <p className="text-xs text-destructive mt-1">لا يوجد معلم متاح في هذه الحصة</p>
                )}
              </div>
              <div>
                <Label className="text-sm">الوصف</Label>
                <Input value={occupyLabel} onChange={e => setOccupyLabel(e.target.value)} placeholder="إشغال" />
              </div>
              <Button onClick={applyOccupy} disabled={!occupyTeacherId} className="w-full">
                إسناد
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>

  );
}
