import { useState, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import { useTimetable } from "@/context/TimetableContext";
import { DAYS, parseClassKey } from "@/types/timetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { GripVertical, AlertTriangle, Maximize2, Minimize2, ZoomIn, ZoomOut, Scan } from "lucide-react";


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
  "hsl(0 75% 85%)",    // أحمر
  "hsl(210 85% 82%)",  // أزرق
  "hsl(120 55% 80%)",  // أخضر
  "hsl(45 90% 80%)",   // أصفر/ذهبي
  "hsl(280 65% 85%)",  // بنفسجي
  "hsl(30 85% 82%)",   // برتقالي
  "hsl(180 60% 78%)",  // تركوازي
  "hsl(330 70% 85%)",  // وردي
  "hsl(90 50% 78%)",   // أخضر فاتح/ليموني
  "hsl(255 55% 82%)",  // نيلي
  "hsl(15 80% 80%)",   // برتقالي محمر
  "hsl(160 55% 78%)",  // أخضر مزرق
  "hsl(60 70% 78%)",   // زيتوني
  "hsl(300 50% 85%)",  // فوشيا
  "hsl(195 70% 78%)",  // سماوي
  "hsl(345 65% 80%)",  // قرمزي
  "hsl(75 55% 75%)",   // أخضر زيتوني
  "hsl(225 60% 82%)",  // أزرق ملكي
  "hsl(140 50% 78%)",  // أخضر نعناعي
  "hsl(10 75% 82%)",   // طوبي
  "hsl(270 45% 80%)",  // لافندر
  "hsl(50 75% 75%)",   // خردلي
  "hsl(315 55% 82%)",  // أرجواني
  "hsl(170 55% 75%)",  // فيروزي غامق
];

export default function MalhafaView() {
  const { timetable, periodsPerDay, getAllClassKeys, swapCells, swapCellsAcrossDays, moveCell, unplacedPeriods, placeFromStaging, moveToStaging, teachers } = useTimetable();
  const classKeys = getAllClassKeys();

  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragOver, setDragOver] = useState<{ classKey: string; day: number; period: number } | null>(null);
  const [stagingDragOver, setStagingDragOver] = useState(false);

  // ==== عرض الشاشة الكاملة + التكبير/التصغير (لرؤية كل الأيام والصفوف دفعة واحدة) ====
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  /** الوضع المدمج: إخفاء اسم المعلم وتصغير الخانات لتسع كل الجدول مع بقاء الخط واضحاً */
  const [compact, setCompact] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  /** الحد الأدنى للتصغير حتى يبقى النص مقروءاً */
  const MIN_READABLE_ZOOM = 0.55;

  const fitToScreen = useCallback(() => {
    const wrap = scrollRef.current;
    const table = tableRef.current;
    if (!wrap || !table) return;
    const naturalWidth = table.offsetWidth / (zoom || 1);
    const naturalHeight = table.offsetHeight / (zoom || 1);
    if (!naturalWidth || !naturalHeight) return;
    const ratio = Math.min(
      (wrap.clientWidth - 4) / naturalWidth,
      (wrap.clientHeight - 4) / naturalHeight,
      1.5
    );
    // لا ننزل تحت الحد المقروء؛ إن لزم الأمر نفعّل الوضع المدمج بدل التصغير المفرط
    if (ratio < MIN_READABLE_ZOOM && !compact) setCompact(true);
    setZoom(Math.max(MIN_READABLE_ZOOM, Math.min(1.5, ratio)));
  }, [zoom, compact]);

  // ملاءمة تلقائية عند الدخول لوضع الشاشة الكاملة
  useLayoutEffect(() => {
    if (fullscreen) {
      const id = window.setTimeout(fitToScreen, 50);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);


  const handleDropToStaging = () => {
    if (!dragSource || dragSource.type !== "cell") { setStagingDragOver(false); return; }
    const ok = moveToStaging(dragSource.classKey, dragSource.day, dragSource.period);
    if (ok) toast({ title: "تم نقل الحصة إلى المنطقة الفارغة" });
    else toast({ title: "لا توجد حصة لنقلها", variant: "destructive" });
    setDragSource(null);
    setDragOver(null);
    setStagingDragOver(false);
  };

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
    } else if (dragSource.classKey !== targetClassKey) {
      toast({ title: "يمكن النقل داخل نفس الصف فقط", variant: "destructive" });
    } else {
      const targetCell = timetable[targetClassKey]?.[targetDay]?.[targetPeriod];
      if (!targetCell) {
        // نقل إلى خانة فارغة (حتى في يوم آخر من نفس الصف)
        const ok = moveCell(targetClassKey, dragSource.day, dragSource.period, targetDay, targetPeriod);
        if (ok) toast({ title: "تم نقل الحصة بنجاح!" });
        else toast({ title: "لا يمكن نقل الحصة هنا - تعارض للمعلم أو حصة ممنوعة!", variant: "destructive" });
      } else if (dragSource.day === targetDay) {
        const ok = swapCells(targetClassKey, targetDay, dragSource.period, targetPeriod);
        if (ok) toast({ title: "تم التبديل بنجاح!" });
        else toast({ title: "لا يمكن التبديل - يوجد تعارض!", variant: "destructive" });
      } else {
        // تبديل حرّ بين يومين مختلفين داخل نفس الصف
        const ok = swapCellsAcrossDays(targetClassKey, dragSource.day, dragSource.period, targetDay, targetPeriod);
        if (ok) toast({ title: "تم التبديل بين اليومين بنجاح!" });
        else toast({ title: "لا يمكن التبديل - تعارض للمعلم!", variant: "destructive" });
      }
    }
    setDragSource(null);
    setDragOver(null);
  };


  return (
    <div className="space-y-4">
      <Card className={fullscreen ? "fixed inset-0 z-50 m-0 rounded-none overflow-hidden flex flex-col" : ""}>
        <CardHeader className={fullscreen ? "py-2 shrink-0" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <GripVertical className="w-5 h-5" />
              الملحفة التفاعلية (سحب وإفلات)
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.1).toFixed(2)))} title="تصغير">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(2)))} title="تكبير">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={fitToScreen} title="ملاءمة الجدول كاملاً على الشاشة">
                <Scan className="w-4 h-4 ml-1" />
                ملاءمة الشاشة
              </Button>
              <Button variant={fullscreen ? "default" : "outline"} size="sm" onClick={() => setFullscreen(f => !f)}>
                {fullscreen ? <Minimize2 className="w-4 h-4 ml-1" /> : <Maximize2 className="w-4 h-4 ml-1" />}
                {fullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={fullscreen ? "flex-1 min-h-0 flex flex-col pb-2" : ""}>
          <div
            ref={scrollRef}
            className={`overflow-auto border rounded-md relative ${fullscreen ? "flex-1 min-h-0" : "max-h-[70vh]"}`}
          >
            <div style={{ zoom }}>
              <table ref={tableRef} className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="border border-border p-1 text-center sticky top-0 right-0 z-30 bg-primary h-6" rowSpan={2}>الصف/الشعبة</th>
                    {DAYS.map(d => (
                      <th key={d} className="border border-border p-1 text-center sticky top-0 z-20 bg-primary h-6" colSpan={periodsPerDay}>{d}</th>
                    ))}
                  </tr>
                  <tr className="bg-primary/80 text-primary-foreground">
                    {DAYS.map((d, di) =>
                      Array.from({ length: periodsPerDay }, (_, pi) => (
                        <th key={`${di}-${pi}`} className="border border-border p-0.5 text-center w-[60px] sticky top-6 z-20 bg-primary">{pi + 1}</th>
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
                        <td className="border border-border p-1 text-center font-bold whitespace-nowrap sticky right-0 z-10 bg-secondary text-secondary-foreground">
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
          </div>

          <p className="text-muted-foreground text-xs mt-2">
            اسحب أي حصة وأفلتها على خانة فارغة (في أي يوم من نفس الصف) لنقلها، أو على حصة أخرى في نفس اليوم للتبديل، أو اسحب من الحصص المتبقية أدناه لوضعها في خانة فارغة
          </p>

        </CardContent>
      </Card>

      {/* Unplaced periods staging area */}
      <Card
        className={`transition-colors ${stagingDragOver ? "border-accent ring-2 ring-accent" : "border-destructive/50"}`}
        onDragOver={(e) => { e.preventDefault(); setStagingDragOver(true); }}
        onDragLeave={() => setStagingDragOver(false)}
        onDrop={(e) => { e.preventDefault(); handleDropToStaging(); }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            المنطقة الفارغة - حصص غير موزّعة ({unplacedPeriods.reduce((s, u) => s + u.count, 0)} حصة)
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            اسحب أي حصة من الملحفة وأفلتها هنا لإزالتها من الجدول، أو اسحب من هنا إلى خانة فارغة لوضعها
          </p>
        </CardHeader>
        <CardContent>
          {unplacedPeriods.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-6 border border-dashed rounded-lg">
              أفلت أي حصة هنا لإخراجها من الجدول
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unplacedPeriods.map((item, idx) => {
                const { className, section } = parseClassKey(item.classKey);
                const isStagingDrag = dragSource?.type === "staging" && (dragSource as StagingDragItem).stagingIdx === idx;
                return (
                  <div
                    key={`${item.teacherId}-${item.classKey}-${item.subjectName}-${idx}`}
                    draggable
                    onDragStart={() => setDragSource({ type: "staging", stagingIdx: idx, classKey: item.classKey })}
                    onDragEnd={() => { setDragSource(null); setDragOver(null); setStagingDragOver(false); }}
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
          )}
        </CardContent>
      </Card>

    </div>
  );
}
