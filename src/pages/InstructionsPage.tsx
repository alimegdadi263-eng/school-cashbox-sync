import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const movementInstructions = [
  {
    title: "سند القبض",
    from: "من الصندوق",
    to: "إلى الحساب المستهدف (مثل التبرعات)",
    details: "مثال: إذا كان القبض للتبرعات فالحركة تكون من الصندوق إلى التبرعات.",
  },
  {
    title: "الصرف",
    from: "من الحساب المصدر (مثل التبرعات)",
    to: "إلى البنك",
    details: "مثال: الصرف من التبرعات يكون من التبرعات إلى البنك.",
  },
  {
    title: "القيد",
    from: "من البنك",
    to: "إلى الصندوق",
    details: "حركة ثابتة لتثبيت القيود المحاسبية.",
  },
  {
    title: "سحب سلفة",
    from: "من السلفة",
    to: "إلى البنك",
    details: "تُسجّل كـ سحب سلفة في الإدخال وتُعرض كصرف في دفتر الصندوق.",
  },
  {
    title: "صرف سلفة",
    from: "من التبرعات",
    to: "إلى السلفة",
    details: "تُسجّل كـ صرف سلفة في الإدخال وتُعرض كصرف في دفتر الصندوق.",
  },
];

const requiredDocuments = [
  {
    transaction: "الصرف",
    docs: [
      "مستند صرف",
      "فاتورة (أو مطالبة مالية + قرار تكليف عند الحاجة)",
      "مستند إدخال",
      "طلب مشترى محلي",
      "إثبات (هوية أو رخصة)",
    ],
  },
  {
    transaction: "القيد",
    docs: [
      "مستند قيد",
      "كتاب المديرية",
      "الورقة الزهرية من مستند القبض",
      "كشف حساب للتثبيت (إن أمكن)",
    ],
  },
  {
    transaction: "سحب السلفة",
    docs: ["مستند صرف فقط"],
  },
  {
    transaction: "صرف السلفة",
    docs: [
      "مستند صرف",
      "كشف تسديد السلفة",
      "فواتير السلفة كاملة",
      "طلب مشترى محلي",
    ],
  },
];

export default function InstructionsPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground">تعليمات الاستخدام والمعاملات</h1>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>تعليمات الحركات (من / إلى)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {movementInstructions.map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.from} ←→ {item.to}</p>
                <p className="text-sm text-muted-foreground">{item.details}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>المستندات المطلوبة لكل معاملة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requiredDocuments.map((item) => (
              <div key={item.transaction} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground mb-2">{item.transaction}</h3>
                <ul className="list-disc pr-5 space-y-1 text-sm text-muted-foreground">
                  {item.docs.map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>معلومات عن صاحب البرمجية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              الاسم: <span className="font-semibold text-foreground">الأستاذ علي مقدادي</span>
            </p>
            <p>
              رقم الهاتف: <a href="tel:0780296130" className="font-semibold text-primary hover:underline" dir="ltr">0780296130</a>
            </p>
            <Separator />
            <p>
              الهدف من البرمجية: <span className="text-foreground">التسهيل على المستخدم في التعامل مع الحركات والمعاملات المالية بشكل واضح ومنظّم.</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
