import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import {
  ACCOUNT_COLUMNS,
  AccountColumnId,
  TransactionType,
  createEmptyAmounts,
  generateId,
  TRANSACTION_TYPE_LABELS,
  PAYMENT_SOURCE_ACCOUNTS,
  JOURNAL_TARGET_ACCOUNTS,
  getAccountLabel,
} from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function TransactionPage() {
  const { addTransaction } = useFinance();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [type, setType] = useState<TransactionType>("receipt");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [sourceAccount, setSourceAccount] = useState<AccountColumnId>("donations");

  const handleSubmit = () => {
    if (!description.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال البيان", variant: "destructive" });
      return;
    }
    if (amount <= 0) {
      toast({ title: "خطأ", description: "يرجى إدخال المبلغ", variant: "destructive" });
      return;
    }

    const amounts = createEmptyAmounts();

    switch (type) {
      case "receipt":
        // القبض: من الصندوق الى الحساب المحدد
        amounts.cashBox.debit = amount;
        amounts[sourceAccount].credit = amount;
        break;
      case "payment":
        // الصرف: من الحساب المحدد الى البنك
        amounts[sourceAccount].debit = amount;
        amounts.bank.credit = amount;
        break;
      case "journal":
        // القيد: من البنك الى الصندوق
        amounts.bank.debit = amount;
        amounts.cashBox.credit = amount;
        break;
      case "advance_withdrawal":
        // سحب سلفة يد: من التبرعات الى السلفة
        amounts.donations.debit = amount;
        amounts.advances.credit = amount;
        break;
      case "advance_payment":
        // صرف السلفة: من السلفة الى البنك
        amounts.advances.debit = amount;
        amounts.bank.credit = amount;
        break;
    }

    addTransaction({
      id: generateId(),
      date,
      description,
      type,
      status: "active",
      referenceNumber,
      checkNumber: type === "payment" ? checkNumber : undefined,
      sourceAccount: (type === "payment" || type === "receipt") ? sourceAccount : undefined,
      amounts,
    });

    toast({ title: "تم بنجاح", description: `تم إضافة ${TRANSACTION_TYPE_LABELS[type]}` });

    // Reset
    setDescription("");
    setReferenceNumber("");
    setCheckNumber("");
    setAmount(0);
  };

  const allTypes: TransactionType[] = ["receipt", "payment", "journal", "advance_withdrawal", "advance_payment"];

  const getTypeColor = (t: TransactionType) => {
    switch (t) {
      case "receipt": return "border-success bg-success/10 text-success";
      case "payment": return "border-destructive bg-destructive/10 text-destructive";
      case "journal": return "border-journal bg-journal/10 text-journal";
      case "advance_withdrawal": return "border-amber-500 bg-amber-500/10 text-amber-600";
      case "advance_payment": return "border-purple-500 bg-purple-500/10 text-purple-600";
    }
  };

  // تحديد الحسابات المتاحة حسب نوع الحركة
  const getAvailableAccounts = () => {
    if (type === "payment") return PAYMENT_SOURCE_ACCOUNTS;
    if (type === "receipt") return JOURNAL_TARGET_ACCOUNTS;
    return [];
  };

  // وصف الحركة التلقائي
  const getTransactionDescription = () => {
    switch (type) {
      case "receipt": return `من الصندوق → الى ${getAccountLabel(sourceAccount)}`;
      case "payment": return `من ${getAccountLabel(sourceAccount)} → الى البنك`;
      case "journal": return "من البنك → الى الصندوق";
      case "advance_withdrawal": return "من التبرعات → الى السلفة";
      case "advance_payment": return "من السلفة → الى البنك";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground">إضافة حركة مالية</h1>

        {/* Transaction Type Selector */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {allTypes.map((t) => (
            <button
              key={t}
              onClick={() => {
              setType(t);
                if (t === "payment") setSourceAccount("donations");
                if (t === "receipt") setSourceAccount("donations");
              }}
              className={`py-3 px-3 rounded-lg text-xs font-semibold transition-all duration-200 border-2 ${
                type === t
                  ? getTypeColor(t)
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
              }`}
            >
              {TRANSACTION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{TRANSACTION_TYPE_LABELS[type]}</span>
              <span className="text-xs font-normal text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {getTransactionDescription()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>رقم المرجع</Label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="رقم السند"
                />
              </div>
              <div className="space-y-2">
                <Label>البيان</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف الحركة"
                />
              </div>
            </div>

            {/* Account selection for receipt/payment */}
            {(type === "receipt" || type === "payment") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{type === "payment" ? "الحساب المصدر (من)" : "الحساب المستهدف (إلى)"}</Label>
                  <Select value={sourceAccount} onValueChange={(v) => setSourceAccount(v as AccountColumnId)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableAccounts().map((accId) => (
                        <SelectItem key={accId} value={accId}>
                          {getAccountLabel(accId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {type === "payment" && (
                  <div className="space-y-2">
                    <Label>رقم الشيك</Label>
                    <Input
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      placeholder="رقم الشيك"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2 max-w-xs">
              <Label>المبلغ (دينار)</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.000"
                className="text-lg font-semibold"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSubmit} className="gradient-accent text-accent-foreground px-8">
                حفظ الحركة
              </Button>
              <Button variant="outline" onClick={() => navigate("/cashbook")}>
                عرض دفتر الصندوق
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
