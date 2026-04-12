import { useState, useMemo } from "react";
import { useTimetable } from "@/context/TimetableContext";
import { DAYS, parseClassKey } from "@/types/timetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { GripVertical, AlertTriangle } from "lucide-react";

interface DragItem {
  type: "cell";
  classKey: string;
  day: number;
  period: number;
}

interface StagingDragItem {
  type: "staging";
  stagingIdx: number;
  classKey: string;
}

type DragSource = DragItem | StagingDragItem;

// Distinct colors for teachers (HSL-based for good contrast)
const TEACHER_COLORS = [
  "hsl(210 80% 90%)", "hsl(340 70% 90%)", "hsl(120 60% 88%)", "hsl(45 80% 88%)",
  "hsl(270 60% 90%)", "hsl(180 60% 88%)", "hsl(15 80% 90%)", "hsl(200 70% 85%)",
  "hsl(330 60% 88%)", "hsl(90 60% 85%)", "hsl(60 70% 88%)", "hsl(240 50% 90%)",
  "hsl(0 70% 90%)", "hsl(160 60% 88%)", "hsl(300 50% 90%)", "hsl(30 70% 88%)",
  "hsl(220 60% 88%)", "hsl(350 60% 88%)", "hsl(140 50% 88%)", "hsl(50 60% 88%)",
  "hsl(280 50% 90%)", "hsl(190 60% 85%)", "hsl(10 60% 88%)", "hsl(100 50% 88%)",
];

export default function MalhafaView() {
  const { timetable, periodsPerDay, getAllClassKeys, swapCells, unplacedPeriods, placeFromStaging, teachers } = useTimetable();
  const classKeys = getAllClassKeys();

  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragOver, setDragOver] = useState<{ classKey: string; day: number; period: number } | null>(null);

  // Build teacher→color map
  const teacherColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    teachers.forEach((t, idx) => {
      map[t.id] = TEACHER_COLORS[idx % TEACHER_COLORS.length];
    });
    return map;
  }, [teachers]);

  if (Object.keys(timetable).length === 0) return null;

  const handleDrop = (targetClassKey: string, targetDay: number, targetPeriod: number) => {
    if (!dragSource) return;

    if (dragSource.type === "staging") {
      const ok = placeFromStaging(dragSource.stagingIdx, targetClassKey, targetDay, targetPeriod);
      if (ok) toast({ title: "تم وضع الحصة بنجاح!" });
      else toast({ title: "لا يمكن وضع الحصة هنا - تعارض أو خطأ!", variant: "destructive" });
    } else {
      if (dragSource.classKey === targetClassKey && dragSource.day === targetDay) {
        const ok = swapCells(targetClassKey, targetDay, dragSource.period, targetPeriod);
        if (ok) toast({ title: "تم التبديل بنجاح!" });
        else toast({ title: "لا يمكن التبديل - يوجد تعارض!", variant: "destructive" });
      } else {
        toast({ title: "يجب التبديل في نفس الصف ونفس اليوم", variant: "destructive" });
      }
    }
    setDragSource(null);
    setDragOver(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GripVertical className="w-5 h-5" />
            الملحفة التفاعلية (سحب وإفلات)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="border border-border p-1 text-center" rowSpan={2}>الصف/الشعبة</th>
                  {DAYS.map(d => (
                    <th key={d} className="border border-border p-1 text-center" colSpan={periodsPerDay}>{d}</th>
                  ))}
                </tr>
                <tr className="bg-primary/80 text-primary-foreground">
                  {DAYS.map((d, di) =>
                    Array.from({ length: periodsPerDay }, (_, pi) => (
                      <th key={`${di}-${pi}`} className="border border-border p-0.5 text-center w-[60px]">{pi + 1}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {classKeys.map(ck => {
                  const { className, section } = parseClassKey(ck);
                  const days = timetable[ck];
                  if (!days) return null;
                  return (
                    <tr key={ck} className="hover:bg-muted/20">
                      <td className="border border-border p-1 text-center font-bold bg-muted/50 whitespace-nowrap">
                        {className}/{section}
                      </td>
                      {DAYS.map((_, di) =>
                        Array.from({ length: periodsPerDay }, (_, pi) => {
                          const cell = days[di]?.[pi];
                          const isDragOverCell = dragOver?.classKey === ck && dragOver?.day === di && dragOver?.period === pi;
                          const isDragSourceCell = dragSource?.type === "cell" && dragSource?.classKey === ck && dragSource?.day === di && dragSource?.period === pi;
                          const bgColor = cell?.teacherId ? teacherColorMap[cell.teacherId] : undefined;
                          return (
                            <td
                              key={`${di}-${pi}`}
                              draggable
                              onDragStart={() => setDragSource({ type: "cell", classKey: ck, day: di, period: pi })}
                              onDragOver={(e) => { e.preventDefault(); setDragOver({ classKey: ck, day: di, period: pi }); }}
                              onDragLeave={() => setDragOver(null)}
                              onDrop={(e) => { e.preventDefault(); handleDrop(ck, di, pi); }}
                              onDragEnd={() => { setDragSource(null); setDragOver(null); }}
                              style={bgColor && !isDragOverCell && !isDragSourceCell ? { backgroundColor: bgColor } : undefined}
                              className={`border border-border p-0.5 text-center cursor-grab min-w-[60px] transition-colors
                                ${isDragOverCell ? "bg-accent/40 ring-1 ring-accent" : ""}
                                ${isDragSourceCell ? "opacity-50 bg-primary/10" : ""}
                                ${!isDragOverCell && !isDragSourceCell && !bgColor ? "hover:bg-accent/10" : ""}
                              `}
                            >
                              {cell ? (
                                <div className="leading-tight">
                                  <div className="font-semibold truncate">{cell.subjectName}</div>
                                  <div className="text-[8px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{cell.teacherName}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/30">-</span>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs mt-2">
            اسحب أي حصة وأفلتها على حصة أخرى في نفس الصف ونفس اليوم للتبديل، أو اسحب من الحصص المتبقية أدناه لوضعها في خانة فارغة
          </p>
        </CardContent>
      </Card>

      {/* Unplaced periods staging area */}
      {unplacedPeriods.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              حصص لم يتم توزيعها ({unplacedPeriods.reduce((s, u) => s + u.count, 0)} حصة)
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              اسحب أي حصة من هنا وأفلتها في خانة فارغة مناسبة في الملحفة أعلاه
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unplacedPeriods.map((item, idx) => {
                const { className, section } = parseClassKey(item.classKey);
                const isStagingDrag = dragSource?.type === "staging" && (dragSource as StagingDragItem).stagingIdx === idx;
                return (
                  <div
                    key={`${item.teacherId}-${item.classKey}-${item.subjectName}-${idx}`}
                    draggable
                    onDragStart={() => setDragSource({ type: "staging", stagingIdx: idx, classKey: item.classKey })}
                    onDragEnd={() => { setDragSource(null); setDragOver(null); }}
                    className={`border border-destructive/30 bg-destructive/5 rounded-lg p-2 cursor-grab select-none text-xs leading-tight min-w-[120px]
                      ${isStagingDrag ? "opacity-50 ring-2 ring-destructive" : "hover:bg-destructive/10"}
                    `}
                  >
                    <div className="font-bold">{item.subjectName}</div>
                    <div className="text-muted-foreground">{item.teacherName}</div>
                    <div className="text-muted-foreground">{className}/{section}</div>
                    <div className="mt-1 font-semibold text-destructive">{item.count} حصة</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
