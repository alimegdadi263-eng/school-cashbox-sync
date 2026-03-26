import { useState } from "react";
import { useTimetable } from "@/context/TimetableContext";
import { DAYS, parseClassKey } from "@/types/timetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { GripVertical } from "lucide-react";

export default function MalhafaView() {
  const { timetable, periodsPerDay, getAllClassKeys, swapCells } = useTimetable();
  const classKeys = getAllClassKeys();

  const [dragSource, setDragSource] = useState<{ classKey: string; day: number; period: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ classKey: string; day: number; period: number } | null>(null);

  if (Object.keys(timetable).length === 0) return null;

  const handleDrop = (targetClassKey: string, targetDay: number, targetPeriod: number) => {
    if (!dragSource) return;
    if (dragSource.classKey === targetClassKey && dragSource.day === targetDay) {
      const ok = swapCells(targetClassKey, targetDay, dragSource.period, targetPeriod);
      if (ok) toast({ title: "تم التبديل بنجاح!" });
      else toast({ title: "لا يمكن التبديل - يوجد تعارض!", variant: "destructive" });
    } else {
      toast({ title: "يجب التبديل في نفس الصف ونفس اليوم", variant: "destructive" });
    }
    setDragSource(null);
    setDragOver(null);
  };

  return (
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
                        const isDragSourceCell = dragSource?.classKey === ck && dragSource?.day === di && dragSource?.period === pi;
                        return (
                          <td
                            key={`${di}-${pi}`}
                            draggable
                            onDragStart={() => setDragSource({ classKey: ck, day: di, period: pi })}
                            onDragOver={(e) => { e.preventDefault(); setDragOver({ classKey: ck, day: di, period: pi }); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={(e) => { e.preventDefault(); handleDrop(ck, di, pi); }}
                            onDragEnd={() => { setDragSource(null); setDragOver(null); }}
                            className={`border border-border p-0.5 text-center cursor-grab min-w-[60px] transition-colors
                              ${isDragOverCell ? "bg-accent/40 ring-1 ring-accent" : ""}
                              ${isDragSourceCell ? "opacity-50 bg-primary/10" : ""}
                              ${!isDragOverCell && !isDragSourceCell ? "hover:bg-accent/10" : ""}
                            `}
                          >
                            {cell ? (
                              <div className="leading-tight">
                                <div className="font-semibold truncate">{cell.subjectName}</div>
                                <div className="text-muted-foreground text-[8px] truncate">{cell.teacherName}</div>
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
          اسحب أي حصة وأفلتها على حصة أخرى في نفس الصف ونفس اليوم للتبديل
        </p>
      </CardContent>
    </Card>
  );
}
