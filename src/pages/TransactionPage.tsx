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
} from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const [amounts, setAmounts] = useState(createEmptyAmounts());

  const updateAmount = (colId: AccountColumnId, field: "debit" | "credit", value: string) => {
    const num = parseFloat(value) || 0;
    setAmounts((prev) => ({
      ...prev,
      [colId]: { ...prev[colId], [field]: num },
    }));
  };

  // Receipt: debit to cashBox. Journal: debit to bank. Payment: credit from any.
  const getRelevantColumns = () => {
    if (type === "receipt") return ACCOUNT_COLUMNS; // القبض يكون بالصندوق
    if (type === "journal") return ACCOUNT_COLUMNS; // القيد يكون بالبنك
    return ACCOUNT_COLUMNS; // الصرف من الجميع
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال البيان", variant: "destructive" });
      return;
    }

    addTransaction({
      id: generateId(),
      date,
      description,
      type,
      status: "active",
      referenceNumber,
      amounts,
    });

    toast({ title: "تم بنجاح", description: `تم إضافة ${TRANSACTION_TYPE_LABELS[type]}` });
    
    // Reset
    setDescription("");
    setReferenceNumber("");
    setAmounts(createEmptyAmounts());
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground">إضافة حركة مالية</h1>

        {/* Transaction Type Selector */}
        <div className="flex gap-3">
          {(["receipt", "payment", "journal"] as TransactionType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 border-2 ${
                type === t
                  ? t === "receipt"
                    ? "border-success bg-success/10 text-success"
                    : t === "payment"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-journal bg-journal/10 text-journal"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
              }`}
            >
              {TRANSACTION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">{TRANSACTION_TYPE_LABELS[type]}</CardTitle>
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

            {/* Amounts Grid */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">المبالغ حسب الحساب</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getRelevantColumns().map((col) => (
                  <div key={col.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                    <p className="text-sm font-semibold text-foreground">{col.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-success">من (مدين)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={amounts[col.id].debit || ""}
                          onChange={(e) => updateAmount(col.id, "debit", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="0.000"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-destructive">الى (دائن)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={amounts[col.id].credit || ""}
                          onChange={(e) => updateAmount(col.id, "credit", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="0.000"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
