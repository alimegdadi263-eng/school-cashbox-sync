import { useState, useMemo } from "react";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CalendarIcon, FileDown, BarChart3 } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Transaction, ACCOUNT_COLUMNS, getAccountLabel } from "@/types/finance";

// ─── SDI Categories (5 مجالات) ───
const SDI_CATEGORIES = [
  { id: "learning", label: "مجتمعات التعلم وبناء القدرات لكادر المدرسة", minPct: 5, maxPct: 20 },
  { id: "maintenance", label: "الصيانة الخفيفة او الوقائية او التجميلية", minPct: 5, maxPct: 40 },
  { id: "community", label: "توطيد الشراكة مع المجتمع المحلي", minPct: 5, maxPct: 15 },
  { id: "remote", label: "لوازم التعلم عن بعد", minPct: 5, maxPct: 40 },
  { id: "excellence", label: "تشجيع التميز والإبداع للمعلم والطالب", minPct: 5, maxPct: 20 },
] as const;

type SdiCategoryId = typeof SDI_CATEGORIES[number]["id"];

interface SdiRow {
  txId: string;
  rowNum: number;
  refNumber: string;
  date: string;
  description: string;
  amount: number;
  category: SdiCategoryId;
}

const FONT_NAME = "Traditional Arabic";
const SDI_STORAGE_KEY = "sdi-analysis-data";

interface SdiSavedData {
  previousBalance: number;
  currentGrant: number;
  expectedPcts: Record<SdiCategoryId, number>;
  rows: { txId: string; category: SdiCategoryId }[];
}

function loadSdiData(userId: string): SdiSavedData | null {
  try {
    const data = localStorage.getItem(`${SDI_STORAGE_KEY}-${userId}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function saveSdiData(userId: string, data: SdiSavedData) {
  localStorage.setItem(`${SDI_STORAGE_KEY}-${userId}`, JSON.stringify(data));
}

export default function SdiAnalysis() {
  const { user, schoolName: authSchoolName } = useAuth();
  const { state } = useFinance();
  const { toast } = useToast();
  const userId = user?.id || "anonymous";
  const schoolName = authSchoolName || state.schoolName || "المدرسة";
  const directorateName = state.directorateName || "";

  // Load saved data
  const saved = useMemo(() => loadSdiData(userId), [userId]);

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [previousBalance, setPreviousBalance] = useState(saved?.previousBalance || 0);
  const [currentGrant, setCurrentGrant] = useState(saved?.currentGrant || 0);
  const totalBalance = previousBalance + currentGrant;

  // Expected percentages (user can customize)
  const [expectedPcts, setExpectedPcts] = useState<Record<SdiCategoryId, number>>(
    saved?.expectedPcts || {
      learning: 20,
      maintenance: 17,
      community: 15,
      remote: 30,
      excellence: 18,
    }
  );

  // Category assignments per transaction
  const [categoryAssignments, setCategoryAssignments] = useState<Record<string, SdiCategoryId>>(
    () => {
      const map: Record<string, SdiCategoryId> = {};
      saved?.rows?.forEach(r => { map[r.txId] = r.category; });
      return map;
    }
  );

  // Filter SDI transactions by date range
  const sdiTransactions = useMemo(() => {
    return state.transactions.filter(tx => {
      if (tx.status !== "active") return false;
      // Check if this transaction has SDI amounts (credit side = spending from SDI)
      const sdiAmount = tx.amounts?.sdi;
      if (!sdiAmount) return false;
      // SDI spending: debit (من) means money came from SDI
      const amount = sdiAmount.debit || 0;
      if (amount <= 0) return false;

      // Date filter
      if (startDate) {
        const txDate = new Date(tx.date);
        if (txDate < startDate) return false;
      }
      if (endDate) {
        const txDate = new Date(tx.date);
        if (txDate > endDate) return false;
      }
      return true;
    });
  }, [state.transactions, startDate, endDate]);

  // Build rows
  const rows: SdiRow[] = useMemo(() => {
    return sdiTransactions.map((tx, idx) => ({
      txId: tx.id,
      rowNum: idx + 1,
      refNumber: tx.referenceNumber || "",
      date: tx.date,
      description: tx.description,
      amount: tx.amounts.sdi?.debit || 0,
      category: categoryAssignments[tx.id] || "learning",
    }));
  }, [sdiTransactions, categoryAssignments]);

  // Calculate totals per category
  const categoryTotals = useMemo(() => {
    const totals: Record<SdiCategoryId, number> = { learning: 0, maintenance: 0, community: 0, remote: 0, excellence: 0 };
    rows.forEach(r => { totals[r.category] += r.amount; });
    return totals;
  }, [rows]);

  const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const remainingBalance = totalBalance - totalSpent;

  const updateCategory = (txId: string, cat: SdiCategoryId) => {
    setCategoryAssignments(prev => ({ ...prev, [txId]: cat }));
  };

  const updateExpectedPct = (catId: SdiCategoryId, val: number) => {
    setExpectedPcts(prev => ({ ...prev, [catId]: val }));
  };

  const totalExpectedPct = Object.values(expectedPcts).reduce((a, b) => a + b, 0);

  // Max allowed per category
  const maxAllowed = (catId: SdiCategoryId) => {
    const cat = SDI_CATEGORIES.find(c => c.id === catId)!;
    return (cat.maxPct / 100) * totalBalance;
  };

  // Save data
  const handleSave = () => {
    saveSdiData(userId, {
      previousBalance,
      currentGrant,
      expectedPcts,
      rows: rows.map(r => ({ txId: r.txId, category: r.category })),
    });
    toast({ title: "تم حفظ بيانات التحليل" });
  };

  // Export Excel matching template
  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("تحليل منحة المدرسة");
    ws.views = [{ rightToLeft: true }];

    const border: Partial<ExcelJS.Borders> = {
      top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
    };
    const headerFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
    const headerFont: Partial<ExcelJS.Font> = { name: FONT_NAME, bold: true, size: 12 };
    const dataFont: Partial<ExcelJS.Font> = { name: FONT_NAME, size: 12 };
    const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };

    // Title
    ws.mergeCells("A1:O1");
    ws.getCell("A1").value = "وزارة التربية والتعليم";
    ws.getCell("A1").font = { name: FONT_NAME, bold: true, size: 16 };
    ws.getCell("A1").alignment = centerAlign;

    ws.mergeCells("A2:O2");
    ws.getCell("A2").value = "خلاصة تحليل أوجه صرف منح المدرسة / برنامج تطوير المدرسة والمديرية للعام";
    ws.getCell("A2").font = { name: FONT_NAME, bold: true, size: 14 };
    ws.getCell("A2").alignment = centerAlign;

    // School & Directorate
    ws.mergeCells("A4:C4");
    ws.getCell("A4").value = `المديرية : ${directorateName}`;
    ws.getCell("A4").font = headerFont;
    ws.getCell("A4").alignment = { horizontal: "right", vertical: "middle" };

    ws.mergeCells("D4:G4");
    ws.getCell("D4").value = `المدرسة : ${schoolName}`;
    ws.getCell("D4").font = headerFont;
    ws.getCell("D4").alignment = { horizontal: "right", vertical: "middle" };

    // Balances row
    const balRow = 6;
    ws.getCell(`A${balRow}`).value = "الرصيد السّابق (المدور) للمدرسة";
    ws.getCell(`A${balRow}`).font = headerFont;
    ws.getCell(`B${balRow}`).value = previousBalance;
    ws.getCell(`B${balRow}`).font = dataFont;
    ws.getCell(`B${balRow}`).numFmt = '#,##0.000';

    ws.getCell(`C${balRow}`).value = "المنحة للسنة الحالية للمدرسة";
    ws.getCell(`C${balRow}`).font = headerFont;
    ws.getCell(`D${balRow}`).value = currentGrant;
    ws.getCell(`D${balRow}`).font = dataFont;
    ws.getCell(`D${balRow}`).numFmt = '#,##0.000';

    ws.getCell(`E${balRow}`).value = "الرصيد الكلي للمدرسة";
    ws.getCell(`E${balRow}`).font = headerFont;
    ws.getCell(`F${balRow}`).value = totalBalance;
    ws.getCell(`F${balRow}`).font = { ...dataFont, bold: true };
    ws.getCell(`F${balRow}`).numFmt = '#,##0.000';

    // Categories summary table
    const sumStart = 8;
    const catLabels = SDI_CATEGORIES.map(c => c.label);
    
    // Row: المجال
    ws.getCell(`A${sumStart}`).value = "المجال";
    ws.getCell(`A${sumStart}`).font = headerFont;
    ws.getCell(`A${sumStart}`).fill = headerFill;
    ws.getCell(`A${sumStart}`).border = border;
    SDI_CATEGORIES.forEach((cat, i) => {
      const cell = ws.getCell(sumStart, i + 2);
      cell.value = cat.label;
      cell.font = { name: FONT_NAME, bold: true, size: 10 };
      cell.fill = headerFill;
      cell.border = border;
      cell.alignment = { ...centerAlign, wrapText: true };
    });

    // Row: النسبة المسموحة
    ws.getCell(`A${sumStart + 1}`).value = "النسبة المسموحة";
    ws.getCell(`A${sumStart + 1}`).font = headerFont;
    ws.getCell(`A${sumStart + 1}`).border = border;
    SDI_CATEGORIES.forEach((cat, i) => {
      const cell = ws.getCell(sumStart + 1, i + 2);
      cell.value = `من ${cat.minPct}% - ${cat.maxPct}%`;
      cell.font = dataFont;
      cell.border = border;
      cell.alignment = centerAlign;
    });

    // Row: الحد الاعلى للصرف
    ws.getCell(`A${sumStart + 2}`).value = "يسمح بالصرف لغاية (الحد الاعلى للصرف)";
    ws.getCell(`A${sumStart + 2}`).font = headerFont;
    ws.getCell(`A${sumStart + 2}`).border = border;
    SDI_CATEGORIES.forEach((cat, i) => {
      const cell = ws.getCell(sumStart + 2, i + 2);
      cell.value = maxAllowed(cat.id);
      cell.font = dataFont;
      cell.border = border;
      cell.alignment = centerAlign;
      cell.numFmt = '#,##0.000';
    });

    // Row: نسبة الصرف المتوقعة
    ws.getCell(`A${sumStart + 3}`).value = "نسبة الصرف المتوقعة";
    ws.getCell(`A${sumStart + 3}`).font = headerFont;
    ws.getCell(`A${sumStart + 3}`).border = border;
    SDI_CATEGORIES.forEach((cat, i) => {
      const cell = ws.getCell(sumStart + 3, i + 2);
      cell.value = `${expectedPcts[cat.id]}%`;
      cell.font = dataFont;
      cell.border = border;
      cell.alignment = centerAlign;
    });
    // Total expected
    ws.getCell(sumStart + 3, 7).value = `مجموع النسب = ${totalExpectedPct}%`;
    ws.getCell(sumStart + 3, 7).font = dataFont;

    // Row: مبلغ الصرف المتوقع
    ws.getCell(`A${sumStart + 4}`).value = "مبلغ الصرف المتوقع";
    ws.getCell(`A${sumStart + 4}`).font = headerFont;
    ws.getCell(`A${sumStart + 4}`).border = border;
    SDI_CATEGORIES.forEach((cat, i) => {
      const cell = ws.getCell(sumStart + 4, i + 2);
      cell.value = (expectedPcts[cat.id] / 100) * totalBalance;
      cell.font = dataFont;
      cell.border = border;
      cell.alignment = centerAlign;
      cell.numFmt = '#,##0.000';
    });
    ws.getCell(sumStart + 4, 7).value = (totalExpectedPct / 100) * totalBalance;
    ws.getCell(sumStart + 4, 7).font = dataFont;
    ws.getCell(sumStart + 4, 7).numFmt = '#,##0.000';

    // Row: المبلغ الذي صرفته
    ws.getCell(`A${sumStart + 5}`).value = "المبلغ الذي صرفته";
    ws.getCell(`A${sumStart + 5}`).font = headerFont;
    ws.getCell(`A${sumStart + 5}`).border = border;
    SDI_CATEGORIES.forEach((cat, i) => {
      const cell = ws.getCell(sumStart + 5, i + 2);
      cell.value = categoryTotals[cat.id];
      cell.font = dataFont;
      cell.border = border;
      cell.alignment = centerAlign;
      cell.numFmt = '#,##0.000';
    });
    ws.getCell(sumStart + 5, 7).value = totalSpent;
    ws.getCell(sumStart + 5, 7).font = { ...dataFont, bold: true };
    ws.getCell(sumStart + 5, 7).numFmt = '#,##0.000';

    // Row: النسبة المئوية للصرف
    ws.getCell(`A${sumStart + 6}`).value = "النسبة المئوية للصرف";
    ws.getCell(`A${sumStart + 6}`).font = headerFont;
    ws.getCell(`A${sumStart + 6}`).border = border;
    SDI_CATEGORIES.forEach((cat, i) => {
      const cell = ws.getCell(sumStart + 6, i + 2);
      const pct = totalBalance > 0 ? (categoryTotals[cat.id] / totalBalance) * 100 : 0;
      cell.value = `${pct.toFixed(2)}%`;
      cell.font = dataFont;
      cell.border = border;
      cell.alignment = centerAlign;
      // Color coding
      if (pct > cat.maxPct) cell.font = { ...dataFont, color: { argb: "FFFF0000" } };
      else if (pct < cat.minPct && categoryTotals[cat.id] > 0) cell.font = { ...dataFont, color: { argb: "FF0000FF" } };
    });
    const totalPct = totalBalance > 0 ? (totalSpent / totalBalance) * 100 : 0;
    ws.getCell(sumStart + 6, 7).value = `${totalPct.toFixed(2)}%`;
    ws.getCell(sumStart + 6, 7).font = { ...dataFont, bold: true };

    // Remaining balance
    ws.getCell(`A${sumStart + 8}`).value = "الرصيد المتبقي =";
    ws.getCell(`A${sumStart + 8}`).font = { ...headerFont, size: 14 };
    ws.getCell(`B${sumStart + 8}`).value = remainingBalance;
    ws.getCell(`B${sumStart + 8}`).font = { ...dataFont, bold: true, size: 14 };
    ws.getCell(`B${sumStart + 8}`).numFmt = '#,##0.000';

    // Detail table
    const detailStart = sumStart + 11;
    const detailHeaders = [
      "الرقم", "رقم الفاتورة أو المستند", "التاريخ",
      ...SDI_CATEGORIES.map(c => c.label),
      "نفقات السنة", "الرصيد المتبقي",
    ];

    const hRow = ws.getRow(detailStart);
    detailHeaders.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: FONT_NAME, bold: true, size: 10 };
      cell.fill = headerFill;
      cell.border = border;
      cell.alignment = { ...centerAlign, wrapText: true };
    });
    hRow.height = 40;

    let runningBalance = totalBalance;
    rows.forEach((row, idx) => {
      const r = ws.getRow(detailStart + 1 + idx);
      r.getCell(1).value = row.rowNum;
      r.getCell(2).value = row.refNumber;
      r.getCell(3).value = row.date;

      // Distribute amount to correct category column
      SDI_CATEGORIES.forEach((cat, ci) => {
        const cell = r.getCell(4 + ci);
        cell.value = row.category === cat.id ? row.amount : "";
        if (row.category === cat.id) cell.numFmt = '#,##0.000';
      });

      r.getCell(9).value = row.amount;
      r.getCell(9).numFmt = '#,##0.000';

      runningBalance -= row.amount;
      r.getCell(10).value = runningBalance;
      r.getCell(10).numFmt = '#,##0.000';

      // Style
      for (let ci = 1; ci <= 10; ci++) {
        const cell = r.getCell(ci);
        cell.font = dataFont;
        cell.border = border;
        cell.alignment = centerAlign;
      }
    });

    // Set column widths
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 18;
    ws.getColumn(3).width = 18;
    for (let i = 4; i <= 8; i++) ws.getColumn(i).width = 16;
    ws.getColumn(9).width = 14;
    ws.getColumn(10).width = 14;

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `تحليل_منحة_SDI_${schoolName}.xlsx`);
    toast({ title: "تم تصدير تحليل المنحة بنجاح" });
  };

  return (
    <AppLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">تحليل منحة SDI</h1>
            <p className="text-muted-foreground text-sm">تحليل أوجه صرف منح المدرسة - برنامج تطوير المدرسة والمديرية</p>
          </div>
        </div>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">إعدادات التحليل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-right h-9", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {startDate ? format(startDate, "yyyy/MM/dd") : "اختر التاريخ"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>تاريخ النهاية</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-right h-9", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {endDate ? format(endDate, "yyyy/MM/dd") : "اختر التاريخ"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>الرصيد السابق (المدور)</Label>
                <Input type="number" step="0.001" value={previousBalance} onChange={e => setPreviousBalance(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>المنحة للسنة الحالية</Label>
                <Input type="number" step="0.001" value={currentGrant} onChange={e => setCurrentGrant(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">المدرسة: <strong>{schoolName}</strong></span>
              <span className="text-sm font-medium">المديرية: <strong>{directorateName || "—"}</strong></span>
              <span className="text-sm font-medium">الرصيد الكلي: <strong className="text-primary">{totalBalance.toFixed(3)} د.أ</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Expected Percentages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">النسب المتوقعة للصرف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {SDI_CATEGORIES.map(cat => (
                <div key={cat.id} className="space-y-1">
                  <Label className="text-xs">{cat.label}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={0} max={100} step={1}
                      value={expectedPcts[cat.id]}
                      onChange={e => updateExpectedPct(cat.id, Number(e.target.value))}
                      className="h-8 text-center"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">المسموح: {cat.minPct}% - {cat.maxPct}%</p>
                </div>
              ))}
            </div>
            {totalExpectedPct !== 100 && (
              <p className="text-destructive text-sm mt-2">⚠️ مجموع النسب = {totalExpectedPct}% (يجب أن يكون 100%)</p>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ملخص التوزيع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">المجال</TableHead>
                    <TableHead className="text-center">النسبة المسموحة</TableHead>
                    <TableHead className="text-center">الحد الأعلى للصرف</TableHead>
                    <TableHead className="text-center">المبلغ المصروف</TableHead>
                    <TableHead className="text-center">النسبة المئوية</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SDI_CATEGORIES.map(cat => {
                    const spent = categoryTotals[cat.id];
                    const pct = totalBalance > 0 ? (spent / totalBalance) * 100 : 0;
                    const over = pct > cat.maxPct;
                    const under = pct < cat.minPct && spent > 0;
                    return (
                      <TableRow key={cat.id}>
                        <TableCell className="text-sm">{cat.label}</TableCell>
                        <TableCell className="text-center">{cat.minPct}% - {cat.maxPct}%</TableCell>
                        <TableCell className="text-center">{maxAllowed(cat.id).toFixed(3)}</TableCell>
                        <TableCell className="text-center font-medium">{spent.toFixed(3)}</TableCell>
                        <TableCell className={cn("text-center font-bold", over && "text-destructive", under && "text-blue-500")}>
                          {pct.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-center">
                          {over ? <span className="text-destructive text-xs">تجاوز</span> :
                           under ? <span className="text-blue-500 text-xs">أقل من الحد</span> :
                           spent > 0 ? <span className="text-green-600 text-xs">ضمن المسموح</span> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>المجموع</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">{totalBalance.toFixed(3)}</TableCell>
                    <TableCell className="text-center">{totalSpent.toFixed(3)}</TableCell>
                    <TableCell className="text-center">{totalBalance > 0 ? ((totalSpent / totalBalance) * 100).toFixed(2) : 0}%</TableCell>
                    <TableCell className="text-center">الرصيد المتبقي: {remainingBalance.toFixed(3)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Detail */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>حركات الصرف من SDI ({rows.length} حركة)</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>حفظ التعديلات</Button>
                <Button size="sm" variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
                  <FileDown className="w-4 h-4 ml-1" /> تصدير Excel
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>لا توجد حركات صرف من SDI في الفترة المحددة</p>
                <p className="text-xs mt-1">أضف حركات صرف من حساب SDI في صفحة إضافة الحركات</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">م</TableHead>
                      <TableHead className="w-24 text-center">رقم المستند</TableHead>
                      <TableHead className="w-24 text-center">التاريخ</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead className="w-24 text-center">المبلغ</TableHead>
                      <TableHead className="w-48 text-center">المجال</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(row => (
                      <TableRow key={row.txId}>
                        <TableCell className="text-center">{row.rowNum}</TableCell>
                        <TableCell className="text-center">{row.refNumber}</TableCell>
                        <TableCell className="text-center">{row.date}</TableCell>
                        <TableCell className="text-sm">{row.description}</TableCell>
                        <TableCell className="text-center font-medium">{row.amount.toFixed(3)}</TableCell>
                        <TableCell>
                          <Select value={row.category} onValueChange={(val) => updateCategory(row.txId, val as SdiCategoryId)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SDI_CATEGORIES.map(cat => (
                                <SelectItem key={cat.id} value={cat.id} className="text-xs">{cat.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="bg-muted/30">
          <CardContent className="pt-4 text-sm space-y-1 text-muted-foreground">
            <p>📌 <strong>ملاحظة:</strong> اذا ظهرت النسبة باللون الأحمر فهذا يدل على تجاوز النسبة المسموحة</p>
            <p>📌 اذا ظهرت النسبة باللون الأزرق فهذا يدل على عدم الوصول للحد الأدنى المسموح</p>
            <p>📌 يرسل مدير المدرسة التحليل المالي للمنحة نهاية العام الدراسي للمديرية</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
