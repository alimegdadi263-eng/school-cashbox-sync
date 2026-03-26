import { useState } from "react";
import { useTimetable } from "@/context/TimetableContext";
import { DAYS, parseClassKey } from "@/types/timetable";
import type { TimetableCell } from "@/types/timetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ArrowLeftRight } from "lucide-react";

export default function TimetableGrid() {
  const { teachers, timetable, periodsPerDay, getAllClassKeys, updateCell, swapCells, getTeacherSchedule } = useTimetable();
  const classKeys = getAllClassKeys();

  const [editDialog, setEditDialog] = useState<{ classKey: string; day: number; period: number } | null>(null);
  const [viewMode, setViewMode] = useState<"classes" | "teachers">("classes");
  const [selectedClass, setSelectedClass] = useState(classKeys[0] || "");
  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0]?.id || "");
  const [swapMode, setSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<{ classKey: string; day: number; period: number } | null>(null);
  const [dragSource, setDragSource] = useState<{ classKey: string; day: number; period: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ day: number; period: number } | null>(null);

  if (classKeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          أضف معلمين ومواد أولاً ثم اضغط "توليد الجدول"
        </CardContent>
      </Card>
    );
  }

  const handleCellClick = (classKey: string, day: number, period: number) => {
    if (swapMode) {
      if (!swapSource) {
        setSwapSource({ classKey, day, period });
        toast({ title: "اختر الحصة الثانية للتبديل" });
      } else {
        if (swapSource.classKey === classKey && swapSource.day === day) {
          const ok = swapCells(classKey, day, swapSource.period, period);
          if (ok) {
            toast({ title: "تم التبديل بنجاح!" });
          } else {
            toast({ title: "لا يمكن التبديل - يوجد تعارض!", variant: "destructive" });
          }
        } else {
          toast({ title: "يجب اختيار حصتين في نفس الصف ونفس اليوم", variant: "destructive" });
        }
        setSwapSource(null);
      }
      return;
    }
    setEditDialog({ classKey, day, period });
  };

  const assignCell = (cell: TimetableCell | null) => {
    if (editDialog) {
      updateCell(editDialog.classKey, editDialog.day, editDialog.period, cell);
      setEditDialog(null);
    }
  };

  // Check for conflicts
  const hasConflict = (teacherId: string, day: number, period: number, excludeClassKey?: string): boolean => {
    for (const [key, days] of Object.entries(timetable)) {
      if (key === excludeClassKey) continue;
      if (days[day]?.[period]?.teacherId === teacherId) return true;
    }
    return false;
  };

  const renderClassTable = (classKey: string) => {
    const { className, section } = parseClassKey(classKey);
    const days = timetable[classKey];
    if (!days) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="border border-border p-2 text-right w-20">الحصة</th>
              {DAYS.map(d => (
                <th key={d} className="border border-border p-2 text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: periodsPerDay }, (_, pi) => (
              <tr key={pi} className="hover:bg-muted/30">
                <td className="border border-border p-2 text-center font-bold bg-muted/50">{pi + 1}</td>
                {DAYS.map((_, di) => {
                  const cell = days[di]?.[pi];
                  const isSwapSelected = swapMode && swapSource?.classKey === classKey && swapSource?.day === di && swapSource?.period === pi;
                  return (
                    <td
                      key={di}
                      className={`border border-border p-1 text-center cursor-pointer hover:bg-accent/20 transition-colors min-w-[100px] ${isSwapSelected ? "ring-2 ring-primary bg-primary/10" : ""} ${swapMode ? "cursor-grab" : ""}`}
                      onClick={() => handleCellClick(classKey, di, pi)}
                    >
                      {cell ? (
                        <div>
                          <div className="font-medium text-xs">{cell.subjectName}</div>
                          <div className="text-muted-foreground text-[10px]">{cell.teacherName}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">فارغ</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTeacherTable = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return null;
    const schedule = getTeacherSchedule(teacherId);

    // Build a grid: day x period
    const grid: (typeof schedule[0] | null)[][] = Array.from({ length: DAYS.length }, () =>
      Array(periodsPerDay).fill(null)
    );
    schedule.forEach(s => {
      grid[s.day][s.period] = s;
    });

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="border border-border p-2 text-right w-20">الحصة</th>
              {DAYS.map(d => (
                <th key={d} className="border border-border p-2 text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: periodsPerDay }, (_, pi) => (
              <tr key={pi} className="hover:bg-muted/30">
                <td className="border border-border p-2 text-center font-bold bg-muted/50">{pi + 1}</td>
                {DAYS.map((_, di) => {
                  const item = grid[di][pi];
                  return (
                    <td key={di} className="border border-border p-1 text-center min-w-[100px]">
                      {item ? (
                        <div>
                          <div className="font-medium text-xs">{item.subjectName}</div>
                          <div className="text-muted-foreground text-[10px]">{parseClassKey(item.classKey).className}/{parseClassKey(item.classKey).section}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">فراغ</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted-foreground text-xs mt-2">
          إجمالي الحصص: {schedule.length} حصة أسبوعياً
        </p>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <Tabs value={viewMode} onValueChange={v => setViewMode(v as "classes" | "teachers")}>
            <TabsList>
              <TabsTrigger value="classes">جدول الصفوف</TabsTrigger>
              <TabsTrigger value="teachers">جدول المعلمين</TabsTrigger>
            </TabsList>

            <TabsContent value="classes" className="mt-4">
              <div className="mb-4 flex items-center gap-3">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="اختر الصف" />
                  </SelectTrigger>
                  <SelectContent>
                    {classKeys.map(k => {
                      const { className, section } = parseClassKey(k);
                      return <SelectItem key={k} value={k}>الصف {className} / شعبة {section}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <Button
                  variant={swapMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setSwapMode(!swapMode); setSwapSource(null); }}
                >
                  <ArrowLeftRight className="w-4 h-4 ml-1" />
                  {swapMode ? "إلغاء التبديل" : "تبديل حصص"}
                </Button>
                {swapMode && swapSource && (
                  <span className="text-xs text-primary font-medium">
                    تم اختيار الحصة {swapSource.period + 1} في {DAYS[swapSource.day]} - اختر الحصة الثانية
                  </span>
                )}
              </div>
              {selectedClass && renderClassTable(selectedClass)}
            </TabsContent>

            <TabsContent value="teachers" className="mt-4">
              <div className="mb-4">
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="اختر المعلم" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTeacher && renderTeacherTable(selectedTeacher)}
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>

      {/* Edit Cell Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الحصة</DialogTitle>
            <DialogDescription>
              {editDialog && `${DAYS[editDialog.day]} - الحصة ${editDialog.period + 1}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            <Button variant="outline" className="w-full justify-start" onClick={() => assignCell(null)}>
              🗑️ إفراغ الحصة
            </Button>
            {teachers.map(t => {
              const conflict = editDialog ? hasConflict(t.id, editDialog.day, editDialog.period, editDialog.classKey) : false;
              // Get subjects this teacher teaches for this class
              const classKey = editDialog?.classKey || "";
              const { className, section } = parseClassKey(classKey);
              const relevantSubjects = t.subjects.filter(s => s.className === className && s.section === section);
              const otherSubjects = t.subjects.filter(s => !(s.className === className && s.section === section));

              return (
                <div key={t.id}>
                  {relevantSubjects.map((s, i) => (
                    <Button
                      key={`${t.id}-${i}`}
                      variant="ghost"
                      className={`w-full justify-start text-right ${conflict ? "opacity-50 line-through" : ""}`}
                      disabled={conflict}
                      onClick={() => assignCell({ teacherId: t.id, teacherName: t.name, subjectName: s.subjectName })}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground mr-2">- {s.subjectName}</span>
                      {conflict && <span className="text-destructive text-xs mr-auto">(تعارض)</span>}
                    </Button>
                  ))}
                  {otherSubjects.map((s, i) => (
                    <Button
                      key={`${t.id}-other-${i}`}
                      variant="ghost"
                      className={`w-full justify-start text-right opacity-60 ${conflict ? "opacity-30 line-through" : ""}`}
                      disabled={conflict}
                      onClick={() => assignCell({ teacherId: t.id, teacherName: t.name, subjectName: s.subjectName })}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground mr-2">- {s.subjectName} ({s.className}/{s.section})</span>
                      {conflict && <span className="text-destructive text-xs mr-auto">(تعارض)</span>}
                    </Button>
                  ))}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
