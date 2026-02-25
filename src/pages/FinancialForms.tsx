import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileDown, FileText, ClipboardList, ShoppingCart } from "lucide-react";
import {
  fillFinancialClaim,
  fillAssignmentDecision,
  fillLocalPurchase,
  type FinancialClaimData,
  type AssignmentDecisionData,
  type LocalPurchaseData,
} from "@/lib/fillFinancialForms";

type FormType = "claim" | "assignment" | "purchase";

const FORM_TYPES: { id: FormType; label: string; icon: typeof FileText; color: string }[] = [
  { id: "claim", label: "مطالبة مالية", icon: FileText, color: "border-emerald-500 bg-emerald-500/10 text-emerald-600" },
  { id: "assignment", label: "قرار تكليف", icon: ClipboardList, color: "border-blue-500 bg-blue-500/10 text-blue-600" },
  { id: "purchase", label: "طلب مشترى محلي", icon: ShoppingCart, color: "border-orange-500 bg-orange-500/10 text-orange-600" },
];

export default function FinancialForms() {
  const { state } = useFinance();
  const { toast } = useToast();
  const [formType, setFormType] = useState<FormType>("claim");

  // Financial Claim state
  const [claimAmount, setClaimAmount] = useState<number>(0);
  const [claimRecipient, setClaimRecipient] = useState("");
  const [claimCheck, setClaimCheck] = useState("");
  const [claimDescription, setClaimDescription] = useState("");

  // Assignment Decision state
  const [assignDay, setAssignDay] = useState("");
  const [assignDate, setAssignDate] = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignPerson, setAssignPerson] = useState("");
  const [assignDescription, setAssignDescription] = useState("");

  // Local Purchase state
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseAddress, setPurchaseAddress] = useState("");

  const handleClaimSubmit = async () => {
    if (claimAmount <= 0) {
      toast({ title: "خطأ", description: "يرجى إدخال المبلغ", variant: "destructive" });
      return;
    }
    await fillFinancialClaim({
      school: state.schoolName,
      amount: claimAmount,
      recipientName: claimRecipient,
      checkNumber: claimCheck,
      description: claimDescription,
    });
    toast({ title: "تم التنزيل", description: "تم تنزيل المطالبة المالية بنجاح" });
  };

  const handleAssignmentSubmit = async () => {
    if (!assignPerson.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم الشخص", variant: "destructive" });
      return;
    }
    await fillAssignmentDecision({
      school: state.schoolName,
      day: assignDay,
      date: assignDate,
      subject: assignSubject,
      personName: assignPerson,
      description: assignDescription,
    });
    toast({ title: "تم التنزيل", description: "تم تنزيل قرار التكليف بنجاح" });
  };

  const handlePurchaseSubmit = async () => {
    if (!purchaseSupplier.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم المورد", variant: "destructive" });
      return;
    }
    await fillLocalPurchase({
      school: state.schoolName,
      supplierName: purchaseSupplier,
      supplierAddress: purchaseAddress,
    });
    toast({ title: "تم التنزيل", description: "تم تنزيل طلب المشترى المحلي بنجاح" });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground">المعاملات المالية</h1>

        {/* Form Type Selector */}
        <div className="grid grid-cols-3 gap-3">
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
                  <Input
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    placeholder="مثال: 2025/1/15"
                  />
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
              <Button onClick={handlePurchaseSubmit} className="gradient-accent text-accent-foreground gap-2">
                <FileDown className="w-4 h-4" />
                تنزيل طلب المشترى المحلي
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
