import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Save, RotateCcw, Merge } from "lucide-react";

export interface SystemField {
  key: string;
  label: string;
  required?: boolean;
  /** If true, this field can be composed from two columns (e.g., دينار + فلس) */
  allowDinarFilsCombine?: boolean;
}

export interface ImportMappingResult {
  /** mapping[systemFieldKey] = columnIndex (0-based) */
  mapping: Record<string, number>;
  /** For combined دينار+فلس fields: combinedFields[fieldKey] = { dinarCol, filsCol } */
  combinedFields?: Record<string, { dinarCol: number; filsCol: number }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: ImportMappingResult) => void;
  fileColumns: string[];
  previewRows: string[][];
  systemFields: SystemField[];
  templateKey?: string;
  /** Rows to skip (e.g., sub-header rows like "د" / "ف"). Auto-detected if not provided. */
  skipRowIndices?: number[];
}

const SKIP_VALUE = "__skip__";
const COMBINED_VALUE = "__combined__";

/** Normalize Arabic text for comparison */
function normalizeAr(s: string): string {
  return s
    .replace(/[\s\u200c\u200b\u00A0]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .toLowerCase()
    .trim();
}

/** Compute similarity between two Arabic/English strings */
function similarity(a: string, b: string): number {
  const na = normalizeAr(a);
  const nb = normalizeAr(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  // Synonym groups - each group maps canonical names to aliases
  const synonymGroups: string[][] = [
    ["اللوازم", "اسمالماده", "الماده", "اسمالكتاب", "الكتاب", "اسماللوازم", "البند", "اسمالمادة"],
    ["الرصيدالفعلي", "الرصيد", "رصيدفعلي", "العدد", "رصيدالفعلي"],
    ["الموجود", "موجود", "الفعلي", "العددالموجود"],
    ["النقص", "نقص", "عجز"],
    ["الزياده", "زياده", "فائض", "الزيادة"],
    ["السعرالافرادي", "سعرافرادي", "السعرالإفرادي", "سعر", "ثمنالوحده", "سعرالوحده"],
    ["السعرالاجمالي", "سعراجمالي", "السعرالإجمالي", "الاجمالي", "المجموع", "الثمنالاجمالي"],
    ["رقمالسجل", "رقم", "م", "التسلسل", "ر.ت", "الرقم"],
    ["رقمصفحهالسجل", "رقمالصفحه", "صفحه", "صفحهالسجل", "رقمصفحةالسجل"],
    ["اسمالكتاب", "الكتاب", "اسمالماده", "الماده", "اللوازم"],
    ["الصف", "صف", "المرحله"],
    ["تاريخالطبعه", "الطبعه", "تاريخطبعه", "سنهالطبعه", "تاريخالطبعة"],
    ["الكميه", "كميه", "العدد", "الكميهبالارقام", "الكميةبالأرقام", "الكميهبالارقام", "الكمية"],
    ["الكميهبالحروف", "كميهحروف", "بالحروف", "الكميةبالحروف"],
    ["تاريخالادخال", "تاريخادخال", "تاريخالإدخال", "تاريخ"],
    ["سببالاتلاف", "سبب", "السبب", "سببالإتلاف", "ملاحظات"],
  ];

  for (const group of synonymGroups) {
    const normalizedGroup = group.map(normalizeAr);
    if (normalizedGroup.includes(na) && normalizedGroup.includes(nb)) return 0.9;
    // Partial match within synonym group
    const aInGroup = normalizedGroup.some(s => na.includes(s) || s.includes(na));
    const bInGroup = normalizedGroup.some(s => nb.includes(s) || s.includes(nb));
    if (aInGroup && bInGroup) return 0.7;
  }

  // Character overlap as fallback
  const set1 = new Set(na);
  const set2 = new Set(nb);
  let overlap = 0;
  set1.forEach(c => { if (set2.has(c)) overlap++; });
  const score = overlap / Math.max(set1.size, set2.size);
  return score > 0.6 ? score * 0.5 : 0; // Lower weight for char overlap
}

/** Detect if a row is a sub-header row like "د" / "ف" */
function isSubHeaderRow(row: string[]): boolean {
  const nonEmpty = row.filter(c => c.trim());
  if (nonEmpty.length === 0) return true;
  // If most cells are very short (1-2 chars) and contain "د" or "ف", it's a sub-header
  const shortCells = nonEmpty.filter(c => c.trim().length <= 2);
  if (shortCells.length >= nonEmpty.length * 0.5) {
    const hasDF = nonEmpty.some(c => c.trim() === "د" || c.trim() === "ف");
    if (hasDF) return true;
  }
  return false;
}

/** Detect if a row is a header/metadata row to skip */
function isMetadataRow(row: string[]): boolean {
  const text = row.join(" ");
  const skipPatterns = [
    "وزارة التربية", "التربية والتعليم", "مديرية التربية",
    "اسم المدرسة", "لجنة", "التوقيع", "التاريخ", "الاسم:",
    "الخاتم", "مدير المدرسة", "نشهد", "ملاحظة", "مالحظة",
    "Form#", "Form #", "QF72", "rev.", "نموذج جرد",
    "كشف أسماء", "يبين", "المعني بالعهدة",
  ];
  return skipPatterns.some(p => text.includes(p));
}

interface FieldMapping {
  type: "single" | "combined";
  colIdx?: number; // for single
  dinarCol?: number; // for combined
  filsCol?: number; // for combined
}

function autoMap(fileColumns: string[], systemFields: SystemField[]): Record<string, FieldMapping> {
  const result: Record<string, FieldMapping> = {};
  const usedCols = new Set<number>();

  // First pass: detect دينار/فلس column pairs
  const dinarFilsPairs: { dinarIdx: number; filsIdx: number; label: string }[] = [];
  for (let i = 0; i < fileColumns.length - 1; i++) {
    const col = normalizeAr(fileColumns[i]);
    const nextCol = normalizeAr(fileColumns[i + 1]);
    // Check if current col is a price header that spans two sub-columns
    if ((col.includes("سعر") || col.includes("اجمالي") || col.includes("افرادي")) && 
        (nextCol === "" || nextCol === "د" || nextCol === "ف" || nextCol.includes("فلس"))) {
      continue; // The parent header, handled below
    }
  }

  // Look for paired "د" and "ف" columns or adjacent price columns
  for (let i = 0; i < fileColumns.length - 1; i++) {
    const c1 = fileColumns[i].trim();
    const c2 = fileColumns[i + 1]?.trim();
    if ((c1 === "د" && c2 === "ف") || (c1 === "دينار" && c2 === "فلس")) {
      // Find which price field this belongs to by looking at preceding non-empty header
      let label = "";
      for (let j = i - 1; j >= 0; j--) {
        if (fileColumns[j].trim()) {
          label = fileColumns[j].trim();
          break;
        }
      }
      dinarFilsPairs.push({ dinarIdx: i, filsIdx: i + 1, label });
    }
  }

  // Map system fields
  for (const field of systemFields) {
    // Check if this is a price field that could use a دينار/فلس pair
    if (field.allowDinarFilsCombine && dinarFilsPairs.length > 0) {
      // Find best matching pair
      let bestPair = -1;
      let bestScore = 0.3;
      for (let p = 0; p < dinarFilsPairs.length; p++) {
        const pair = dinarFilsPairs[p];
        if (usedCols.has(pair.dinarIdx) || usedCols.has(pair.filsIdx)) continue;
        const score = pair.label ? similarity(field.label, pair.label) : 0;
        // Also check if the field label matches common patterns
        const fieldNorm = normalizeAr(field.label);
        const isUnitPrice = fieldNorm.includes("افرادي") || fieldNorm.includes("وحده");
        const isTotalPrice = fieldNorm.includes("اجمالي") || fieldNorm.includes("مجموع");
        const labelNorm = normalizeAr(pair.label);
        const labelIsUnit = labelNorm.includes("افرادي") || labelNorm.includes("وحده");
        const labelIsTotal = labelNorm.includes("اجمالي") || labelNorm.includes("مجموع");
        
        let adjustedScore = score;
        if ((isUnitPrice && labelIsUnit) || (isTotalPrice && labelIsTotal)) adjustedScore = Math.max(adjustedScore, 0.9);
        
        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestPair = p;
        }
      }
      if (bestPair >= 0) {
        const pair = dinarFilsPairs[bestPair];
        result[field.key] = { type: "combined", dinarCol: pair.dinarIdx, filsCol: pair.filsIdx };
        usedCols.add(pair.dinarIdx);
        usedCols.add(pair.filsIdx);
        continue;
      }
    }

    // Standard single-column matching
    let bestIdx = -1;
    let bestScore = 0.35;
    for (let i = 0; i < fileColumns.length; i++) {
      if (usedCols.has(i)) continue;
      if (fileColumns[i].trim() === "د" || fileColumns[i].trim() === "ف") continue; // Skip sub-header cols
      const score = similarity(field.label, fileColumns[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      result[field.key] = { type: "single", colIdx: bestIdx };
      usedCols.add(bestIdx);
    } else {
      result[field.key] = { type: "single" }; // skipped
    }
  }

  return result;
}

const TEMPLATE_STORAGE_PREFIX = "import_mapping_template_v2_";

export default function ImportMappingDialog({ open, onClose, onConfirm, fileColumns, previewRows, systemFields, templateKey }: Props) {
  const [fieldMappings, setFieldMappings] = useState<Record<string, FieldMapping>>({});

  useEffect(() => {
    if (!open || fileColumns.length === 0) return;

    // Try loading saved template
    if (templateKey) {
      try {
        const saved = localStorage.getItem(`${TEMPLATE_STORAGE_PREFIX}${templateKey}`);
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, FieldMapping>;
          // Validate indices
          const valid = Object.values(parsed).every(m => {
            if (m.type === "combined") return (m.dinarCol! < fileColumns.length && m.filsCol! < fileColumns.length);
            return !m.colIdx || m.colIdx < fileColumns.length;
          });
          if (valid) { setFieldMappings(parsed); return; }
        }
      } catch { /* ignore */ }
    }

    setFieldMappings(autoMap(fileColumns, systemFields));
  }, [open, fileColumns, systemFields, templateKey]);

  const handleSingleChange = (fieldKey: string, value: string) => {
    setFieldMappings(prev => ({
      ...prev,
      [fieldKey]: value === SKIP_VALUE
        ? { type: "single" }
        : value === COMBINED_VALUE
          ? { type: "combined", dinarCol: undefined, filsCol: undefined }
          : { type: "single", colIdx: Number(value) },
    }));
  };

  const handleCombinedChange = (fieldKey: string, which: "dinarCol" | "filsCol", value: string) => {
    setFieldMappings(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        type: "combined",
        [which]: value === SKIP_VALUE ? undefined : Number(value),
      },
    }));
  };

  const toggleCombined = (fieldKey: string, isCombined: boolean) => {
    setFieldMappings(prev => ({
      ...prev,
      [fieldKey]: isCombined
        ? { type: "combined", dinarCol: undefined, filsCol: undefined }
        : { type: "single" },
    }));
  };

  const handleReset = () => setFieldMappings(autoMap(fileColumns, systemFields));

  const handleSaveTemplate = () => {
    if (templateKey) {
      localStorage.setItem(`${TEMPLATE_STORAGE_PREFIX}${templateKey}`, JSON.stringify(fieldMappings));
    }
  };

  const handleConfirm = () => {
    const mapping: Record<string, number> = {};
    const combinedFields: Record<string, { dinarCol: number; filsCol: number }> = {};

    for (const [key, fm] of Object.entries(fieldMappings)) {
      if (fm.type === "combined" && fm.dinarCol !== undefined && fm.filsCol !== undefined) {
        combinedFields[key] = { dinarCol: fm.dinarCol, filsCol: fm.filsCol };
      } else if (fm.type === "single" && fm.colIdx !== undefined) {
        mapping[key] = fm.colIdx;
      }
    }

    if (templateKey) {
      localStorage.setItem(`${TEMPLATE_STORAGE_PREFIX}${templateKey}`, JSON.stringify(fieldMappings));
    }

    onConfirm({ mapping, combinedFields: Object.keys(combinedFields).length > 0 ? combinedFields : undefined });
    onClose();
  };

  const missingRequired = useMemo(() => {
    return systemFields.filter(f => {
      if (!f.required) return false;
      const fm = fieldMappings[f.key];
      if (!fm) return true;
      if (fm.type === "combined") return fm.dinarCol === undefined || fm.filsCol === undefined;
      return fm.colIdx === undefined;
    });
  }, [fieldMappings, systemFields]);

  // Filter preview rows (remove sub-header rows)
  const cleanPreview = useMemo(() => {
    return previewRows.filter(row => !isSubHeaderRow(row) && !isMetadataRow(row)).slice(0, 3);
  }, [previewRows]);

  const getPreviewValue = (fm: FieldMapping, row: string[]): string => {
    if (!row) return "—";
    if (fm.type === "combined" && fm.dinarCol !== undefined && fm.filsCol !== undefined) {
      const d = row[fm.dinarCol] || "0";
      const f = row[fm.filsCol] || "000";
      return `${d} دينار ${f} فلس`;
    }
    if (fm.type === "single" && fm.colIdx !== undefined) {
      return row[fm.colIdx] || "—";
    }
    return "—";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg">مطابقة أعمدة الملف مع حقول النظام</DialogTitle>
          <DialogDescription>اختر العمود المناسب لكل حقل. حقول الأسعار يمكن دمج عمودين (دينار + فلس).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mapping table */}
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">حقل النظام</TableHead>
                  <TableHead className="min-w-[260px]">عمود الملف</TableHead>
                  <TableHead className="min-w-[180px]">معاينة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemFields.map(field => {
                  const fm = fieldMappings[field.key] || { type: "single" };
                  const isCombined = fm.type === "combined";
                  const previewVal = cleanPreview[0] ? getPreviewValue(fm, cleanPreview[0]) : "—";

                  return (
                    <TableRow key={field.key}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span>
                            {field.label}
                            {field.required && <span className="text-destructive mr-1">*</span>}
                          </span>
                          {field.allowDinarFilsCombine && (
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={isCombined}
                                onCheckedChange={(v) => toggleCombined(field.key, !!v)}
                                className="h-3.5 w-3.5"
                              />
                              <Merge className="w-3 h-3" />
                              دمج دينار + فلس
                            </label>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isCombined ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium min-w-[40px]">دينار:</span>
                              <Select
                                value={fm.dinarCol !== undefined ? String(fm.dinarCol) : SKIP_VALUE}
                                onValueChange={(v) => handleCombinedChange(field.key, "dinarCol", v)}
                              >
                                <SelectTrigger className="h-9 flex-1">
                                  <SelectValue placeholder="اختر عمود الدينار" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SKIP_VALUE}>— لم يُحدد —</SelectItem>
                                  {fileColumns.map((col, idx) => (
                                    <SelectItem key={idx} value={String(idx)}>
                                      عمود {idx + 1}: {col || `(فارغ)`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium min-w-[40px]">فلس:</span>
                              <Select
                                value={fm.filsCol !== undefined ? String(fm.filsCol) : SKIP_VALUE}
                                onValueChange={(v) => handleCombinedChange(field.key, "filsCol", v)}
                              >
                                <SelectTrigger className="h-9 flex-1">
                                  <SelectValue placeholder="اختر عمود الفلس" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SKIP_VALUE}>— لم يُحدد —</SelectItem>
                                  {fileColumns.map((col, idx) => (
                                    <SelectItem key={idx} value={String(idx)}>
                                      عمود {idx + 1}: {col || `(فارغ)`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <Select
                            value={fm.colIdx !== undefined ? String(fm.colIdx) : SKIP_VALUE}
                            onValueChange={(v) => handleSingleChange(field.key, v)}
                          >
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
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px]">
                        {previewVal === "—" ? (
                          <span className="text-muted-foreground/50">لم يُحدد</span>
                        ) : (
                          <span className="font-medium text-foreground">{previewVal}</span>
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
          {cleanPreview.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">معاينة أول {cleanPreview.length} صفوف بيانات:</p>
              <div className="border rounded-lg overflow-auto max-h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {fileColumns.map((col, idx) => (
                        <TableHead key={idx} className="text-xs whitespace-nowrap min-w-[80px]">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground">عمود {idx + 1}</span>
                            <span>{col || "(فارغ)"}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cleanPreview.map((row, rowIdx) => (
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

/** Helper: check if a data row should be skipped (sub-headers, metadata) */
export function shouldSkipRow(row: string[]): boolean {
  return isSubHeaderRow(row) || isMetadataRow(row);
}
