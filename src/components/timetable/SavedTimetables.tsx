import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimetable } from "@/context/TimetableContext";
import { toast } from "@/hooks/use-toast";
import { Save, RotateCcw, Trash2, Download, Upload } from "lucide-react";

export default function SavedTimetables() {
  const {
    timetable, teachers, periodsPerDay,
    savedTimetables, saveCurrentTimetable, restoreSavedTimetable, deleteSavedTimetable, importSavedTimetables,
  } = useTimetable();
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportOne = (id: string) => {
    const snap = savedTimetables.find(s => s.id === id);
    if (!snap) return;
    downloadJson([snap], `ملحفة-${snap.name}.json`);
    toast({ title: "تم تصدير النسخة كملف 📁" });
  };

  const exportCurrent = () => {
    if (!hasTimetable) {
      toast({ title: "لا يوجد جدول لتصديره", variant: "destructive" });
      return;
    }
    downloadJson([{
      id: `${Date.now()}`,
      name: name.trim() || `الملحفة الحالية`,
      createdAt: new Date().toISOString(),
      periodsPerDay,
      timetable,
      teachers,
    }], `الملحفة-الحالية.json`);
    toast({ title: "تم تصدير الملحفة الحالية 📁" });
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const added = importSavedTimetables(arr);
      if (added > 0) toast({ title: `تم استيراد ${added} نسخة ✅ — اضغط "استرجاع" لتطبيقها` });
      else toast({ title: "الملف لا يحتوي على جداول صالحة", variant: "destructive" });
    } catch {
      toast({ title: "تعذّر قراءة الملف", variant: "destructive" });
    }
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="text-lg">الجداول المحفوظة</CardTitle>
        <p className="text-sm text-muted-foreground">
          احفظ الجدول الحالي قبل توليد جدول جديد، أو صدّر الملحفة كملف واستوردها في أي وقت.
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
          <Button variant="outline" onClick={exportCurrent} disabled={!hasTimetable}>
            <Download className="w-4 h-4 ml-2" /> تصدير الملحفة كملف
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 ml-2" /> استيراد ملحفة محفوظة
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
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
                  <Button size="sm" variant="ghost" onClick={() => exportOne(s.id)}>
                    <Download className="w-4 h-4 ml-1" /> تصدير
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
