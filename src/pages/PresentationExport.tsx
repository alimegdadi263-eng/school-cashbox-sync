import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, Presentation, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { useState } from "react";
import { exportPPTX, exportPDF } from "@/lib/exportPresentation";

interface Slide {
  title: string;
  subtitle?: string;
  content: string[];
  color: string;
  icon?: string;
}

const slides: Slide[] = [
  {
    title: "نظام مالية المدارس",
    subtitle: "إعداد: الأستاذ علي مقدادي",
    content: [
      "نظام متكامل لإدارة الحسابات والمعاملات المالية المدرسية",
      "يعمل كتطبيق ويب وتطبيق سطح مكتب (Windows)",
      "مصمم لتبسيط العمليات المالية وتوفير الوقت والجهد",
      "للتواصل: 0780296130",
    ],
    color: "from-blue-600 to-indigo-700",
  },
  {
    title: "الأعمدة المحاسبية",
    subtitle: "9 أعمدة رئيسية في دفتر الصندوق",
    content: [
      "1. الصندوق - الحساب النقدي الرئيسي",
      "2. البنك - حساب البنك المرتبط",
      "3. التبرعات - حساب التبرعات الواردة",
      "4. السلفة - حساب السلف المدرسية",
      "5. الحدائق - حساب مشروع الحدائق",
      "6. الهلال الأحمر - حساب الهلال الأحمر",
      "7. SDI - حساب SDI",
      "8. الأمانات - حساب الأمانات المحفوظة",
      "9. مدرستي أنتمي - حساب مشروع مدرستي أنتمي",
    ],
    color: "from-emerald-600 to-teal-700",
  },
  {
    title: "سند القبض",
    subtitle: "تسجيل المبالغ المقبوضة",
    content: [
      "الاتجاه: من الصندوق (منه) ← إلى الحساب المستهدف (له)",
      "مثال: قبض تبرعات → من الصندوق إلى التبرعات",
      "يُسجل المبلغ في عمود الصندوق كمدين (منه)",
      "ويُسجل نفس المبلغ في عمود الحساب المختار كدائن (له)",
      "النتيجة: زيادة رصيد الصندوق + زيادة رصيد الحساب",
    ],
    color: "from-green-600 to-emerald-700",
  },
  {
    title: "الصرف",
    subtitle: "تسجيل المبالغ المصروفة",
    content: [
      "الاتجاه: من الحساب المصدر (منه) ← إلى البنك (له)",
      "مثال: صرف من التبرعات → من التبرعات إلى البنك",
      "الحسابات المتاحة للصرف: التبرعات، الهلال الأحمر، الحدائق، مدرستي أنتمي، الأمانات، SDI",
      "يُسجل المبلغ في عمود الحساب المصدر كمدين (من)",
      "ويُسجل نفس المبلغ في عمود البنك كدائن (له)",
    ],
    color: "from-red-600 to-rose-700",
  },
  {
    title: "المستندات المطلوبة للصرف",
    subtitle: "يجب إرفاق جميع هذه المستندات",
    content: [
      "1. مستند صرف (سند الصرف)",
      "2. فاتورة أصلية (أو مطالبة مالية + قرار تكليف)",
      "3. مستند إدخال",
      "4. طلب مشترى محلي",
      "5. إثبات شخصية (هوية أو رخصة مهن)",
    ],
    color: "from-orange-600 to-amber-700",
  },
  {
    title: "سند القيد",
    subtitle: "تثبيت القيود المحاسبية",
    content: [
      "الاتجاه: حركة ثابتة من البنك (منه) ← إلى الصندوق (له)",
      "هذه الحركة ثابتة ولا يتم اختيار حساب طرف ثالث",
      "تُستخدم لتثبيت المبالغ المحولة من البنك إلى الصندوق",
      "المستندات المطلوبة: مستند قيد، كتاب المديرية، الورقة الزهرية، كشف حساب",
    ],
    color: "from-purple-600 to-violet-700",
  },
  {
    title: "سحب السلفة",
    subtitle: "سحب مبلغ السلفة من البنك",
    content: [
      "الاتجاه: من السلفة (منه) ← إلى البنك (له)",
      "تُسجل كـ 'سحب سلفة' عند الإدخال",
      "تظهر في دفتر الصندوق تحت نوع 'صرف'",
      "المستندات المطلوبة: مستند صرف فقط",
      "الهدف: توفير سيولة نقدية للمشتريات العاجلة",
    ],
    color: "from-cyan-600 to-sky-700",
  },
  {
    title: "صرف السلفة",
    subtitle: "تسوية مبلغ السلفة بعد الصرف",
    content: [
      "الاتجاه: من التبرعات (منه) ← إلى السلفة (له)",
      "تُسجل كـ 'صرف سلفة' عند الإدخال",
      "تظهر في دفتر الصندوق تحت نوع 'صرف'",
      "المستندات المطلوبة:",
      "• مستند صرف + كشف تسديد السلفة",
      "• فواتير السلفة كاملة + طلب مشترى محلي",
    ],
    color: "from-pink-600 to-fuchsia-700",
  },
  {
    title: "المعاملات المالية",
    subtitle: "النماذج الإدارية القابلة للتصدير",
    content: [
      "1. المطالبة المالية: بيانات المستلم والمبلغ وتوقيعات اللجنة",
      "2. قرار التكليف: تكليف رسمي بمهمة مع تحديد التاريخ",
      "3. طلب المشترى المحلي: جدول بالمشتريات مع الكميات والأسعار",
      "جميع النماذج تُصدر كملفات Word (.docx) جاهزة للطباعة",
      "يتم إدراج اسم المدرسة وبيانات اللجنة تلقائياً",
    ],
    color: "from-amber-600 to-yellow-700",
  },
  {
    title: "الخلاصة الشهرية",
    subtitle: "ملخص شامل لجميع الحركات",
    content: [
      "تعرض ملخص الأرصدة لكل عمود محاسبي (منه/له/الصافي)",
      "تشمل الأرصدة الافتتاحية + حركات الشهر + الأرصدة الختامية",
      "قابلة للتصدير كملف Word أفقي مفصل",
      "قابلة للتصدير كملف Excel مع تنسيق احترافي",
      "تتضمن أسماء أعضاء اللجنة المالية",
    ],
    color: "from-indigo-600 to-blue-700",
  },
  {
    title: "حماية وأمان النظام",
    subtitle: "9 طبقات حماية متكاملة",
    content: [
      "✅ Row Level Security (RLS) - حماية قاعدة البيانات",
      "✅ Edge Functions - منطق الحماية في السيرفر وليس الواجهة",
      "✅ javascript-obfuscator - تشفير كود JavaScript",
      "✅ ASAR Encryption - تجميع الملفات في حزمة محمية",
      "✅ تعطيل DevTools و F12 في الإنتاج",
      "✅ حذف قائمة البرنامج + حظر الاختصارات",
      "✅ Integrity Check - فحص سلامة الملفات عند التشغيل",
      "✅ Content Security Policy (CSP)",
    ],
    color: "from-rose-600 to-red-700",
  },
  {
    title: "شكراً لكم",
    subtitle: "الأستاذ علي مقدادي",
    content: [
      "نظام مالية المدارس - الإصدار 1.0",
      "مصمم لخدمة المجتمع التعليمي",
      "للتواصل والدعم الفني: 0780296130",
      `© ${new Date().getFullYear()} Ali Megdadi. جميع الحقوق محفوظة`,
    ],
    color: "from-slate-700 to-gray-900",
  },
];

export default function PresentationExport() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const goNext = () => setCurrentSlide((s) => Math.min(s + 1, slides.length - 1));
  const goPrev = () => setCurrentSlide((s) => Math.max(s - 1, 0));

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const slidesHtml = slides
      .map(
        (slide, i) => `
      <div style="page-break-after: always; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px; font-family: 'Traditional Arabic', Arial, sans-serif; direction: rtl; background: linear-gradient(135deg, #1e293b, #0f172a); color: white; position: relative;">
        <div style="position: absolute; top: 30px; left: 30px; font-size: 14px; opacity: 0.5;">${i + 1} / ${slides.length}</div>
        <h1 style="font-size: 42px; font-weight: bold; margin-bottom: 12px; text-align: center;">${slide.title}</h1>
        ${slide.subtitle ? `<h2 style="font-size: 22px; opacity: 0.8; margin-bottom: 40px; text-align: center;">${slide.subtitle}</h2>` : ""}
        <div style="max-width: 800px; width: 100%;">
          ${slide.content.map((line) => `<p style="font-size: 20px; line-height: 2; margin: 8px 0; padding-right: 10px;">${line}</p>`).join("")}
        </div>
        ${i === 0 || i === slides.length - 1 ? '<div style="position: absolute; bottom: 30px; font-size: 12px; opacity: 0.4;">نظام مالية المدارس - الأستاذ علي مقدادي</div>' : ""}
      </div>
    `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>عرض تقديمي - مالية المدارس - الأستاذ علي مقدادي</title>
        <style>
          @page { size: landscape; margin: 0; }
          body { margin: 0; padding: 0; }
          @media print { div { page-break-after: always; } }
        </style>
      </head>
      <body>${slidesHtml}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const slide = slides[currentSlide];

  return (
    <AppLayout>
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Presentation className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">العرض التقديمي</h1>
              <p className="text-sm text-muted-foreground">شرح الحركات والمعاملات المالية</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2">
            <Download className="w-4 h-4" />
            طباعة / تصدير PDF
          </Button>
        </div>

        {/* Slide Viewer */}
        <Card className="overflow-hidden shadow-card">
          <div
            ref={printRef}
            className={`bg-gradient-to-br ${slide.color} text-white p-8 md:p-12 min-h-[420px] flex flex-col justify-center relative transition-all duration-500`}
          >
            <div className="absolute top-4 left-4 text-sm opacity-50">
              {currentSlide + 1} / {slides.length}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2 text-center">{slide.title}</h2>
            {slide.subtitle && (
              <p className="text-lg md:text-xl opacity-80 mb-8 text-center">{slide.subtitle}</p>
            )}
            <div className="max-w-2xl mx-auto w-full space-y-3">
              {slide.content.map((line, i) => (
                <p key={i} className="text-base md:text-lg leading-relaxed opacity-90">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={goPrev} disabled={currentSlide === 0} className="gap-2">
            <ChevronRight className="w-4 h-4" />
            السابق
          </Button>

          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === currentSlide ? "bg-primary scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>

          <Button variant="outline" onClick={goNext} disabled={currentSlide === slides.length - 1} className="gap-2">
            التالي
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Slide thumbnails */}
        <Separator />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`rounded-lg overflow-hidden border-2 transition-all ${
                i === currentSlide ? "border-primary shadow-lg scale-105" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <div className={`bg-gradient-to-br ${s.color} text-white p-3 h-20 flex flex-col justify-center`}>
                <p className="text-[10px] font-bold truncate">{s.title}</p>
                <p className="text-[8px] opacity-70 truncate">{s.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
