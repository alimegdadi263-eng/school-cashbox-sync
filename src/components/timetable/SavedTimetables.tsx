import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimetable } from "@/context/TimetableContext";
import { toast } from "@/hooks/use-toast";
import { Save, RotateCcw, Trash2 } from "lucide-react";

export default function SavedTimetables() {
  const { timetable, savedTimetables, saveCurrentTimetable, restoreSavedTimetable, deleteSavedTimetable } = useTimetable();
  const [name, setName] = useState("");

  const hasTimetable = Object.keys(timetable).length > 0;

  const handleSave = () => {
    if (!hasTimetable) {
      toast({ title: "لا يوجد جدول لحفظه", variant: "destructive" });
      return;
    }
    saveCurrentTimetable(name);
    setName("");
    toast({ title: "تم حفظ نسخة من الجدول ✅" });
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="text-lg">الجداول المحفوظة</CardTitle>
        <p className="text-sm text-muted-foreground">
          احفظ الجدول الحالي قبل توليد جدول جديد لتستطيع الرجوع إليه في أي وقت.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="اسم النسخة (مثال: جدول الفصل الأول - نهائي)"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={!hasTimetable}>
            <Save className="w-4 h-4 ml-2" /> حفظ الجدول الحالي
          </Button>
        </div>

        {savedTimetables.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد نسخ محفوظة بعد</p>
        ) : (
          <div className="space-y-2">
            {savedTimetables.map(s => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString("ar")} — {Object.keys(s.timetable).length} صف — {s.periodsPerDay} حصص
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (restoreSavedTimetable(s.id)) toast({ title: `تم استرجاع: ${s.name}` });
                    }}
                  >
                    <RotateCcw className="w-4 h-4 ml-1" /> استرجاع
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      deleteSavedTimetable(s.id);
                      toast({ title: "تم حذف النسخة" });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
