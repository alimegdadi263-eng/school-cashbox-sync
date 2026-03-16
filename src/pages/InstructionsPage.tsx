import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const quickStart = [
  "سجّل الدخول بالحساب المدرسي، ثم تأكد من تعبئة الإعدادات الأساسية (اسم المدرسة، المديرية، المدير، أعضاء اللجنة).",
  "أضف الحركات من تبويب (إضافة حركة) مع اختيار نوع الحركة والحسابات بشكل صحيح.",
  "راجع النتائج في (دفتر الصندوق) و(خلاصة الحسابات) قبل التصدير.",
  "استخدم التصدير Word/Excel لكل نموذج واحفظ نسخة أرشيفية شهرية.",
  "يمكنك إنشاء جداول الامتحانات من تبويب (جداول الامتحانات) مع تحديد الصف ونوع الامتحان وتاريخ البداية.",
  "لتصدير كشف أنصبة المعلمين استخدم زر (كشف أنصبة المعلمين) في تبويب الجدول المدرسي بعد توليد الجدول.",
];

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
    details: "حركة تثبيت للقيود المحاسبية.",
  },
  {
    title: "سحب سلفة",
    from: "من السلفة",
    to: "إلى البنك",
    details: "تُسجّل كسحب سلفة في الإدخال وتُعرض كصرف في الدفتر.",
  },
  {
    title: "صرف السلفة",
    from: "من التبرعات",
    to: "إلى السلفة",
    details: "تُسجّل كصرف سلفة في الإدخال وتُعرض كصرف في الدفتر.",
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
    docs: ["مستند صرف", "كشف تسديد السلفة", "فواتير السلفة كاملة", "طلب مشترى محلي"],
  },
];

const secretaryUsage = [
  "تبويب الجرد: إضافة مواد يدوياً أو استيراد Word/Excel ثم التصدير بالنموذج الرسمي. يمكنك حفظ قوائم الجرد واسترجاعها أو شطبها.",
  "تبويب الإتلاف: إضافة المواد أو استيراد Word/Excel، ثم حفظ قائمة الإتلاف. يمكن ترحيل مواد من الجرد للإتلاف مباشرة.",
  "قوائم الإتلاف المحفوظة: يمكنك إعادة التصدير أو شطب أي قائمة من السجل المحفوظ.",
  "النماذج الإدارية: استجواب، إجازة عرضية، عدم صرف مع تعبئة تلقائية من البيانات المدخلة.",
];

const timetableUsage = [
  "أضف المعلمين ومواد كل معلم من تبويب (الجدول المدرسي).",
  "اضغط (توليد الجدول) لإنشاء الجدول تلقائياً مع مراعاة عدم تعارض المعلمين.",
  "يمكنك تصدير جدول الصف أو المعلم أو المدرسة كاملة إلى Excel أو Word.",
  "كشف أنصبة المعلمين: اضغط الزر المخصص لتصدير كشف يوضح اسم المعلم ومواده وعدد حصصه الأسبوعية.",
];

const examUsage = [
  "اختر الصف المراد إنشاء جدول امتحان له من القائمة.",
  "حدد تاريخ البداية عبر التقويم ثم اضغط (توليد تلقائي) لتوزيع المواد تلقائياً على الأيام.",
  "يمكنك التعديل يدوياً: تغيير المادة أو التاريخ أو إضافة/حذف مادة.",
  "يوجد 3 تبويبات: امتحان الشهر الأول، الشهر الثاني، والنهائي لكل صف على حدا.",
  "اضغط (تصدير Excel) لتصدير جدول الامتحان بتنسيق احترافي.",
];

const sdiUsage = [
  "حدد تاريخ البداية والنهاية من التقويم لفلترة حركات الصرف من حساب SDI ضمن هذه الفترة.",
  "أدخل الرصيد السابق (المدور) والمنحة للسنة الحالية.",
  "وزّع كل حركة على المجال المناسب من القائمة المنسدلة.",
  "راقب النسب المئوية: الأحمر = تجاوز الحد، الأزرق = أقل من الحد الأدنى.",
  "اضغط (تصدير Excel) لإنشاء ملف يطابق النموذج الرسمي.",
];

const updateInstructions = [
  "للمستخدم النهائي: اضغط زر (التحديثات) مرة واحدة؛ الزر ينفّذ تلقائياً (تحقق ← تنزيل ← تثبيت).",
  "عند اكتمال التنزيل ستظهر رسالة إعادة التشغيل لتثبيت النسخة الجديدة مباشرة.",
  "للنشر: رفع رقم الإصدار ثم بناء نسخة Windows ورفع ملفات الإصدار إلى GitHub Releases.",
  "في حال عدم ظهور تحديث: تأكد من اتصال الإنترنت وأن الإصدار الجديد مرفوع بشكل صحيح.",
];

const troubleshooting = [
  "إذا لم يظهر ملف التصدير: تأكد من السماح بالتحميلات في النظام ومسار الحفظ.",
  "إذا كانت النتائج غير صحيحة: راجع اتجاه الحركة (من/إلى) وتاريخ الحركة والحسابات المختارة.",
  "إذا فشل الاستيراد: استخدم أول شيت في Excel وتأكد أن الصفوف تحتوي أعمدة النموذج الرسمية.",
  "إذا حدث تعارض أرقام: راجع الإعدادات وأعد حفظ الأرصدة الافتتاحية قبل إدخال الحركات الجديدة.",
];

export default function InstructionsPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl" dir="rtl">
        <h1 className="text-2xl font-bold text-foreground">دليل استخدام البرمجية الكامل</h1>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>البدء السريع</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pr-5 space-y-2 text-sm text-muted-foreground">
              {quickStart.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

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
            <CardTitle>استخدام تبويب السكرتير (الجرد والإتلاف والنماذج)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pr-5 space-y-2 text-sm text-muted-foreground">
              {secretaryUsage.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>الجدول المدرسي وكشف الأنصبة</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pr-5 space-y-2 text-sm text-muted-foreground">
              {timetableUsage.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>جداول الامتحانات</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pr-5 space-y-2 text-sm text-muted-foreground">
              {examUsage.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>تحليل منحة SDI</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pr-5 space-y-2 text-sm text-muted-foreground">
              {sdiUsage.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>آلية التحديث</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pr-5 space-y-2 text-sm text-muted-foreground">
              {updateInstructions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>حل المشاكل الشائعة</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pr-5 space-y-2 text-sm text-muted-foreground">
              {troubleshooting.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>الدعم الفني</CardTitle>
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
              الهدف من البرمجية: <span className="text-foreground">تسهيل إدارة الحركات المالية والجرد والإتلاف والنماذج الرسمية بدقة ووقت أقل.</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
