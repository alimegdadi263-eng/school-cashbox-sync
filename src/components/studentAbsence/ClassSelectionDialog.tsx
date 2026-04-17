// Class Selection Dialog - Used before triggering Ajyal absence automation
// Allows user to pick multiple grade/section combinations before processing
import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, CheckCircle2, Info } from "lucide-react";
import type { StudentInfo } from "@/types/studentAbsence";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentInfo[];
  todayAbsenceClassNames: string[]; // class names that have absences today
  onConfirm: (selectedClassNames: string[]) => void;
  actionLabel?: string;
}

export default function ClassSelectionDialog({
  open,
  onOpenChange,
  students,
  todayAbsenceClassNames,
  onConfirm,
  actionLabel = "تعبئة الغياب",
}: Props) {
  // Group students by class to show counts
  const classGroups = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach(s => {
      if (s.className) map.set(s.className, (map.get(s.className) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count,
        hasAbsence: todayAbsenceClassNames.includes(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [students, todayAbsenceClassNames]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Initialize selection when dialog opens - default to classes with absences
  useEffect(() => {
    if (open) setSelected(new Set(todayAbsenceClassNames));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(classGroups.map(c => c.name)));
  const selectAbsentOnly = () => setSelected(new Set(todayAbsenceClassNames));
  const clearAll = () => setSelected(new Set());

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onConfirm(Array.from(selected));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            اختر الصفوف لـ {actionLabel}
          </DialogTitle>
          <DialogDescription>
            حدد الصفوف التي تريد معالجتها على منصة أجيال. سيتم تأكيد حضور الصفوف الفارغة والصفوف بدون غياب تلقائياً.
          </DialogDescription>
        </DialogHeader>

        {classGroups.length === 0 ? (
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              لا يوجد طلاب في النظام. قم باستيراد الطلاب من أجيال أو إضافتهم من تبويب "إدارة الطلبة" أولاً.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <Button size="sm" variant="outline" onClick={selectAll}>
                اختيار الكل ({classGroups.length})
              </Button>
              <Button size="sm" variant="outline" onClick={selectAbsentOnly}>
                الصفوف ذات الغياب ({todayAbsenceClassNames.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={clearAll}>
                مسح الاختيار
              </Button>
              <div className="flex-1" />
              <Badge variant="secondary">
                {selected.size} / {classGroups.length} صف
              </Badge>
            </div>

            <ScrollArea className="h-[320px] border rounded-md p-2">
              <div className="space-y-1">
                {classGroups.map(({ name, count, hasAbsence }) => {
                  const isSelected = selected.has(name);
                  return (
                    <label
                      key={name}
                      className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <Checkbox checked={isSelected} onCheckedChange={() => toggle(name)} />
                      <div className="flex-1 flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">{name}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{count} طالب</Badge>
                          {hasAbsence ? (
                            <Badge className="bg-orange-500/10 text-orange-700 border-orange-300 text-xs">
                              يوجد غياب
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                              <CheckCircle2 className="w-3 h-3 ml-1" />
                              الجميع حاضر
                            </Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            <CheckCircle2 className="w-4 h-4 ml-2" />
            تنفيذ على {selected.size} صف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
