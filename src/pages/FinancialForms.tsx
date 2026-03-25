import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { FileDown, FileText, ClipboardList, ShoppingCart, CalendarIcon, Plus, Trash2, Save, History, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fillFinancialClaim,
  fillAssignmentDecision,
  type PurchaseItem,
} from "@/lib/fillFinancialForms";
import { generateLocalPurchaseDocx } from "@/lib/generateLocalPurchaseDocx";
import { generateAdvanceInvoicesDocx, type AdvanceInvoice } from "@/lib/generateAdvanceInvoicesDocx";


type FormType = "claim" | "assignment" | "purchase" | "invoices";

const FORM_TYPES: { id: FormType; label: string; icon: typeof FileText; color: string }[] = [
  { id: "claim", label: "مطالبة مالية", icon: FileText, color: "border-emerald-500 bg-emerald-500/10 text-emerald-600" },
  { id: "assignment", label: "قرار تكليف", icon: ClipboardList, color: "border-blue-500 bg-blue-500/10 text-blue-600" },
  { id: "purchase", label: "طلب مشترى محلي", icon: ShoppingCart, color: "border-orange-500 bg-orange-500/10 text-orange-600" },
  { id: "invoices", label: "كشف فواتير السلفة", icon: Receipt, color: "border-purple-500 bg-purple-500/10 text-purple-600" },
];

interface SavedPurchaseOrder {
  id: string;
  date: string;
  supplierName: string;
  supplierAddress: string;
  items: PurchaseItem[];
}

const PURCHASE_STORAGE_KEY = "school-purchase-orders";

function loadPurchaseOrders(userId: string): SavedPurchaseOrder[] {
  try {
    const saved = localStorage.getItem(`${PURCHASE_STORAGE_KEY}-${userId}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function savePurchaseOrders(userId: string, orders: SavedPurchaseOrder[]) {
  localStorage.setItem(`${PURCHASE_STORAGE_KEY}-${userId}`, JSON.stringify(orders));
}

export default function FinancialForms() {
  const { state } = useFinance();
  const { user } = useAuth();
  const userId = user?.id || "anonymous";
  const { toast } = useToast();
  const [formType, setFormType] = useState<FormType>("claim");
  const [savedOrders, setSavedOrders] = useState<SavedPurchaseOrder[]>([]);
  const [showSavedOrders, setShowSavedOrders] = useState(false);

  useEffect(() => {
    setSavedOrders(loadPurchaseOrders(userId));
  }, [userId]);

  // Financial Claim state
  const [claimAmount, setClaimAmount] = useState<number>(0);
  const [claimRecipient, setClaimRecipient] = useState("");
  const [claimCheck, setClaimCheck] = useState("");
  const [claimDescription, setClaimDescription] = useState("");

  // Assignment Decision state
  const [assignDay, setAssignDay] = useState("");
  const [assignDate, setAssignDate] = useState<Date | undefined>(undefined);
  const [assignSubject, setAssignSubject] = useState("");
  const [assignPerson, setAssignPerson] = useState("");
  const [assignDescription, setAssignDescription] = useState("");

  // Advance Invoices state
  const INVOICES_STORAGE_KEY = "school-advance-invoices";
  const [invoiceListNumber, setInvoiceListNumber] = useState("");
  const [invoiceListDate, setInvoiceListDate] = useState(new Date().toISOString().split("T")[0]);
  const emptyInvoice = (): AdvanceInvoice => ({
    invoiceNumber: "",
    invoiceDate: "",
    description: "",
    amountDinars: "",
    amountFils: "",
    notes: "",
  });
  const [invoices, setInvoices] = useState<AdvanceInvoice[]>([emptyInvoice()]);
  const [savedInvoiceLists, setSavedInvoiceLists] = useState<{ id: string; date: string; listNumber: string; invoices: AdvanceInvoice[] }[]>([]);
  const [showSavedInvoices, setShowSavedInvoices] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${INVOICES_STORAGE_KEY}-${userId}`);
      if (saved) setSavedInvoiceLists(JSON.parse(saved));
    } catch {}
  }, [userId]);

  const invoicesTotal = invoices.reduce((sum, inv) => {
    const d = parseInt(inv.amountDinars) || 0;
    const f = parseInt(inv.amountFils) || 0;
    return sum + d + f / 1000;
  }, 0);

  const updateInvoice = (idx: number, field: keyof AdvanceInvoice, value: string) => {
    setInvoices(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const addInvoice = () => setInvoices(prev => [...prev, emptyInvoice()]);

  const removeInvoice = (idx: number) => {
    if (invoices.length <= 1) return;
    setInvoices(prev => prev.filter((_, i) => i !== idx));
  };

  const saveInvoiceList = () => {
    const list = { id: Date.now().toString(), date: invoiceListDate, listNumber: invoiceListNumber, invoices };
    const updated = [list, ...savedInvoiceLists];
    setSavedInvoiceLists(updated);
    localStorage.setItem(`${INVOICES_STORAGE_KEY}-${userId}`, JSON.stringify(updated));
    toast({ title: "تم الحفظ", description: "تم حفظ كشف الفواتير بنجاح" });
  };

  const deleteInvoiceList = (id: string) => {
    const updated = savedInvoiceLists.filter(l => l.id !== id);
    setSavedInvoiceLists(updated);
    localStorage.setItem(`${INVOICES_STORAGE_KEY}-${userId}`, JSON.stringify(updated));
  };

  const loadInvoiceList = (list: typeof savedInvoiceLists[0]) => {
    setInvoiceListNumber(list.listNumber);
    setInvoiceListDate(list.date);
    setInvoices(list.invoices);
    setShowSavedInvoices(false);
  };

  const handleInvoicesExport = async () => {
    const validInvoices = invoices.filter(inv => inv.description.trim() || inv.amountDinars || inv.amountFils);
    if (validInvoices.length === 0) {
      toast({ title: "خطأ", description: "يرجى إدخال فاتورة واحدة على الأقل", variant: "destructive" });
      return;
    }
    try {
      await generateAdvanceInvoicesDocx({
        school: state.schoolName,
        listNumber: invoiceListNumber,
        listDate: invoiceListDate,
        invoices: validInvoices,
      });
      saveInvoiceList();
      toast({ title: "تم التنزيل", description: "تم تنزيل كشف فواتير السلفة بنجاح" });
    } catch (error) {
      toast({ title: "فشل التصدير", description: error instanceof Error ? error.message : "حدث خطأ", variant: "destructive" });
    }
  };

  // Local Purchase state
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseAddress, setPurchaseAddress] = useState("");
  const emptyItem = (): PurchaseItem => ({
    itemNumber: 1,
    itemDescription: "",
    quantity: "",
    unitPriceDinars: "",
    unitPriceFils: "",
    totalPriceDinars: "",
    totalPriceFils: "",
    chapterAndSubject: "",
    notes: "",
  });
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([emptyItem()]);

  const updateItem = (index: number, field: keyof PurchaseItem, value: string) => {
    setPurchaseItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calculate total = quantity * unit price
      if (field === "quantity" || field === "unitPriceDinars" || field === "unitPriceFils") {
        const qty = parseFloat(updated[index].quantity) || 0;
        const unitDinars = parseInt(updated[index].unitPriceDinars) || 0;
        const unitFils = parseInt(updated[index].unitPriceFils) || 0;
        const totalMils = (unitDinars * 1000 + unitFils) * qty;
        updated[index].totalPriceDinars = String(Math.floor(totalMils / 1000));
        updated[index].totalPriceFils = String(totalMils % 1000);
      }
      return updated;
    });
  };

  const addItem = () => {
    setPurchaseItems((prev) => [...prev, { ...emptyItem(), itemNumber: prev.length + 1 }]);
  };

  const removeItem = (index: number) => {
    if (purchaseItems.length <= 1) return;
    setPurchaseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const getExportErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "حدث خطأ أثناء التصدير";

  const handleClaimSubmit = async () => {
    if (claimAmount <= 0) {
      toast({ title: "خطأ", description: "يرجى إدخال المبلغ", variant: "destructive" });
      return;
    }

    try {
      await fillFinancialClaim({
        school: state.schoolName,
        amount: claimAmount,
        recipientName: claimRecipient,
        checkNumber: claimCheck,
        description: claimDescription,
        directorName: state.directorName || "",
        member1Name: state.member1Name || "",
        member2Name: state.member2Name || "",
      });
      toast({ title: "تم التنزيل", description: "تم تنزيل المطالبة المالية بنجاح" });
    } catch (error) {
      toast({ title: "فشل التصدير", description: getExportErrorMessage(error), variant: "destructive" });
    }
  };

  const handleAssignmentSubmit = async () => {
    if (!assignPerson.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم الشخص", variant: "destructive" });
      return;
    }

    try {
      await fillAssignmentDecision({
        school: state.schoolName,
        day: assignDay,
        date: assignDate ? format(assignDate, "yyyy/M/d") : "",
        subject: assignSubject,
        personName: assignPerson,
        description: assignDescription,
        directorName: state.directorName || "",
      });
      toast({ title: "تم التنزيل", description: "تم تنزيل قرار التكليف بنجاح" });
    } catch (error) {
      toast({ title: "فشل التصدير", description: getExportErrorMessage(error), variant: "destructive" });
    }
  };

  const savePurchaseOrder = () => {
    if (!purchaseSupplier.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم المورد", variant: "destructive" });
      return;
    }
    const order: SavedPurchaseOrder = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("ar"),
      supplierName: purchaseSupplier,
      supplierAddress: purchaseAddress,
      items: purchaseItems,
    };
    const updated = [order, ...savedOrders];
    setSavedOrders(updated);
    savePurchaseOrders(userId, updated);
    toast({ title: "تم الحفظ", description: "تم حفظ طلب المشترى المحلي بنجاح" });
  };

  const deleteSavedOrder = (id: string) => {
    const updated = savedOrders.filter((o) => o.id !== id);
    setSavedOrders(updated);
    savePurchaseOrders(userId, updated);
    toast({ title: "تم الحذف", description: "تم حذف الطلب المحفوظ" });
  };

  const loadSavedOrder = (order: SavedPurchaseOrder) => {
    setPurchaseSupplier(order.supplierName);
    setPurchaseAddress(order.supplierAddress);
    setPurchaseItems(order.items);
    setShowSavedOrders(false);
    toast({ title: "تم التحميل", description: "تم تحميل الطلب المحفوظ" });
  };

  const handlePurchaseSubmit = async () => {
    if (!purchaseSupplier.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم المورد", variant: "destructive" });
      return;
    }

    try {
      await generateLocalPurchaseDocx({
        school: state.schoolName,
        supplierName: purchaseSupplier,
        supplierAddress: purchaseAddress,
        items: purchaseItems,
      });
      // Auto-save on export
      savePurchaseOrder();
      toast({ title: "تم التنزيل", description: "تم تنزيل طلب المشترى المحلي بنجاح" });
    } catch (error) {
      toast({ title: "فشل التصدير", description: getExportErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground">المعاملات المالية</h1>

        {/* Form Type Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FORM_TYPES.map((ft) => (
            <button
              key={ft.id}
              onClick={() => setFormType(ft.id)}
              className={`py-4 px-4 rounded-lg text-sm font-semibold transition-all duration-200 border-2 flex flex-col items-center gap-2 ${
                formType === ft.id
                  ? ft.color
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
              }`}
            >
              <ft.icon className="w-6 h-6" />
              {ft.label}
            </button>
          ))}
        </div>

        {/* Financial Claim Form */}
        {formType === "claim" && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                مطالبة مالية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المبلغ (دينار)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={claimAmount || ""}
                    onChange={(e) => setClaimAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.000"
                    className="text-lg font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم المستلم</Label>
                  <Input
                    value={claimRecipient}
                    onChange={(e) => setClaimRecipient(e.target.value)}
                    placeholder="اسم الشخص المستلم"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم الشيك (اختياري)</Label>
                  <Input
                    value={claimCheck}
                    onChange={(e) => setClaimCheck(e.target.value)}
                    placeholder="رقم الشيك إن وجد"
                  />
                </div>
                <div className="space-y-2">
                  <Label>المدرسة</Label>
                  <Input value={state.schoolName} disabled className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>وصف الأعمال</Label>
                <Textarea
                  value={claimDescription}
                  onChange={(e) => setClaimDescription(e.target.value)}
                  placeholder="وذلك لقاء تكليفي بالأعمال التالية..."
                  rows={3}
                />
              </div>
              <Button onClick={handleClaimSubmit} className="gradient-accent text-accent-foreground gap-2">
                <FileDown className="w-4 h-4" />
                تنزيل المطالبة المالية
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Assignment Decision Form */}
        {formType === "assignment" && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-500" />
                قرار تكليف
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اليوم</Label>
                  <Input
                    value={assignDay}
                    onChange={(e) => setAssignDay(e.target.value)}
                    placeholder="مثال: الأحد"
                  />
                </div>
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-right font-normal",
                          !assignDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {assignDate ? format(assignDate, "yyyy/M/d") : "اختر التاريخ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={assignDate}
                        onSelect={setAssignDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الموضوع</Label>
                  <Input
                    value={assignSubject}
                    onChange={(e) => setAssignSubject(e.target.value)}
                    placeholder="موضوع التكليف"
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم الشخص المكلف</Label>
                  <Input
                    value={assignPerson}
                    onChange={(e) => setAssignPerson(e.target.value)}
                    placeholder="السيد/ة ..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>تفاصيل التكليف</Label>
                <Textarea
                  value={assignDescription}
                  onChange={(e) => setAssignDescription(e.target.value)}
                  placeholder="قررت تكليفك بالأعمال التالية..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>المدرسة</Label>
                <Input value={state.schoolName} disabled className="bg-muted" />
              </div>
              <Button onClick={handleAssignmentSubmit} className="gradient-accent text-accent-foreground gap-2">
                <FileDown className="w-4 h-4" />
                تنزيل قرار التكليف
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Local Purchase Form */}
        {formType === "purchase" && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-500" />
                طلب مشترى محلي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المورد</Label>
                  <Input
                    value={purchaseSupplier}
                    onChange={(e) => setPurchaseSupplier(e.target.value)}
                    placeholder="اسم المحل أو المورد"
                  />
                </div>
                <div className="space-y-2">
                  <Label>عنوان المورد</Label>
                  <Input
                    value={purchaseAddress}
                    onChange={(e) => setPurchaseAddress(e.target.value)}
                    placeholder="عنوان المورد"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>المدرسة</Label>
                <Input value={state.schoolName} disabled className="bg-muted" />
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">المواد المطلوبة</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                    <Plus className="w-4 h-4" />
                    إضافة مادة
                  </Button>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="p-2 text-center w-12">م</th>
                        <th className="p-2 text-right min-w-[160px]">المواد ومواصفاتها</th>
                        <th className="p-2 text-center w-16">الكمية</th>
                        <th className="p-2 text-center w-20">إفرادي (د)</th>
                        <th className="p-2 text-center w-20">إفرادي (ف)</th>
                        <th className="p-2 text-center w-20">إجمالي (د)</th>
                        <th className="p-2 text-center w-20">إجمالي (ف)</th>
                        <th className="p-2 text-right min-w-[100px]">الفصل والمادة</th>
                        <th className="p-2 text-right min-w-[100px]">ملاحظات</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseItems.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-1 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="p-1">
                            <Input
                              value={item.itemDescription}
                              onChange={(e) => updateItem(idx, "itemDescription", e.target.value)}
                              placeholder="وصف المادة"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                              placeholder="0"
                              className="h-8 text-xs text-center"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={item.unitPriceDinars}
                              onChange={(e) => updateItem(idx, "unitPriceDinars", e.target.value)}
                              placeholder="دينار"
                              className="h-8 text-xs text-center"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={item.unitPriceFils}
                              onChange={(e) => updateItem(idx, "unitPriceFils", e.target.value)}
                              placeholder="فلس"
                              className="h-8 text-xs text-center"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={item.totalPriceDinars}
                              disabled
                              className="h-8 text-xs text-center bg-muted"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={item.totalPriceFils}
                              disabled
                              className="h-8 text-xs text-center bg-muted"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={item.chapterAndSubject}
                              onChange={(e) => updateItem(idx, "chapterAndSubject", e.target.value)}
                              placeholder="الفصل"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={item.notes}
                              onChange={(e) => updateItem(idx, "notes", e.target.value)}
                              placeholder="ملاحظات"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-1">
                            {purchaseItems.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => removeItem(idx)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handlePurchaseSubmit} className="gradient-accent text-accent-foreground gap-2">
                  <FileDown className="w-4 h-4" />
                  تنزيل طلب المشترى المحلي
                </Button>
                <Button onClick={savePurchaseOrder} variant="outline" className="gap-2">
                  <Save className="w-4 h-4" />
                  حفظ الطلب
                </Button>
                <Button onClick={() => setShowSavedOrders(!showSavedOrders)} variant="outline" className="gap-2">
                  <History className="w-4 h-4" />
                  الطلبات المحفوظة ({savedOrders.length})
                </Button>
              </div>

              {showSavedOrders && savedOrders.length > 0 && (
                <div className="space-y-2 mt-4 border-t pt-4">
                  <Label className="text-base font-bold">الطلبات المحفوظة</Label>
                  {savedOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">{order.supplierName}</p>
                        <p className="text-xs text-muted-foreground">{order.date} • {order.items.length} مادة</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => loadSavedOrder(order)}>تحميل</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteSavedOrder(order.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Advance Invoices Form */}
        {formType === "invoices" && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-500" />
                كشف فواتير السلفة المدرسية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>رقم الكشف</Label>
                  <Input
                    value={invoiceListNumber}
                    onChange={(e) => setInvoiceListNumber(e.target.value)}
                    placeholder="رقم الكشف"
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الكشف</Label>
                  <Input
                    type="date"
                    value={invoiceListDate}
                    onChange={(e) => setInvoiceListDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>المدرسة</Label>
                  <Input value={state.schoolName} disabled className="bg-muted" />
                </div>
              </div>

              {/* Running total indicator */}
              <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                <span className="font-semibold text-sm">المجموع الحالي:</span>
                <span className={`text-lg font-bold ${invoicesTotal >= 150 ? "text-red-600" : invoicesTotal >= 75 ? "text-amber-600" : "text-emerald-600"}`}>
                  {invoicesTotal.toFixed(3)} دينار
                </span>
                <span className="text-xs text-muted-foreground">
                  (ثانوي: 150 د / أساسي: 75 د)
                </span>
              </div>

              {/* Invoices Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">الفواتير</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addInvoice} className="gap-1">
                    <Plus className="w-4 h-4" />
                    إضافة فاتورة
                  </Button>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="p-2 text-center w-12">م</th>
                        <th className="p-2 text-center w-20">دينار</th>
                        <th className="p-2 text-center w-20">فلس</th>
                        <th className="p-2 text-center w-24">رقم الفاتورة</th>
                        <th className="p-2 text-center w-28">تاريخ الفاتورة</th>
                        <th className="p-2 text-right min-w-[160px]">البيان</th>
                        <th className="p-2 text-right min-w-[100px]">ملاحظات</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-1 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="p-1">
                            <Input
                              value={inv.amountDinars}
                              onChange={(e) => updateInvoice(idx, "amountDinars", e.target.value)}
                              placeholder="0"
                              className="h-8 text-xs text-center"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={inv.amountFils}
                              onChange={(e) => updateInvoice(idx, "amountFils", e.target.value)}
                              placeholder="0"
                              className="h-8 text-xs text-center"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={inv.invoiceNumber}
                              onChange={(e) => updateInvoice(idx, "invoiceNumber", e.target.value)}
                              placeholder="رقم"
                              className="h-8 text-xs text-center"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="date"
                              value={inv.invoiceDate}
                              onChange={(e) => updateInvoice(idx, "invoiceDate", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={inv.description}
                              onChange={(e) => updateInvoice(idx, "description", e.target.value)}
                              placeholder="البيان"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={inv.notes}
                              onChange={(e) => updateInvoice(idx, "notes", e.target.value)}
                              placeholder="ملاحظات"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-1">
                            {invoices.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => removeInvoice(idx)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleInvoicesExport} className="gradient-accent text-accent-foreground gap-2">
                  <FileDown className="w-4 h-4" />
                  تنزيل كشف الفواتير
                </Button>
                <Button onClick={saveInvoiceList} variant="outline" className="gap-2">
                  <Save className="w-4 h-4" />
                  حفظ الكشف
                </Button>
                <Button onClick={() => setShowSavedInvoices(!showSavedInvoices)} variant="outline" className="gap-2">
                  <History className="w-4 h-4" />
                  الكشوفات المحفوظة ({savedInvoiceLists.length})
                </Button>
              </div>

              {showSavedInvoices && savedInvoiceLists.length > 0 && (
                <div className="space-y-2 mt-4 border-t pt-4">
                  <Label className="text-base font-bold">الكشوفات المحفوظة</Label>
                  {savedInvoiceLists.map((list) => (
                    <div key={list.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">كشف رقم {list.listNumber || "—"}</p>
                        <p className="text-xs text-muted-foreground">{list.date} • {list.invoices.length} فاتورة</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => loadInvoiceList(list)}>تحميل</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteInvoiceList(list.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
