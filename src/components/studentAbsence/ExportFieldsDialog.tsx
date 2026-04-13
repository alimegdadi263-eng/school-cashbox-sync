import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, FileDown } from "lucide-react";
import type { StudentInfo } from "@/types/studentAbsence";

export interface ExportField {
  key: keyof StudentInfo;
  label: string;
  defaultChecked: boolean;
}

export const ALL_EXPORT_FIELDS: ExportField[] = [
  { key: "name", label: "الاسم الكامل", defaultChecked: true },
  { key: "nationalId", label: "الرقم الوطني", defaultChecked: true },
  { key: "className", label: "الصف والشعبة", defaultChecked: true },
  { key: "parentPhone", label: "هاتف ولي الأمر", defaultChecked: true },
  { key: "parentName", label: "اسم ولي الأمر", defaultChecked: false },
  { key: "mainPhone", label: "الهاتف الأساسي", defaultChecked: false },
  { key: "studentPhone", label: "رقم هاتف الطالب", defaultChecked: false },
  { key: "gender", label: "الجنس", defaultChecked: false },
  { key: "nationality", label: "الجنسية", defaultChecked: false },
  { key: "birthDate", label: "تاريخ الميلاد", defaultChecked: false },
  { key: "email", label: "البريد الإلكتروني", defaultChecked: false },
  { key: "firstName", label: "الاسم الأول", defaultChecked: false },
  { key: "fatherName", label: "اسم الأب", defaultChecked: false },
  { key: "grandFatherName", label: "اسم الجد", defaultChecked: false },
  { key: "familyName", label: "اسم العائلة", defaultChecked: false },
  { key: "firstNameEn", label: "الاسم الأول (إنجليزي)", defaultChecked: false },
  { key: "fatherNameEn", label: "اسم الأب (إنجليزي)", defaultChecked: false },
  { key: "grandFatherNameEn", label: "اسم الجد (إنجليزي)", defaultChecked: false },
  { key: "familyNameEn", label: "العائلة (إنجليزي)", defaultChecked: false },
  { key: "fullNameEn", label: "الاسم الكامل (إنجليزي)", defaultChecked: false },
  { key: "username", label: "اسم المستخدم", defaultChecked: false },
  { key: "grade", label: "الصف (خام)", defaultChecked: false },
  { key: "section", label: "الشعبة (خام)", defaultChecked: false },
  { key: "branch", label: "المسار / القسم", defaultChecked: false },
  { key: "school", label: "المدرسة", defaultChecked: false },
  { key: "directorate", label: "المديرية", defaultChecked: false },
  { key: "authority", label: "السلطة المشرفة", defaultChecked: false },
  { key: "studentStatus", label: "حالة الطالب", defaultChecked: false },
  { key: "fileStatus", label: "حالة الملف", defaultChecked: false },
  { key: "studySystem", label: "النظام الدراسي", defaultChecked: false },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (fields: (keyof StudentInfo)[], format: "docx" | "xlsx") => void;
}

export default function ExportFieldsDialog({ open, onOpenChange, onExport }: Props) {
  const [selectedFields, setSelectedFields] = useState<Set<keyof StudentInfo>>(
    new Set(ALL_EXPORT_FIELDS.filter(f => f.defaultChecked).map(f => f.key))
  );

  const toggle = (key: keyof StudentInfo) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedFields(new Set(ALL_EXPORT_FIELDS.map(f => f.key)));
  const selectNone = () => setSelectedFields(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>اختر حقول التصدير</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>تحديد الكل</Button>
            <Button variant="outline" size="sm" onClick={selectNone}>إلغاء الكل</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_EXPORT_FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer text-sm">
                <Checkbox
                  checked={selectedFields.has(f.key)}
                  onCheckedChange={() => toggle(f.key)}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            onClick={() => { onExport(Array.from(selectedFields), "docx"); onOpenChange(false); }}
            disabled={selectedFields.size === 0}
            className="gap-1"
          >
            <FileText className="w-4 h-4" /> تصدير Word
          </Button>
          <Button
            onClick={() => { onExport(Array.from(selectedFields), "xlsx"); onOpenChange(false); }}
            disabled={selectedFields.size === 0}
            variant="outline"
            className="gap-1"
          >
            <FileDown className="w-4 h-4" /> تصدير Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
