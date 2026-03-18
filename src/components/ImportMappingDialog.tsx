import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Save, RotateCcw } from "lucide-react";

export interface SystemField {
  key: string;
  label: string;
  required?: boolean;
}

export interface ImportMappingResult {
  /** mapping[systemFieldKey] = columnIndex (0-based) */
  mapping: Record<string, number>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: ImportMappingResult) => void;
  /** Column headers extracted from the file */
  fileColumns: string[];
  /** First few rows of data for preview */
  previewRows: string[][];
  /** System fields the user can map to */
  systemFields: SystemField[];
  /** Storage key for saving/loading templates */
  templateKey?: string;
}

const SKIP_VALUE = "__skip__";

/** Compute similarity between two Arabic/English strings */
function similarity(a: string, b: string): number {
  const na = a.replace(/[\s\u200c\u200b]/g, "").toLowerCase();
  const nb = b.replace(/[\s\u200c\u200b]/g, "").toLowerCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  // Check for common Arabic synonyms
  const synonymMap: Record<string, string[]> = {
    "اللوازم": ["اسمالمادة", "المادة", "اسمالكتاب", "الكتاب", "اسماللوازم", "البند"],
    "الرصيدالفعلي": ["الرصيد", "رصيدفعلي", "العدد"],
    "الموجود": ["موجود", "الفعلي", "العددالموجود"],
    "النقص": ["نقص", "عجز"],
    "الزيادة": ["زيادة", "فائض"],
    "السعرالإفرادي": ["سعرافرادي", "السعرالافرادي", "سعر", "ثمنالوحدة", "سعرالوحدة"],
    "السعرالإجمالي": ["سعراجمالي", "السعرالاجمالي", "الاجمالي", "المجموع", "الثمنالاجمالي"],
    "رقمالسجل": ["رقم", "م", "التسلسل", "ر.ت"],
    "رقمصفحةالسجل": ["رقمالصفحة", "صفحة", "صفحةالسجل"],
    "اسمالكتاب": ["الكتاب", "اسمالمادة", "المادة", "اللوازم"],
    "الصف": ["صف", "المرحلة"],
    "تاريخالطبعة": ["الطبعة", "تاريخطبعة", "سنةالطبعة"],
    "الكمية": ["كمية", "العدد", "الكميةبالأرقام", "الكميةبالارقام"],
    "الكميةبالحروف": ["كميةحروف", "بالحروف"],
    "تاريخالادخال": ["تاريخادخال", "تاريخالإدخال", "تاريخ"],
    "سببالاتلاف": ["سبب", "السبب", "سببالإتلاف", "ملاحظات"],
  };

  for (const [_key, synonyms] of Object.entries(synonymMap)) {
    if (synonyms.includes(na) && synonyms.includes(nb)) return 0.7;
    if ((na.includes(nb) || nb.includes(na)) && synonyms.some(s => na.includes(s) || s.includes(na))) return 0.6;
  }

  // Simple char overlap
  const set1 = new Set(na);
  const set2 = new Set(nb);
  let overlap = 0;
  set1.forEach(c => { if (set2.has(c)) overlap++; });
  return overlap / Math.max(set1.size, set2.size);
}

function autoMap(fileColumns: string[], systemFields: SystemField[]): Record<string, string> {
  const result: Record<string, string> = {};
  const usedCols = new Set<number>();

  // For each system field, find best matching column
  for (const field of systemFields) {
    let bestIdx = -1;
    let bestScore = 0.4; // minimum threshold

    for (let i = 0; i < fileColumns.length; i++) {
      if (usedCols.has(i)) continue;
      const score = similarity(field.label, fileColumns[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      result[field.key] = String(bestIdx);
      usedCols.add(bestIdx);
    } else {
      result[field.key] = SKIP_VALUE;
    }
  }

  return result;
}

const TEMPLATE_STORAGE_PREFIX = "import_mapping_template_";

export default function ImportMappingDialog({ open, onClose, onConfirm, fileColumns, previewRows, systemFields, templateKey }: Props) {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Auto-map on open or load saved template
  useEffect(() => {
    if (!open || fileColumns.length === 0) return;

    // Try loading saved template
    if (templateKey) {
      try {
        const saved = localStorage.getItem(`${TEMPLATE_STORAGE_PREFIX}${templateKey}`);
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, string>;
          // Validate that column indices are still valid
          const valid = Object.entries(parsed).every(([_, v]) => v === SKIP_VALUE || (Number(v) >= 0 && Number(v) < fileColumns.length));
          if (valid) {
            setMapping(parsed);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setMapping(autoMap(fileColumns, systemFields));
  }, [open, fileColumns, systemFields, templateKey]);

  const handleChange = (fieldKey: string, colIdx: string) => {
    setMapping(prev => ({ ...prev, [fieldKey]: colIdx }));
  };

  const handleReset = () => {
    setMapping(autoMap(fileColumns, systemFields));
  };

  const handleSaveTemplate = () => {
    if (templateKey) {
      localStorage.setItem(`${TEMPLATE_STORAGE_PREFIX}${templateKey}`, JSON.stringify(mapping));
    }
  };

  const handleConfirm = () => {
    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(mapping)) {
      if (val !== SKIP_VALUE) {
        result[key] = Number(val);
      }
    }

    // Save template automatically
    if (templateKey) {
      localStorage.setItem(`${TEMPLATE_STORAGE_PREFIX}${templateKey}`, JSON.stringify(mapping));
    }

    onConfirm({ mapping: result });
    onClose();
  };

  const missingRequired = useMemo(() => {
    return systemFields.filter(f => f.required && (!mapping[f.key] || mapping[f.key] === SKIP_VALUE));
  }, [mapping, systemFields]);

  const previewData = previewRows.slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg">مطابقة أعمدة الملف مع حقول النظام</DialogTitle>
          <DialogDescription>اختر العمود المناسب لكل حقل. الحقول المطلوبة معلّمة بنجمة *</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mapping table */}
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">حقل النظام</TableHead>
                  <TableHead className="min-w-[220px]">عمود الملف</TableHead>
                  <TableHead className="min-w-[200px]">معاينة البيانات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemFields.map(field => {
                  const colIdx = mapping[field.key];
                  const isSkipped = !colIdx || colIdx === SKIP_VALUE;
                  const previewVal = !isSkipped && previewData[0] ? previewData[0][Number(colIdx)] || "—" : "—";

                  return (
                    <TableRow key={field.key}>
                      <TableCell className="font-medium">
                        {field.label}
                        {field.required && <span className="text-destructive mr-1">*</span>}
                      </TableCell>
                      <TableCell>
                        <Select value={colIdx || SKIP_VALUE} onValueChange={(v) => handleChange(field.key, v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="— تخطي —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP_VALUE}>— تخطي —</SelectItem>
                            {fileColumns.map((col, idx) => (
                              <SelectItem key={idx} value={String(idx)}>
                                عمود {idx + 1}: {col || `(فارغ)`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                        {isSkipped ? (
                          <span className="text-muted-foreground/50">لم يُحدد</span>
                        ) : (
                          <span>{previewVal}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-3">
            {missingRequired.length > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                حقول مطلوبة غير مطابقة: {missingRequired.map(f => f.label).join("، ")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                جميع الحقول المطلوبة مطابقة
              </Badge>
            )}
          </div>

          {/* Preview rows */}
          {previewData.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">معاينة أول {previewData.length} صفوف من الملف:</p>
              <div className="border rounded-lg overflow-auto max-h-[150px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {fileColumns.map((col, idx) => (
                        <TableHead key={idx} className="text-xs whitespace-nowrap min-w-[80px]">
                          {col || `عمود ${idx + 1}`}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        {fileColumns.map((_, colIdx) => (
                          <TableCell key={colIdx} className="text-xs py-1 whitespace-nowrap">
                            {row[colIdx] || ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row-reverse gap-2 sm:gap-2">
          <Button onClick={handleConfirm} disabled={missingRequired.length > 0}>
            <CheckCircle2 className="w-4 h-4 ml-1" />
            تأكيد الاستيراد
          </Button>
          {templateKey && (
            <Button variant="outline" onClick={handleSaveTemplate}>
              <Save className="w-4 h-4 ml-1" />
              حفظ القالب
            </Button>
          )}
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 ml-1" />
            إعادة المطابقة التلقائية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
