import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/context/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Plus,
  Trash2,
  FileDown,
  FileUp,
  FileText,
  ClipboardList,
  Package,
  Save,
  History,
  CalendarIcon,
  ArrowRightLeft,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import PizZip from "pizzip";
import ImportMappingDialog, { type SystemField, type ImportMappingResult } from "@/components/ImportMappingDialog";
import {
  fillInterrogationForm, fillCasualLeaveForm, fillNoPaymentForm, exportInventoryCustodyDocx,
  exportDisposalDocx,
  type InventoryCustodyItem,
  type DisposalDocxItem,
} from "@/lib/fillSecretaryForms";

// ─── Types ───
interface InventoryItem {
  id: string;
  serialNumber: number;
  itemName: string;
  actualBalance: number;
  existing: number;
  shortage: number;
  surplus: number;
  unitPrice: number;
  totalPrice: number;
  disposalQuantity: number;
}

interface DisposalItem {
  id: string;
  serialNumber: number;
  pageNumber: string;
  itemName: string;
  grade: string;
  editionDate: string;
  quantityNum: number;
  quantityWords: string;
  unitPrice: number;
  totalPrice: number;
  entryDate: string;
  reason: string;
  sourceCategoryId?: string;
  sourceItemId?: string;
}

interface DisposalRecord {
  id: string;
  date: string;
  category: string;
  items: DisposalItem[];
  committeeMember1: string;
  committeeMember2: string;
  committeeMember3: string;
  directorName: string;
}

interface InventoryToDisposalItem {
  sourceCategoryId: string;
  sourceCategoryLabel: string;
  sourceItemId: string;
  itemName: string;
  grade: string;
  unitPrice: number;
  quantityNum: number;
}

const INVENTORY_CATEGORIES = [
  { id: "sports", label: "المواد الرياضية", icon: "🏀" },
  { id: "vocational", label: "المواد المهنية", icon: "🔧" },
  { id: "furniture", label: "الأثاث المدرسي", icon: "🪑" },
  { id: "computers", label: "الحاسوب", icon: "💻" },
  { id: "physics_lab", label: "مختبر الفيزياء", icon: "⚡" },
  { id: "biology_lab", label: "مختبر الأحياء", icon: "🔬" },
  { id: "chemistry_lab", label: "مختبر الكيمياء", icon: "🧪" },
  { id: "textbooks", label: "الكتب المدرسية", icon: "📚" },
];

interface InventoryRecord {
  id: string;
  savedAt: string;
  categoryId: string;
  categoryLabel: string;
  items: InventoryItem[];
}

const STORAGE_KEY_PREFIX = "school_inventory_";
const INVENTORY_RECORDS_KEY_PREFIX = "school_inventory_records_";
const INVENTORY_DISPOSAL_QUEUE_KEY = "inventory_disposal_queue";
const DISPOSAL_STORAGE_KEY = "school_disposal_records";
const FONT_NAME = "Traditional Arabic";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const normalizeDigits = (input: string) =>
  input
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[٫]/g, ".")
    .replace(/[٬,]/g, "")
    .trim();

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const raw = normalizeDigits(String(value));
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const splitToDinarFils = (value: number) => {
  const normalized = Number.isFinite(value) ? Number(value) : 0;
  const dinar = Math.floor(normalized);
  const fils = Math.round((normalized - dinar) * 1000);
  return {
    dinar,
    fils,
    dinarText: dinar ? String(dinar) : "0",
    filsText: fils ? String(fils).padStart(3, "0") : "000",
  };
};

const getCurrencyBreakdownLabel = (value: number) => {
  const { dinarText, filsText } = splitToDinarFils(value);
  return `دينار ${dinarText} • فلس ${filsText}`;
};

const getInitialDisposalQuantity = (existing: number, shortage: number, savedValue?: number) => {
  const available = Math.max(0, Number(existing) || 0);
  if (available === 0) return 0;

  const preferred = typeof savedValue === "number" && Number.isFinite(savedValue)
    ? savedValue
    : Number(shortage) > 0
      ? Number(shortage)
      : 1;

  return Math.min(Math.max(preferred, 1), available);
};

// ─── LocalStorage helpers ───
function loadInventory(userId: string, category: string): InventoryItem[] {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}_${category}`);
    if (!data) return [];
    const parsed = JSON.parse(data);

    return parsed.map((item: any) => {
      const actualBalance = Number(item.actualBalance ?? item.quantity ?? 0);
      const existing = Number(item.existing ?? item.quantity ?? 0);
      const shortage = Number(item.shortage ?? 0);
      const surplus = Number(item.surplus ?? 0);
      const unitPrice = Number(item.unitPrice ?? 0);
      const totalPrice = Number(item.totalPrice ?? 0);

      return {
        id: item.id || generateId(),
        serialNumber: item.serialNumber || 1,
        itemName: item.itemName || "",
        actualBalance,
        existing,
        shortage,
        surplus,
        unitPrice,
        totalPrice,
        disposalQuantity: getInitialDisposalQuantity(existing, shortage, Number(item.disposalQuantity)),
      };
    });
  } catch {
    return [];
  }
}

function saveInventory(userId: string, category: string, items: InventoryItem[]) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}_${category}`, JSON.stringify(items));
}

function loadInventoryRecords(userId: string, category: string): InventoryRecord[] {
  try {
    const data = localStorage.getItem(`${INVENTORY_RECORDS_KEY_PREFIX}${userId}_${category}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveInventoryRecords(userId: string, category: string, records: InventoryRecord[]) {
  localStorage.setItem(`${INVENTORY_RECORDS_KEY_PREFIX}${userId}_${category}`, JSON.stringify(records));
}

function loadInventoryDisposalQueue(userId: string): InventoryToDisposalItem[] {
  try {
    const data = localStorage.getItem(`${INVENTORY_DISPOSAL_QUEUE_KEY}_${userId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveInventoryDisposalQueue(userId: string, items: InventoryToDisposalItem[]) {
  localStorage.setItem(`${INVENTORY_DISPOSAL_QUEUE_KEY}_${userId}`, JSON.stringify(items));
}

function loadDisposals(userId: string): DisposalRecord[] {
  try {
    const data = localStorage.getItem(`${DISPOSAL_STORAGE_KEY}_${userId}`);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveDisposals(userId: string, records: DisposalRecord[]) {
  localStorage.setItem(`${DISPOSAL_STORAGE_KEY}_${userId}`, JSON.stringify(records));
}

// ─── Inventory Tab Component ───
function InventoryTab({
  category,
  userId,
  schoolName,
  directorateName,
  directorName,
  committeeMember,
  committeeMember2,
}: {
  category: typeof INVENTORY_CATEGORIES[0];
  userId: string;
  schoolName: string;
  directorateName: string;
  directorName: string;
  committeeMember: string;
  committeeMember2: string;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);

  // Import mapping dialog state
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingColumns, setMappingColumns] = useState<string[]>([]);
  const [mappingPreview, setMappingPreview] = useState<string[][]>([]);
  const [mappingAllRows, setMappingAllRows] = useState<string[][]>([]);

  const INVENTORY_SYSTEM_FIELDS: SystemField[] = [
    { key: "itemName", label: "اللوازم", required: true },
    { key: "actualBalance", label: "الرصيد الفعلي" },
    { key: "existing", label: "الموجود" },
    { key: "shortage", label: "النقص" },
    { key: "surplus", label: "الزيادة" },
    { key: "unitPrice", label: "السعر الإفرادي" },
    { key: "totalPrice", label: "السعر الإجمالي" },
  ];

  useEffect(() => {
    setItems(loadInventory(userId, category.id));
    setRecords(loadInventoryRecords(userId, category.id));
  }, [userId, category.id]);

  const save = (newItems: InventoryItem[]) => {
    const normalized = newItems.map((item, idx) => ({ ...item, serialNumber: idx + 1 }));
    setItems(normalized);
    saveInventory(userId, category.id, normalized);
  };

  const parseInventoryCells = (cells: string[]): Omit<InventoryItem, "id" | "serialNumber"> | null => {
    const values = cells.map((cell) => cell.trim());
    if (values.every((value) => !value)) return null;

    const rowText = values.join(" ");
    if (
      rowText.includes("اللوازم") ||
      rowText.includes("السعر") ||
      rowText.includes("لجنة") ||
      rowText.includes("التوقيع") ||
      rowText.includes("التاريخ")
    ) {
      return null;
    }

    // New Word/Excel format with دينار/فلس split (11 cols)
    if (values.length >= 11 && values[9]) {
      const unitPrice = toNumber(values[3]) + toNumber(values[4]) / 1000;
      const totalPrice = toNumber(values[1]) + toNumber(values[2]) / 1000;
      const actualBalance = toNumber(values[8]);
      const existing = toNumber(values[7]);
      let shortage = toNumber(values[6]);
      let surplus = toNumber(values[5]);

      if (!shortage && !surplus) {
        const diff = existing - actualBalance;
        shortage = diff < 0 ? Math.abs(diff) : 0;
        surplus = diff > 0 ? diff : 0;
      }

      return {
        itemName: values[9],
        actualBalance,
        existing,
        shortage,
        surplus,
        unitPrice,
        totalPrice: totalPrice || unitPrice * shortage,
        disposalQuantity: getInitialDisposalQuantity(existing, shortage),
      };
    }

    // Legacy 8-column format
    if (values.length >= 8 && (values[1] || values[0])) {
      const itemName = values[1] || values[0];
      if (!itemName) return null;
      const actualBalance = toNumber(values[2]);
      const existing = toNumber(values[3]);
      const shortage = toNumber(values[4]);
      const surplus = toNumber(values[5]);
      const unitPrice = toNumber(values[6]);
      const totalPrice = toNumber(values[7]) || unitPrice * shortage;

      return {
        itemName,
        actualBalance,
        existing,
        shortage,
        surplus,
        unitPrice,
        totalPrice,
        disposalQuantity: getInitialDisposalQuantity(existing, shortage),
      };
    }

    return null;
  };

  const addItem = () => {
    save([
      ...items,
      {
        id: generateId(),
        serialNumber: items.length + 1,
        itemName: "",
        actualBalance: 0,
        existing: 0,
        shortage: 0,
        surplus: 0,
        unitPrice: 0,
        totalPrice: 0,
        disposalQuantity: 0,
      },
    ]);
  };

  const updateItem = (id: string, field: keyof InventoryItem, value: string | number) => {
    save(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };

        if (field === "actualBalance" || field === "existing") {
          const diff = Number(updated.existing) - Number(updated.actualBalance);
          updated.shortage = diff < 0 ? Math.abs(diff) : 0;
          updated.surplus = diff > 0 ? diff : 0;
          updated.disposalQuantity = getInitialDisposalQuantity(updated.existing, updated.shortage, updated.disposalQuantity);
        }

        if (field === "disposalQuantity") {
          updated.disposalQuantity = getInitialDisposalQuantity(updated.existing, updated.shortage, Number(value));
        }

        if (field === "unitPrice" || field === "shortage") {
          updated.totalPrice = Number(updated.shortage) * Number(updated.unitPrice);
        }

        return updated;
      })
    );
  };

  const removeItem = (id: string) => {
    save(items.filter((item) => item.id !== id));
  };

  const saveCurrentInventoryList = () => {
    if (items.length === 0) {
      toast({ title: "لا توجد بيانات للحفظ", variant: "destructive" });
      return;
    }
    const record: InventoryRecord = {
      id: generateId(),
      savedAt: format(new Date(), "yyyy/MM/dd"),
      categoryId: category.id,
      categoryLabel: category.label,
      items: items.map((item) => ({ ...item, id: generateId() })),
    };
    const updated = [record, ...records];
    setRecords(updated);
    saveInventoryRecords(userId, category.id, updated);
    toast({ title: "تم حفظ قائمة الجرد" });
  };

  const restoreInventoryRecord = (recordId: string) => {
    const record = records.find((entry) => entry.id === recordId);
    if (!record) return;
    save(record.items.map((item) => ({ ...item, id: generateId() })));
    toast({ title: "تم تحميل قائمة الجرد المحفوظة" });
  };

  const deleteInventoryRecord = (recordId: string) => {
    if (!window.confirm("هل تريد شطب هذه القائمة المحفوظة؟")) return;
    const updated = records.filter((record) => record.id !== recordId);
    setRecords(updated);
    saveInventoryRecords(userId, category.id, updated);
    toast({ title: "تم شطب قائمة الجرد" });
  };

  const moveItemToDisposal = (item: InventoryItem) => {
    if (!item.itemName.trim()) {
      toast({ title: "أدخل اسم المادة أولاً", variant: "destructive" });
      return;
    }

    const quantityToDispose = getInitialDisposalQuantity(item.existing, item.shortage, item.disposalQuantity);
    if (quantityToDispose <= 0) {
      toast({ title: "لا توجد كمية متاحة للإتلاف", variant: "destructive" });
      return;
    }

    const queue = loadInventoryDisposalQueue(userId);
    queue.push({
      sourceCategoryId: category.id,
      sourceCategoryLabel: category.label,
      sourceItemId: item.id,
      itemName: item.itemName,
      grade: "",
      unitPrice: item.unitPrice || 0,
      quantityNum: quantityToDispose,
    });
    saveInventoryDisposalQueue(userId, queue);

    // Immediately deduct from inventory
    save(
      items.map((inv) => {
        if (inv.id !== item.id) return inv;
        const nextExisting = Math.max(0, inv.existing - quantityToDispose);
        const nextActualBalance = Math.max(0, inv.actualBalance - quantityToDispose);
        const diff = nextExisting - nextActualBalance;
        return {
          ...inv,
          existing: nextExisting,
          actualBalance: nextActualBalance,
          shortage: diff < 0 ? Math.abs(diff) : 0,
          surplus: diff > 0 ? diff : 0,
          disposalQuantity: 0,
        };
      })
    );

    toast({ title: `تم ترحيل ${quantityToDispose} من "${item.itemName}" وخصمها من الجرد` });
  };

  const moveAllShortagesToDisposal = () => {
    const candidates = items.filter((item) => item.itemName.trim() && getInitialDisposalQuantity(item.existing, item.shortage, item.disposalQuantity) > 0);
    if (candidates.length === 0) {
      toast({ title: "لا توجد مواد قابلة للترحيل", variant: "destructive" });
      return;
    }

    const queue = loadInventoryDisposalQueue(userId);
    const updatedItems = [...items];
    candidates.forEach((item) => {
      const qty = getInitialDisposalQuantity(item.existing, item.shortage, item.disposalQuantity);
      queue.push({
        sourceCategoryId: category.id,
        sourceCategoryLabel: category.label,
        sourceItemId: item.id,
        itemName: item.itemName,
        grade: "",
        unitPrice: item.unitPrice || 0,
        quantityNum: qty,
      });
      // Deduct from inventory
      const idx = updatedItems.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        const inv = updatedItems[idx];
        const nextExisting = Math.max(0, inv.existing - qty);
        const nextActualBalance = Math.max(0, inv.actualBalance - qty);
        const diff = nextExisting - nextActualBalance;
        updatedItems[idx] = {
          ...inv,
          existing: nextExisting,
          actualBalance: nextActualBalance,
          shortage: diff < 0 ? Math.abs(diff) : 0,
          surplus: diff > 0 ? diff : 0,
          disposalQuantity: 0,
        };
      }
    });
    saveInventoryDisposalQueue(userId, queue);
    save(updatedItems);
    toast({ title: `تم ترحيل ${candidates.length} مادة وخصمها من الجرد` });
  };

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(category.label);
    ws.views = [{ rightToLeft: true }];

    ws.addRow(["وزارة التربية والتعليم"]);
    ws.mergeCells(1, 1, 1, 8);
    ws.getRow(1).getCell(1).font = { name: FONT_NAME, bold: true, size: 14 };
    ws.getRow(1).getCell(1).alignment = { horizontal: "center" };

    ws.addRow([`${schoolName} - جرد ${category.label}`]);
    ws.mergeCells(2, 1, 2, 8);
    ws.getRow(2).getCell(1).font = { name: FONT_NAME, bold: true, size: 14 };
    ws.getRow(2).getCell(1).alignment = { horizontal: "center" };
    ws.addRow([]);

    const headers = ["رقم السجل", "اللوازم", "الرصيد الفعلي", "الموجود", "النقص", "الزيادة", "السعر الإفرادي (دينار/فلس)", "السعر الإجمالي (دينار/فلس)"];
    const hRow = ws.addRow(headers);
    hRow.eachCell((cell) => {
      cell.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B3A55" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    items.forEach((item) => {
      const unitLabel = `${item.unitPrice.toFixed(3)} (${getCurrencyBreakdownLabel(item.unitPrice)})`;
      const totalLabel = `${item.totalPrice.toFixed(3)} (${getCurrencyBreakdownLabel(item.totalPrice)})`;
      const row = ws.addRow([
        item.serialNumber,
        item.itemName,
        item.actualBalance,
        item.existing,
        item.shortage,
        item.surplus,
        unitLabel,
        totalLabel,
      ]);
      row.eachCell((cell) => {
        cell.font = { name: FONT_NAME, size: 12 };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
    });

    ws.getColumn(1).width = 10;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 10;
    ws.getColumn(7).width = 28;
    ws.getColumn(8).width = 28;

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `جرد_${category.label}_${schoolName}.xlsx`);
    toast({ title: "تم تصدير الجرد إلى Excel" });
  };

  const exportDocx = async () => {
    const custodyItems: InventoryCustodyItem[] = items.map((item) => ({
      serialNumber: item.serialNumber,
      itemName: item.itemName,
      actualBalance: item.actualBalance,
      existing: item.existing,
      shortage: item.shortage,
      surplus: item.surplus,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    await exportInventoryCustodyDocx({
      school: schoolName,
      directorate: directorateName,
      categoryLabel: category.label,
      items: custodyItems,
      directorName,
      committeeMember1: committeeMember,
      committeeMember2: committeeMember2,
      custodian: "",
      date: format(new Date(), "yyyy/MM/dd"),
    });

    toast({ title: "تم تصدير نموذج الجرد (Word)" });
  };

  /** Extract rows from Word file and open mapping dialog */
  const importWord = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const xml = zip.file("word/document.xml")?.asText();
      if (!xml) throw new Error("ملف Word غير صالح");

      const allRows: string[][] = [];
      const rowMatches = xml.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g) || [];

      for (const rowXml of rowMatches) {
        const cellMatches = rowXml.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];
        const cells = cellMatches.map((cellXml) => {
          const textParts = cellXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
          return textParts.map((part) => part.replace(/<[^>]*>/g, "")).join("").trim();
        });
        if (cells.some(c => c)) allRows.push(cells);
      }

      if (allRows.length === 0) throw new Error("لم يتم العثور على بيانات");

      // Find header row (first row with content) and use it as columns
      const headerRow = allRows[0];
      const dataRows = allRows.slice(1).filter(row => !row.every(c => !c));

      // Normalize column count
      const maxCols = Math.max(headerRow.length, ...dataRows.map(r => r.length));
      const normalizedHeader = Array.from({ length: maxCols }, (_, i) => headerRow[i] || `عمود ${i + 1}`);
      const normalizedData = dataRows.map(row => Array.from({ length: maxCols }, (_, i) => row[i] || ""));

      setMappingColumns(normalizedHeader);
      setMappingPreview(normalizedData.slice(0, 3));
      setMappingAllRows(normalizedData);
      setMappingOpen(true);
    } catch (error) {
      toast({ title: "خطأ في قراءة الملف", description: String(error), variant: "destructive" });
    }

    if (wordInputRef.current) wordInputRef.current.value = "";
  };

  /** Extract rows from Excel file and open mapping dialog */
  const importExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("لا يوجد بيانات في ملف Excel");

      const getCellText = (row: ExcelJS.Row, colIndex: number) => {
        const raw = row.getCell(colIndex).value as any;
        if (raw === null || raw === undefined) return "";
        if (typeof raw === "object" && raw.result !== undefined && raw.result !== null) return String(raw.result);
        if (typeof raw === "object" && raw.text !== undefined && raw.text !== null) return String(raw.text);
        return String(raw);
      };

      const allRows: string[][] = [];
      const colCount = sheet.columnCount || 15;
      sheet.eachRow((row) => {
        const cells = Array.from({ length: colCount }, (_, index) => getCellText(row, index + 1));
        if (cells.some(c => c)) allRows.push(cells);
      });

      if (allRows.length === 0) throw new Error("لم يتم العثور على بيانات");

      const headerRow = allRows[0];
      const dataRows = allRows.slice(1).filter(row => !row.every(c => !c));

      const maxCols = Math.max(headerRow.length, ...dataRows.map(r => r.length));
      const normalizedHeader = Array.from({ length: maxCols }, (_, i) => headerRow[i] || `عمود ${i + 1}`);
      const normalizedData = dataRows.map(row => Array.from({ length: maxCols }, (_, i) => row[i] || ""));

      setMappingColumns(normalizedHeader);
      setMappingPreview(normalizedData.slice(0, 3));
      setMappingAllRows(normalizedData);
      setMappingOpen(true);
    } catch (error) {
      toast({ title: "خطأ في قراءة الملف", description: String(error), variant: "destructive" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Handle confirmed mapping from the dialog */
  const handleMappingConfirm = (result: ImportMappingResult) => {
    const { mapping } = result;
    const importedItems: InventoryItem[] = [];

    for (const row of mappingAllRows) {
      const itemName = mapping.itemName !== undefined ? row[mapping.itemName]?.trim() : "";
      if (!itemName) continue;

      // Filter out header-like rows
      if (itemName.includes("اللوازم") || itemName.includes("السعر") || itemName.includes("لجنة")) continue;

      const actualBalance = mapping.actualBalance !== undefined ? toNumber(row[mapping.actualBalance]) : 0;
      const existing = mapping.existing !== undefined ? toNumber(row[mapping.existing]) : 0;
      let shortage = mapping.shortage !== undefined ? toNumber(row[mapping.shortage]) : 0;
      let surplus = mapping.surplus !== undefined ? toNumber(row[mapping.surplus]) : 0;
      const unitPrice = mapping.unitPrice !== undefined ? toNumber(row[mapping.unitPrice]) : 0;
      let totalPrice = mapping.totalPrice !== undefined ? toNumber(row[mapping.totalPrice]) : 0;

      if (!shortage && !surplus && actualBalance && existing) {
        const diff = existing - actualBalance;
        shortage = diff < 0 ? Math.abs(diff) : 0;
        surplus = diff > 0 ? diff : 0;
      }
      if (!totalPrice) totalPrice = unitPrice * shortage;

      importedItems.push({
        id: generateId(),
        serialNumber: importedItems.length + 1,
        itemName,
        actualBalance,
        existing,
        shortage,
        surplus,
        unitPrice,
        totalPrice,
        disposalQuantity: getInitialDisposalQuantity(existing, shortage),
      });
    }

    if (importedItems.length === 0) {
      toast({ title: "لم يتم العثور على بيانات قابلة للاستيراد", variant: "destructive" });
      return;
    }

    save(importedItems);
    toast({ title: "تم الاستيراد", description: `تم استيراد ${importedItems.length} عنصر بنجاح` });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <span>{category.icon}</span>
          جرد {category.label}
          <span className="text-muted-foreground text-sm">({items.length} عنصر)</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="w-4 h-4 ml-1" /> استيراد Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importExcel} />

          <Button size="sm" variant="outline" onClick={() => wordInputRef.current?.click()}>
            <FileUp className="w-4 h-4 ml-1" /> استيراد Word
          </Button>
          <input ref={wordInputRef} type="file" accept=".docx" className="hidden" onChange={importWord} />

          <Button size="sm" variant="outline" onClick={exportExcel} disabled={items.length === 0}>
            <FileDown className="w-4 h-4 ml-1" /> تصدير Excel
          </Button>
          <Button size="sm" variant="outline" onClick={exportDocx} disabled={items.length === 0}>
            <FileText className="w-4 h-4 ml-1" /> تصدير Word
          </Button>
          <Button size="sm" variant="outline" onClick={saveCurrentInventoryList} disabled={items.length === 0}>
            <Save className="w-4 h-4 ml-1" /> حفظ قائمة الجرد
          </Button>
          <Button size="sm" variant="outline" onClick={moveAllShortagesToDisposal} disabled={items.length === 0}>
            <ArrowRightLeft className="w-4 h-4 ml-1" /> ترحيل للإتلاف
          </Button>
          <Button size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 ml-1" /> إضافة
          </Button>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[60px] text-center text-sm">رقم</TableHead>
                <TableHead className="min-w-[220px] text-sm">اللوازم</TableHead>
                <TableHead className="min-w-[110px] text-center text-sm">الرصيد الفعلي</TableHead>
                <TableHead className="min-w-[100px] text-center text-sm">الموجود</TableHead>
                <TableHead className="min-w-[80px] text-center text-sm">النقص</TableHead>
                <TableHead className="min-w-[80px] text-center text-sm">الزيادة</TableHead>
                <TableHead className="min-w-[200px] text-center text-sm">السعر الإفرادي</TableHead>
                <TableHead className="min-w-[200px] text-center text-sm">السعر الإجمالي</TableHead>
                <TableHead className="min-w-[120px] text-center text-sm">كمية الإتلاف</TableHead>
                <TableHead className="min-w-[90px] text-center text-sm">إتلاف</TableHead>
                <TableHead className="min-w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const unitSplit = splitToDinarFils(item.unitPrice);
                const totalSplit = splitToDinarFils(item.totalPrice);
                const allowedDisposalQuantity = getInitialDisposalQuantity(item.existing, item.shortage, item.disposalQuantity);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-center font-semibold text-base py-3">{item.serialNumber}</TableCell>
                    <TableCell>
                      <Input
                        value={item.itemName}
                        onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                        className="h-11 min-w-[200px] text-base"
                        placeholder="اسم المادة"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={item.actualBalance}
                        onChange={(e) => updateItem(item.id, "actualBalance", Number(e.target.value))}
                        className="h-11 text-center min-w-[90px] text-base"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={item.existing}
                        onChange={(e) => updateItem(item.id, "existing", Number(e.target.value))}
                        className="h-11 text-center min-w-[90px] text-base"
                      />
                    </TableCell>
                    <TableCell className="text-center text-destructive font-bold text-base py-3">{item.shortage || ""}</TableCell>
                    <TableCell className="text-center font-bold text-primary text-base py-3">{item.surplus || ""}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={0.001}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                        className="h-11 text-center min-w-[160px] text-base"
                        placeholder="مثال: 12.500"
                      />
                      <p className="text-sm text-muted-foreground text-center mt-1 whitespace-nowrap">
                        {item.unitPrice ? `${unitSplit.dinarText} دينار ${unitSplit.filsText} فلس` : "بالدينار.فلس"}
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-bold text-base py-1">{item.totalPrice ? item.totalPrice.toFixed(3) : ""}</div>
                      <p className="text-sm text-muted-foreground whitespace-nowrap">
                        {item.totalPrice ? `${totalSplit.dinarText} دينار ${totalSplit.filsText} فلس` : "تلقائي"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={Math.max(0, item.existing)}
                        value={allowedDisposalQuantity}
                        onChange={(e) => updateItem(item.id, "disposalQuantity", Number(e.target.value))}
                        className="h-11 text-center min-w-[90px] text-base"
                      />
                      <p className="text-sm text-muted-foreground text-center mt-1">متاح: {item.existing}</p>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => moveItemToDisposal(item)}>
                        <ArrowRightLeft className="w-3.5 h-3.5 ml-1" />
                        إتلاف
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeItem(item.id)} className="h-7 w-7 text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground border rounded-lg">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>لا توجد عناصر - أضف عنصراً أو استورد من Excel/Word</p>
        </div>
      )}

      {/* Import Mapping Dialog */}
      <ImportMappingDialog
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        onConfirm={handleMappingConfirm}
        fileColumns={mappingColumns}
        previewRows={mappingPreview}
        systemFields={INVENTORY_SYSTEM_FIELDS}
        templateKey={`inventory_${category.id}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 cursor-pointer" onClick={() => setShowHistory((prev) => !prev)}>
            <History className="w-4 h-4" />
            قوائم الجرد المحفوظة ({records.length})
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent className="space-y-2">
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد قوائم جرد محفوظة بعد.</p>
            ) : (
              records.map((record) => (
                <div key={record.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{record.categoryLabel}</p>
                    <p className="text-xs text-muted-foreground">{record.savedAt} • {record.items.length} مادة</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => restoreInventoryRecord(record.id)}>
                      <RefreshCw className="w-3.5 h-3.5 ml-1" /> تحميل
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteInventoryRecord(record.id)}>
                      <Trash2 className="w-3.5 h-3.5 ml-1" /> شطب
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ─── Disposal Section ───
function DisposalSection({
  userId,
  schoolName,
  directorateName,
  directorName,
  member1,
  member2,
}: {
  userId: string;
  schoolName: string;
  directorateName: string;
  directorName: string;
  member1: string;
  member2: string;
}) {
  const { toast } = useToast();
  const [records, setRecords] = useState<DisposalRecord[]>([]);
  const [items, setItems] = useState<DisposalItem[]>([]);
  const [category, setCategory] = useState(INVENTORY_CATEGORIES[0].id);
  const [committeeMember3, setCommitteeMember3] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [queuedInventoryCount, setQueuedInventoryCount] = useState(0);

  const disposalExcelInputRef = useRef<HTMLInputElement>(null);
  const disposalWordInputRef = useRef<HTMLInputElement>(null);

  // Import mapping dialog state
  const [dmOpen, setDmOpen] = useState(false);
  const [dmColumns, setDmColumns] = useState<string[]>([]);
  const [dmPreview, setDmPreview] = useState<string[][]>([]);
  const [dmAllRows, setDmAllRows] = useState<string[][]>([]);

  const DISPOSAL_SYSTEM_FIELDS: SystemField[] = [
    { key: "itemName", label: "اسم الكتاب/المادة", required: true },
    { key: "pageNumber", label: "رقم صفحة السجل" },
    { key: "grade", label: "الصف" },
    { key: "editionDate", label: "تاريخ الطبعة" },
    { key: "quantityNum", label: "الكمية بالأرقام" },
    { key: "quantityWords", label: "الكمية بالحروف" },
    { key: "unitPrice", label: "السعر الافرادي" },
    { key: "totalPrice", label: "السعر الاجمالي" },
    { key: "entryDate", label: "تاريخ الادخال" },
    { key: "reason", label: "سبب الاتلاف" },
  ];

  useEffect(() => {
    setRecords(loadDisposals(userId));
    setQueuedInventoryCount(loadInventoryDisposalQueue(userId).length);
  }, [userId]);

  const parseDisposalCells = (cells: string[]): Omit<DisposalItem, "id" | "serialNumber"> | null => {
    const values = cells.map((cell) => cell.trim());
    if (values.every((value) => !value)) return null;

    const rowText = values.join(" ");
    if (
      rowText.includes("لجنة الإتلاف") ||
      rowText.includes("مدير المدرسة") ||
      rowText.includes("الاسم:") ||
      rowText.includes("التوقيع") ||
      rowText.includes("التاريخ") ||
      rowText.includes("سبب الاتلاف")
    ) {
      return null;
    }

    // Official format with split دينار/فلس (13 columns)
    if (values.length >= 13 && values[10]) {
      const totalPrice = toNumber(values[2]) + toNumber(values[3]) / 1000;
      const unitPrice = toNumber(values[4]) + toNumber(values[5]) / 1000;
      return {
        pageNumber: values[11] || "",
        itemName: values[10] || "",
        grade: values[9] || "",
        editionDate: values[8] || "",
        quantityNum: toNumber(values[7]) || 0,
        quantityWords: values[6] || "",
        unitPrice,
        totalPrice,
        entryDate: values[1] || "",
        reason: values[0] || "الغاء مادة",
      };
    }

    // Generic format (11 columns)
    if (values.length >= 11 && values[2]) {
      return {
        pageNumber: values[1] || "",
        itemName: values[2] || "",
        grade: values[3] || "",
        editionDate: values[4] || "",
        quantityNum: toNumber(values[5]) || 0,
        quantityWords: values[6] || "",
        unitPrice: toNumber(values[7]),
        totalPrice: toNumber(values[8]),
        entryDate: values[9] || "",
        reason: values[10] || "الغاء مادة",
      };
    }

    return null;
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        serialNumber: prev.length + 1,
        pageNumber: "",
        itemName: "",
        grade: "",
        editionDate: "",
        quantityNum: 1,
        quantityWords: "",
        unitPrice: 0,
        totalPrice: 0,
        entryDate: "",
        reason: "الغاء مادة",
      },
    ]);
  };

  const updateItem = (id: string, field: keyof DisposalItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "unitPrice" || field === "quantityNum") {
          updated.totalPrice = Number(updated.quantityNum) * Number(updated.unitPrice);
        }
        return updated;
      })
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id).map((item, idx) => ({ ...item, serialNumber: idx + 1 })));
  };

  /** Extract rows from Excel and show mapping dialog */
  const importDisposalExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("لا يوجد شيت في ملف Excel");

      const getCellText = (row: any, colIndex: number) => {
        const raw = row.getCell(colIndex).value as any;
        if (raw === null || raw === undefined) return "";
        if (typeof raw === "object" && raw.result !== undefined && raw.result !== null) return String(raw.result);
        if (typeof raw === "object" && raw.text !== undefined && raw.text !== null) return String(raw.text);
        return String(raw);
      };

      const allRows: string[][] = [];
      const colCount = sheet.columnCount || 15;
      sheet.eachRow((row) => {
        const cells = Array.from({ length: colCount }, (_, index) => getCellText(row, index + 1));
        if (cells.some(c => c)) allRows.push(cells);
      });

      if (allRows.length === 0) throw new Error("لم يتم العثور على بيانات");

      const headerRow = allRows[0];
      const dataRows = allRows.slice(1).filter(row => !row.every(c => !c));
      const maxCols = Math.max(headerRow.length, ...dataRows.map(r => r.length));
      const normalizedHeader = Array.from({ length: maxCols }, (_, i) => headerRow[i] || `عمود ${i + 1}`);
      const normalizedData = dataRows.map(row => Array.from({ length: maxCols }, (_, i) => row[i] || ""));

      setDmColumns(normalizedHeader);
      setDmPreview(normalizedData.slice(0, 3));
      setDmAllRows(normalizedData);
      setDmOpen(true);
    } catch (error) {
      toast({ title: "خطأ في قراءة الملف", description: String(error), variant: "destructive" });
    }

    if (disposalExcelInputRef.current) disposalExcelInputRef.current.value = "";
  };

  /** Extract rows from Word and show mapping dialog */
  const importDisposalWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = new PizZip(await file.arrayBuffer());
      const xml = zip.file("word/document.xml")?.asText();
      if (!xml) throw new Error("ملف Word غير صالح");

      const allRows: string[][] = [];
      const rowMatches = xml.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g) || [];

      for (const rowXml of rowMatches) {
        const cellMatches = rowXml.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];
        const cells = cellMatches.map((cellXml) => {
          const textParts = cellXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
          return textParts.map((part) => part.replace(/<[^>]*>/g, "")).join("").trim();
        });
        if (cells.some(c => c)) allRows.push(cells);
      }

      if (allRows.length === 0) throw new Error("لم يتم العثور على بيانات");

      const headerRow = allRows[0];
      const dataRows = allRows.slice(1).filter(row => !row.every(c => !c));
      const maxCols = Math.max(headerRow.length, ...dataRows.map(r => r.length));
      const normalizedHeader = Array.from({ length: maxCols }, (_, i) => headerRow[i] || `عمود ${i + 1}`);
      const normalizedData = dataRows.map(row => Array.from({ length: maxCols }, (_, i) => row[i] || ""));

      setDmColumns(normalizedHeader);
      setDmPreview(normalizedData.slice(0, 3));
      setDmAllRows(normalizedData);
      setDmOpen(true);
    } catch (error) {
      toast({ title: "خطأ في قراءة الملف", description: String(error), variant: "destructive" });
    }

    if (disposalWordInputRef.current) disposalWordInputRef.current.value = "";
  };

  /** Handle confirmed mapping from the dialog */
  const handleDisposalMappingConfirm = (result: ImportMappingResult) => {
    const { mapping } = result;
    const importedItems: DisposalItem[] = [];

    for (const row of dmAllRows) {
      const itemName = mapping.itemName !== undefined ? row[mapping.itemName]?.trim() : "";
      if (!itemName) continue;

      // Filter out header-like rows
      if (itemName.includes("لجنة") || itemName.includes("التوقيع") || itemName.includes("اسم الكتاب")) continue;

      importedItems.push({
        id: generateId(),
        serialNumber: importedItems.length + 1,
        pageNumber: mapping.pageNumber !== undefined ? row[mapping.pageNumber] || "" : "",
        itemName,
        grade: mapping.grade !== undefined ? row[mapping.grade] || "" : "",
        editionDate: mapping.editionDate !== undefined ? row[mapping.editionDate] || "" : "",
        quantityNum: mapping.quantityNum !== undefined ? toNumber(row[mapping.quantityNum]) : 1,
        quantityWords: mapping.quantityWords !== undefined ? row[mapping.quantityWords] || "" : "",
        unitPrice: mapping.unitPrice !== undefined ? toNumber(row[mapping.unitPrice]) : 0,
        totalPrice: mapping.totalPrice !== undefined ? toNumber(row[mapping.totalPrice]) : 0,
        entryDate: mapping.entryDate !== undefined ? row[mapping.entryDate] || "" : "",
        reason: mapping.reason !== undefined ? row[mapping.reason] || "الغاء مادة" : "الغاء مادة",
      });
    }

    if (importedItems.length === 0) {
      toast({ title: "لم يتم العثور على بيانات قابلة للاستيراد", variant: "destructive" });
      return;
    }

    // Recalculate totalPrice where needed
    const final = importedItems.map(item => ({
      ...item,
      totalPrice: item.totalPrice || (item.quantityNum * item.unitPrice),
    }));

    setItems(final);
    toast({ title: "تم الاستيراد", description: `تم استيراد ${final.length} مادة بنجاح` });
  };

  const deleteRecord = (recordId: string) => {
    if (!window.confirm("هل تريد شطب/حذف قائمة الإتلاف هذه؟")) return;
    const updated = records.filter((record) => record.id !== recordId);
    setRecords(updated);
    saveDisposals(userId, updated);
    toast({ title: "تم شطب قائمة الإتلاف" });
  };

  const loadRecordForEditing = (record: DisposalRecord) => {
    setItems(record.items.map((item, idx) => ({ ...item, id: generateId(), serialNumber: idx + 1 })));
    setEditingRecordId(record.id);
    setCommitteeMember3(record.committeeMember3 || "");
    const cat = INVENTORY_CATEGORIES.find(c => c.label === record.category);
    if (cat) setCategory(cat.id);
    toast({ title: "تم تحميل القائمة للتعديل" });
  };

  const saveDisposal = () => {
    if (items.length === 0) {
      toast({ title: "خطأ", description: "أضف مواد للإتلاف", variant: "destructive" });
      return;
    }

    // Only sync inventory for NEW items (not when editing existing record)
    if (!editingRecordId) {
      const syncedCategories = new Set<string>();
      items.forEach((item) => {
        if (!item.sourceCategoryId || !item.sourceItemId || !item.quantityNum) return;
        const categoryItems = loadInventory(userId, item.sourceCategoryId);
        const updatedItems = categoryItems.map((inventoryItem) => {
          if (inventoryItem.id !== item.sourceItemId) return inventoryItem;
          const disposalQty = Math.min(Math.max(Number(item.quantityNum) || 0, 0), Math.max(0, inventoryItem.existing));
          const nextExisting = Math.max(0, inventoryItem.existing - disposalQty);
          const nextActualBalance = Math.max(0, inventoryItem.actualBalance - disposalQty);
          const diff = nextExisting - nextActualBalance;
          return {
            ...inventoryItem,
            existing: nextExisting,
            actualBalance: nextActualBalance,
            shortage: diff < 0 ? Math.abs(diff) : 0,
            surplus: diff > 0 ? diff : 0,
            disposalQuantity: getInitialDisposalQuantity(nextExisting, diff < 0 ? Math.abs(diff) : 0, inventoryItem.disposalQuantity),
          };
        });
        saveInventory(userId, item.sourceCategoryId, updatedItems);
        syncedCategories.add(item.sourceCategoryId);
      });
    }

    if (editingRecordId) {
      // Update existing record
      const updated = records.map(r => r.id === editingRecordId ? {
        ...r,
        items: [...items],
        committeeMember3,
        category: INVENTORY_CATEGORIES.find((c) => c.id === category)?.label || category,
      } : r);
      setRecords(updated);
      saveDisposals(userId, updated);
      setEditingRecordId(null);
    } else {
      const record: DisposalRecord = {
        id: generateId(),
        date: format(new Date(), "yyyy/MM/dd"),
        category: INVENTORY_CATEGORIES.find((c) => c.id === category)?.label || category,
        items: [...items],
        committeeMember1: member1,
        committeeMember2: member2,
        committeeMember3,
        directorName,
      };
      const updated = [record, ...records];
      setRecords(updated);
      saveDisposals(userId, updated);
    }
    setItems([]);
    toast({ title: editingRecordId ? "تم تحديث قائمة الإتلاف" : "تم حفظ قائمة الإتلاف بنجاح" });
  };

  const importQueuedInventory = () => {
    const queued = loadInventoryDisposalQueue(userId);
    if (queued.length === 0) {
      toast({ title: "لا توجد مواد مرحّلة من الجرد", variant: "destructive" });
      return;
    }

    const mapped = queued.map((queuedItem, idx) => ({
      id: generateId(),
      serialNumber: items.length + idx + 1,
      pageNumber: "",
      itemName: queuedItem.itemName,
      grade: queuedItem.grade || "",
      editionDate: "",
      quantityNum: queuedItem.quantityNum || 1,
      quantityWords: "",
      unitPrice: queuedItem.unitPrice || 0,
      totalPrice: (queuedItem.quantityNum || 1) * (queuedItem.unitPrice || 0),
      entryDate: format(new Date(), "yyyy-MM-dd"),
      reason: "الغاء مادة",
      sourceCategoryId: queuedItem.sourceCategoryId,
      sourceItemId: queuedItem.sourceItemId,
    }));

    setItems((prev) => [...prev, ...mapped].map((item, index) => ({ ...item, serialNumber: index + 1 })));
    if (queued[0]?.sourceCategoryId) {
      setCategory(queued[0].sourceCategoryId);
    }
    saveInventoryDisposalQueue(userId, []);
    setQueuedInventoryCount(0);
    toast({ title: `تم استيراد ${mapped.length} مادة من الجرد` });
  };

  const handleExportDocx = async (record: DisposalRecord) => {
    const docxItems: DisposalDocxItem[] = record.items.map((item) => ({
      serialNumber: item.serialNumber,
      pageNumber: item.pageNumber,
      itemName: item.itemName,
      grade: item.grade,
      editionDate: item.editionDate,
      quantityNum: item.quantityNum,
      quantityWords: item.quantityWords,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      entryDate: item.entryDate,
      reason: item.reason,
    }));
    await exportDisposalDocx({
      school: schoolName,
      directorate: directorateName,
      categoryLabel: record.category,
      items: docxItems,
      directorName: record.directorName,
      committeeMember1: record.committeeMember1,
      committeeMember2: record.committeeMember2,
      committeeMember3: record.committeeMember3,
      date: record.date,
    });
    toast({ title: "تم تصدير قائمة الإتلاف (Word)" });
  };

  const exportDisposalExcel = async (record: DisposalRecord) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("قائمة إتلاف");
    ws.views = [{ rightToLeft: true }];

    ws.addRow([`${schoolName} - قائمة إتلاف - ${record.category}`]);
    ws.mergeCells(1, 1, 1, 11);
    ws.getRow(1).getCell(1).font = { name: FONT_NAME, bold: true, size: 16 };
    ws.getRow(1).getCell(1).alignment = { horizontal: "center" };
    ws.addRow([`التاريخ: ${record.date}`]);
    ws.addRow([]);

    const hRow = ws.addRow(["الرقم", "رقم صفحة السجل", "اسم الكتاب", "الصف", "تاريخ الطبعة", "الكمية بالأرقام", "الكمية بالحروف", "السعر الافرادي (دينار/فلس)", "السعر الاجمالي (دينار/فلس)", "تاريخ الادخال", "سبب الاتلاف"]);
    hRow.eachCell((c) => {
      c.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B0000" } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    record.items.forEach((item) => {
      const unitLabel = `${item.unitPrice.toFixed(3)} (${getCurrencyBreakdownLabel(item.unitPrice)})`;
      const totalLabel = `${item.totalPrice.toFixed(3)} (${getCurrencyBreakdownLabel(item.totalPrice)})`;
      const row = ws.addRow([
        item.serialNumber,
        item.pageNumber,
        item.itemName,
        item.grade,
        item.editionDate,
        item.quantityNum,
        item.quantityWords,
        unitLabel,
        totalLabel,
        item.entryDate,
        item.reason,
      ]);
      row.eachCell((c) => {
        c.font = { name: FONT_NAME, size: 12 };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
    });

    ws.addRow([]);
    ws.addRow([`لجنة الإتلاف:`]);
    ws.addRow([`مدير المدرسة: ${record.directorName}`]);
    ws.addRow([`عضو: ${record.committeeMember1}`]);
    ws.addRow([`عضو: ${record.committeeMember2}`]);
    ws.addRow([`عضو: ${record.committeeMember3}`]);

    ws.columns.forEach((col) => {
      col.width = 18;
    });
    ws.getColumn(3).width = 28;

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `قائمة_إتلاف_${record.category}_${record.date}.xlsx`);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-destructive" />
            إنشاء قائمة إتلاف جديدة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVENTORY_CATEGORIES.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عضو لجنة إضافي</Label>
              <Input value={committeeMember3} onChange={e => setCommitteeMember3(e.target.value)} placeholder="اسم العضو الثالث" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="font-bold">المواد المراد إتلافها</Label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => disposalExcelInputRef.current?.click()}>
                <FileUp className="w-4 h-4 ml-1" /> استيراد Excel
              </Button>
              <input
                ref={disposalExcelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={importDisposalExcel}
              />
              <Button size="sm" variant="outline" onClick={() => disposalWordInputRef.current?.click()}>
                <FileUp className="w-4 h-4 ml-1" /> استيراد Word
              </Button>
              <input
                ref={disposalWordInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={importDisposalWord}
              />
              <Button size="sm" variant="outline" onClick={importQueuedInventory} disabled={queuedInventoryCount === 0}>
                <ArrowRightLeft className="w-4 h-4 ml-1" />
                من الجرد ({queuedInventoryCount})
              </Button>
              <Button size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 ml-1" /> إضافة مادة
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[50px] text-center text-sm">م</TableHead>
                    <TableHead className="min-w-[100px] text-center text-sm">رقم الصفحة</TableHead>
                    <TableHead className="min-w-[220px] text-sm">اسم الكتاب/المادة</TableHead>
                    <TableHead className="min-w-[120px] text-sm">الصف</TableHead>
                    <TableHead className="min-w-[130px] text-center text-sm">تاريخ الطبعة</TableHead>
                    <TableHead className="min-w-[100px] text-center text-sm">الكمية</TableHead>
                    <TableHead className="min-w-[150px] text-sm">الكمية بالحروف</TableHead>
                    <TableHead className="min-w-[200px] text-center text-sm">السعر الافرادي</TableHead>
                    <TableHead className="min-w-[200px] text-center text-sm">السعر الاجمالي</TableHead>
                    <TableHead className="min-w-[130px] text-center text-sm">تاريخ الادخال</TableHead>
                    <TableHead className="min-w-[150px] text-sm">سبب الاتلاف</TableHead>
                    <TableHead className="min-w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => {
                    const unitSplit = splitToDinarFils(item.unitPrice);
                    const totalSplit = splitToDinarFils(item.totalPrice);
                    return (
                    <TableRow key={item.id}>
                      <TableCell className="text-center text-base font-semibold py-3">{item.serialNumber}</TableCell>
                      <TableCell>
                        <Input value={item.pageNumber} onChange={e => updateItem(item.id, "pageNumber", e.target.value)} className="h-11 text-center min-w-[80px] text-base" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.itemName} onChange={e => updateItem(item.id, "itemName", e.target.value)} className="h-11 min-w-[200px] text-base" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.grade} onChange={e => updateItem(item.id, "grade", e.target.value)} className="h-11 min-w-[100px] text-base" />
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={item.editionDate} onChange={e => updateItem(item.id, "editionDate", e.target.value)} className="h-11 text-center min-w-[120px] text-base" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} value={item.quantityNum} onChange={e => updateItem(item.id, "quantityNum", Number(e.target.value))} className="h-11 text-center min-w-[80px] text-base" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.quantityWords} onChange={e => updateItem(item.id, "quantityWords", e.target.value)} className="h-11 min-w-[130px] text-base" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step={0.001} value={item.unitPrice} onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value))} className="h-11 text-center min-w-[160px] text-base" placeholder="مثال: 12.500" />
                        <p className="text-sm text-muted-foreground text-center mt-1 whitespace-nowrap">
                          {item.unitPrice ? `${unitSplit.dinarText} دينار ${unitSplit.filsText} فلس` : "بالدينار.فلس"}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-bold text-base py-1">{item.totalPrice ? item.totalPrice.toFixed(3) : ""}</div>
                        <p className="text-sm text-muted-foreground whitespace-nowrap">{item.totalPrice ? `${totalSplit.dinarText} دينار ${totalSplit.filsText} فلس` : "تلقائي"}</p>
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={item.entryDate} onChange={e => updateItem(item.id, "entryDate", e.target.value)} className="h-11 text-center min-w-[120px] text-base" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.reason} onChange={e => updateItem(item.id, "reason", e.target.value)} className="h-11 min-w-[130px] text-base" />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeItem(item.id)} className="h-7 w-7 text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={saveDisposal} disabled={items.length === 0}>
              <Save className="w-4 h-4 ml-2" /> {editingRecordId ? "تحديث قائمة الإتلاف" : "حفظ قائمة الإتلاف"}
            </Button>
            {editingRecordId && (
              <Button variant="outline" onClick={() => { setItems([]); setEditingRecordId(null); }}>
                إلغاء التعديل
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Mapping Dialog */}
      <ImportMappingDialog
        open={dmOpen}
        onClose={() => setDmOpen(false)}
        onConfirm={handleDisposalMappingConfirm}
        fileColumns={dmColumns}
        previewRows={dmPreview}
        systemFields={DISPOSAL_SYSTEM_FIELDS}
        templateKey="disposal"
      />

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-5 h-5" />
            قوائم الإتلاف المحفوظة ({records.length})
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent className="space-y-3">
            {records.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">لا توجد قوائم محفوظة</p>
            ) : (
              records.map(record => (
                <div key={record.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{record.category} - {record.date}</p>
                    <p className="text-sm text-muted-foreground">{record.items.length} مادة</p>
                    <p className="text-xs text-muted-foreground">
                      اللجنة: {record.committeeMember1} ، {record.committeeMember2}
                      {record.committeeMember3 ? ` ، ${record.committeeMember3}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => loadRecordForEditing(record)}>
                      <RefreshCw className="w-4 h-4 ml-1" /> تعديل
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleExportDocx(record)}>
                      <FileText className="w-4 h-4 ml-1" /> Word
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportDisposalExcel(record)}>
                      <FileDown className="w-4 h-4 ml-1" /> Excel
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteRecord(record.id)}>
                      <Trash2 className="w-4 h-4 ml-1" /> شطب
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ─── Admin Forms Section ───
function AdminFormsSection({ schoolName, directorName }: { schoolName: string; directorName: string }) {
  const { toast } = useToast();

  // Interrogation form
  const [interEmployeeName, setInterEmployeeName] = useState("");
  const [interSubject, setInterSubject] = useState("");
  const [interDetails, setInterDetails] = useState("");
  const [interJobTitle, setInterJobTitle] = useState("");
  const [interCategory, setInterCategory] = useState("");

  // Casual leave
  const [leaveEmployeeName, setLeaveEmployeeName] = useState("");
  const [leaveEmployeeNumber, setLeaveEmployeeNumber] = useState("");
  const [leaveJobTitle, setLeaveJobTitle] = useState("");
  const [leaveDirectorate, setLeaveDirectorate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState<Date | undefined>();
  const [leaveEndDate, setLeaveEndDate] = useState<Date | undefined>();
  const [leaveDaysEntitled, setLeaveDaysEntitled] = useState("");
  const [leaveTotalThisYear, setLeaveTotalThisYear] = useState("");

  // Non-payment
  const [noPayName, setNoPayName] = useState("");
  const [noPayDate, setNoPayDate] = useState<Date | undefined>();
  const [noPayReason, setNoPayReason] = useState("");

  const handleInterrogation = async () => {
    if (!interEmployeeName.trim()) {
      toast({ title: "أدخل اسم الموظف", variant: "destructive" });
      return;
    }
    try {
      await fillInterrogationForm({
        school: schoolName,
        directorate: "",
        employeeName: interEmployeeName,
        category: interCategory,
        jobTitle: interJobTitle,
        previousPenalties: "",
        subject: interSubject,
        details: interDetails,
        directorName,
      });
      toast({ title: "تم تنزيل نموذج الاستجواب" });
    } catch (e) {
      toast({ title: "خطأ", description: String(e), variant: "destructive" });
    }
  };

  const handleCasualLeave = async () => {
    if (!leaveEmployeeName.trim()) {
      toast({ title: "أدخل اسم الموظف", variant: "destructive" });
      return;
    }
    try {
      await fillCasualLeaveForm({
        school: schoolName,
        directorate: leaveDirectorate,
        employeeName: leaveEmployeeName,
        employeeNumber: leaveEmployeeNumber,
        jobTitle: leaveJobTitle,
        section: "",
        department: schoolName,
        leaveReason: leaveReason,
        deathRelation: "",
        otherReasons: leaveReason,
        daysEntitled: leaveDaysEntitled,
        totalLeavesThisYear: leaveTotalThisYear,
        startDate: leaveStartDate ? format(leaveStartDate, "yyyy/MM/dd") : "",
        endDate: leaveEndDate ? format(leaveEndDate, "yyyy/MM/dd") : "",
        notes: "",
        directorName,
      });
      toast({ title: "تم تنزيل نموذج الإجازة العرضية" });
    } catch (e) {
      toast({ title: "خطأ", description: String(e), variant: "destructive" });
    }
  };

  const handleNoPayment = async () => {
    if (!noPayName.trim()) {
      toast({ title: "أدخل اسم الموظف", variant: "destructive" });
      return;
    }
    try {
      await fillNoPaymentForm({
        school: schoolName,
        directorate: "",
        employeeName: noPayName,
        date: noPayDate ? format(noPayDate, "yyyy/MM/dd") : "",
        refNumber: "",
        reason: noPayReason,
        daysAbsent: "",
        directorName,
      });
      toast({ title: "تم تنزيل نموذج عدم الصرف" });
    } catch (e) {
      toast({ title: "خطأ", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Interrogation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📋 نموذج استجواب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>اسم الموظف</Label>
              <Input value={interEmployeeName} onChange={e => setInterEmployeeName(e.target.value)} placeholder="الاسم الكامل من أربع مقاطع" />
            </div>
            <div className="space-y-1">
              <Label>الفئة / الدرجة</Label>
              <Input value={interCategory} onChange={e => setInterCategory(e.target.value)} placeholder="الفئة / الدرجة" />
            </div>
            <div className="space-y-1">
              <Label>الوظيفة</Label>
              <Input value={interJobTitle} onChange={e => setInterJobTitle(e.target.value)} placeholder="الوظيفة" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>الموضوع</Label>
            <Input value={interSubject} onChange={e => setInterSubject(e.target.value)} placeholder="موضوع الاستفسار" />
          </div>
          <div className="space-y-1">
            <Label>التفاصيل</Label>
            <Textarea value={interDetails} onChange={e => setInterDetails(e.target.value)} rows={3} placeholder="تفاصيل المخالفة" />
          </div>
          <Button onClick={handleInterrogation}><FileDown className="w-4 h-4 ml-2" /> تنزيل نموذج الاستجواب</Button>
        </CardContent>
      </Card>

      {/* Casual Leave */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🏖️ نموذج إجازة عرضية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>اسم الموظف</Label>
              <Input value={leaveEmployeeName} onChange={e => setLeaveEmployeeName(e.target.value)} placeholder="الاسم الكامل" />
            </div>
            <div className="space-y-1">
              <Label>الرقم الوزاري</Label>
              <Input value={leaveEmployeeNumber} onChange={e => setLeaveEmployeeNumber(e.target.value)} placeholder="الرقم الوزاري" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>المسمى الوظيفي</Label>
              <Input value={leaveJobTitle} onChange={e => setLeaveJobTitle(e.target.value)} placeholder="المسمى الوظيفي" />
            </div>
            <div className="space-y-1">
              <Label>المديرية</Label>
              <Input value={leaveDirectorate} onChange={e => setLeaveDirectorate(e.target.value)} placeholder="المديرية" />
            </div>
            <div className="space-y-1">
              <Label>سبب الإجازة</Label>
              <Input value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="سبب الإجازة" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>تاريخ ابتداء الإجازة</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-right h-9", !leaveStartDate && "text-muted-foreground")}>
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {leaveStartDate ? format(leaveStartDate, "yyyy/MM/dd") : "اختر التاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={leaveStartDate} onSelect={setLeaveStartDate} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>تاريخ انتهاء الإجازة</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-right h-9", !leaveEndDate && "text-muted-foreground")}>
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {leaveEndDate ? format(leaveEndDate, "yyyy/MM/dd") : "اختر التاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={leaveEndDate} onSelect={setLeaveEndDate} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>عدد الأيام المستحقة</Label>
              <Input value={leaveDaysEntitled} onChange={e => setLeaveDaysEntitled(e.target.value)} placeholder="عدد الأيام" />
            </div>
            <div className="space-y-1">
              <Label>مجموع الإجازات هذا العام</Label>
              <Input value={leaveTotalThisYear} onChange={e => setLeaveTotalThisYear(e.target.value)} placeholder="المجموع" />
            </div>
          </div>
          <Button onClick={handleCasualLeave}><FileDown className="w-4 h-4 ml-2" /> تنزيل نموذج الإجازة</Button>
        </CardContent>
      </Card>

      {/* Non-payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🚫 نموذج عدم صرف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>اسم الموظف</Label>
              <Input value={noPayName} onChange={e => setNoPayName(e.target.value)} placeholder="الاسم الكامل" />
            </div>
            <div className="space-y-1">
              <Label>التاريخ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-right h-9", !noPayDate && "text-muted-foreground")}>
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {noPayDate ? format(noPayDate, "yyyy/MM/dd") : "اختر التاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={noPayDate} onSelect={setNoPayDate} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>السبب</Label>
              <Input value={noPayReason} onChange={e => setNoPayReason(e.target.value)} placeholder="سبب التغيب" />
            </div>
          </div>
          <Button onClick={handleNoPayment}><FileDown className="w-4 h-4 ml-2" /> تنزيل نموذج عدم الصرف</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───
export default function SecretaryPage() {
  const { user, schoolName: authSchoolName } = useAuth();
  const { state } = useFinance();
  const userId = user?.id || "anonymous";
  const school = authSchoolName || state.schoolName || "المدرسة";
  const directorateName = state.directorateName || "";
  const directorName = state.directorName || "";
  const member1 = state.member1Name || "";
  const member2 = state.member2Name || "";

  const [mainTab, setMainTab] = useState("inventory");

  return (
    <AppLayout>
      <div className="space-y-6" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">السكرتير</h1>
          <p className="text-muted-foreground text-sm">إدارة الجرد والإتلاف والنماذج الإدارية</p>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inventory">📦 الجرد</TabsTrigger>
            <TabsTrigger value="disposal">🗑️ الإتلاف</TabsTrigger>
            <TabsTrigger value="forms">📄 النماذج</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="mt-4">
            <Tabs defaultValue={INVENTORY_CATEGORIES[0].id}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {INVENTORY_CATEGORIES.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} className="text-xs">
                    {c.icon} {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {INVENTORY_CATEGORIES.map((c) => (
                <TabsContent key={c.id} value={c.id} className="mt-4">
                  <InventoryTab
                    category={c}
                    userId={userId}
                    schoolName={school}
                    directorateName={directorateName}
                    directorName={directorName}
                    committeeMember={member1}
                    committeeMember2={member2}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="disposal" className="mt-4">
            <DisposalSection
              userId={userId}
              schoolName={school}
              directorateName={directorateName}
              directorName={directorName}
              member1={member1}
              member2={member2}
            />
          </TabsContent>

          <TabsContent value="forms" className="mt-4">
            <AdminFormsSection schoolName={school} directorName={directorName} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
