import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useFinance } from "@/context/FinanceContext";
import { ACCOUNT_COLUMNS, OpeningBalance } from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { state, setOpeningBalances, updateSettings } = useFinance();
  const { toast } = useToast();

  const [schoolName, setSchoolName] = useState(state.schoolName);
  const [month, setMonth] = useState(state.currentMonth);
  const [year, setYear] = useState(state.currentYear);
  const [balances, setBalances] = useState<OpeningBalance[]>([...state.openingBalances]);

  const updateBalance = (colId: string, field: "debit" | "credit", value: string) => {
    const num = parseFloat(value) || 0;
    setBalances((prev) =>
      prev.map((b) => (b.column === colId ? { ...b, [field]: num } : b))
    );
  };

  const handleSave = () => {
    setOpeningBalances(balances);
    updateSettings(schoolName, month, year);
    toast({ title: "تم الحفظ", description: "تم حفظ الإعدادات بنجاح" });
  };

  const months = [
    "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
    "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول",
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">معلومات المدرسة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المدرسة</Label>
              <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الشهر</Label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>السنة</Label>
                <Input value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">الأرصدة الافتتاحية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ACCOUNT_COLUMNS.map((col) => {
                const bal = balances.find((b) => b.column === col.id);
                return (
                  <div key={col.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <span className="w-32 text-sm font-medium">{col.label}</span>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] text-success">من (مدين)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={bal?.debit || ""}
                          onChange={(e) => updateBalance(col.id, "debit", e.target.value)}
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
                          value={bal?.credit || ""}
                          onChange={(e) => updateBalance(col.id, "credit", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="0.000"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="gradient-accent text-accent-foreground px-8">
          حفظ الإعدادات
        </Button>
      </div>
    </AppLayout>
  );
}
