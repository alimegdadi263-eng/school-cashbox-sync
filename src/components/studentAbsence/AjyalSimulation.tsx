import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Play, RotateCcw, Monitor, ArrowLeft } from "lucide-react";

interface SimulationStep {
  title: string;
  description: string;
  screenshot: string; // emoji/icon representation
  highlight?: string;
  duration: number; // ms
}

const IMPORT_STEPS: SimulationStep[] = [
  { title: "فتح منصة أجيال", description: "يتم فتح موقع منصة أجيال الإلكتروني...", screenshot: "🌐", duration: 1500 },
  { title: "تسجيل الدخول", description: "إدخال اسم المستخدم وكلمة المرور والضغط على 'دخول'", screenshot: "🔐", highlight: "تسجيل الدخول", duration: 2000 },
  { title: "الصفحة الرئيسية", description: "تم تسجيل الدخول بنجاح - الصفحة الرئيسية لمنصة أجيال", screenshot: "🏠", duration: 1500 },
  { title: "فتح شؤون الطلبة", description: "من القائمة الرئيسية ← الضغط على 'شؤون الطلبة'", screenshot: "📚", highlight: "شؤون الطلبة", duration: 1800 },
  { title: "فتح قائمة الطلبة", description: "الضغط على 'الطلبة' لعرض قائمة الطلاب المسجلين", screenshot: "👥", highlight: "الطلبة", duration: 1500 },
  { title: "عرض بيانات الطلاب", description: "يتم عرض جدول يحتوي على جميع بيانات الطلاب...", screenshot: "📋", duration: 1500 },
  { title: "الضغط على تصدير", description: "الضغط على زر 'تصدير' لتحميل ملف Excel بالبيانات", screenshot: "📥", highlight: "تصدير", duration: 2000 },
  { title: "تحميل الملف", description: "يتم تحميل ملف Excel يحتوي على جميع بيانات الطلاب...", screenshot: "💾", duration: 1500 },
  { title: "استيراد في البرمجية", description: "فتح البرمجية ← غياب الطلبة ← إدارة الطلبة ← استيراد Excel", screenshot: "📤", highlight: "استيراد Excel (أجيال)", duration: 2000 },
  { title: "✅ تم الحفظ بنجاح!", description: "تم استيراد وحفظ جميع بيانات الطلبة في البرمجية بنجاح!", screenshot: "✅", duration: 2500 },
];

const ABSENCE_STEPS: SimulationStep[] = [
  { title: "فتح منصة أجيال", description: "يتم فتح موقع منصة أجيال الإلكتروني...", screenshot: "🌐", duration: 1500 },
  { title: "تسجيل الدخول", description: "إدخال بيانات الدخول والضغط على 'دخول'", screenshot: "🔐", duration: 2000 },
  { title: "الصفحة الرئيسية", description: "تم تسجيل الدخول بنجاح", screenshot: "🏠", duration: 1200 },
  { title: "فتح الانضباط المدرسي", description: "من القائمة ← الضغط على 'الانضباط المدرسي'", screenshot: "📖", highlight: "الانضباط المدرسي", duration: 1800 },
  { title: "إدخال الانضباط المدرسي", description: "الضغط على 'إدخال الانضباط المدرسي'", screenshot: "📝", highlight: "إدخال الانضباط المدرسي", duration: 1500 },
  { title: "الالتزام بالدوام المدرسي", description: "الضغط على 'الالتزام بالدوام المدرسي'", screenshot: "📋", highlight: "الالتزام بالدوام المدرسي", duration: 1500 },
  { title: "اختيار الصف الأول", description: "تحديد الصف والشعبة المطلوبة لتعبئة الغياب...", screenshot: "🏫", highlight: "الصف الأول أ", duration: 1800 },
  { title: "تعبئة الغياب", description: "وضع علامة 'بدون عذر' بجانب كل طالب غائب في هذا الصف", screenshot: "✏️", highlight: "بدون عذر", duration: 2500 },
  { title: "الانتقال للصف التالي", description: "الانتقال إلى الصف التالي لتعبئة الغياب فيه...", screenshot: "➡️", duration: 1500 },
  { title: "تعبئة غياب الصف التالي", description: "تكرار تعبئة الغياب لكل طالب غائب...", screenshot: "✏️", duration: 2000 },
  { title: "تأكيد الصفوف بدون غياب", description: "للصفوف التي لا يوجد فيها غياب ← الضغط على تبويب 'تأكيد الجميع حضور' من أعلى", screenshot: "✔️", highlight: "تأكيد الجميع حضور", duration: 2000 },
  { title: "إنهاء العملية", description: "الدخول إلى 'انضباط مدرسي' ← الضغط على 'انتهاء' لحفظ كل شيء", screenshot: "🏁", highlight: "انتهاء", duration: 2000 },
  { title: "✅ تم الحفظ بنجاح!", description: "تم رصد جميع حالات الغياب وتأكيد الحضور على منصة أجيال!", screenshot: "✅", duration: 2500 },
];

interface Props {
  type: "import" | "absence";
}

export default function AjyalSimulation({ type }: Props) {
  const steps = type === "import" ? IMPORT_STEPS : ABSENCE_STEPS;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const playStep = (stepIdx: number) => {
    if (stepIdx >= steps.length) {
      setIsPlaying(false);
      setCompleted(true);
      return;
    }
    setCurrentStep(stepIdx);
    timerRef.current = setTimeout(() => playStep(stepIdx + 1), steps[stepIdx].duration);
  };

  const startSimulation = () => {
    setIsPlaying(true);
    setCompleted(false);
    setCurrentStep(0);
    playStep(0);
  };

  const resetSimulation = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    setCompleted(false);
    setCurrentStep(-1);
  };

  const progress = currentStep >= 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          {type === "import" ? "محاكاة: استيراد الطلاب من أجيال" : "محاكاة: تعبئة الغياب في أجيال"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simulation Screen */}
        <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-1 shadow-lg">
          {/* Browser-like top bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-t-lg">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-slate-600 rounded px-3 py-0.5 text-[10px] text-slate-300 text-center">
              https://ajyal.moe.gov.jo
            </div>
          </div>
          {/* Screen content */}
          <div className="bg-white dark:bg-slate-100 min-h-[200px] flex flex-col items-center justify-center p-6 rounded-b-lg relative overflow-hidden">
            {currentStep < 0 && !completed ? (
              <div className="text-center space-y-3">
                <div className="text-5xl">🎬</div>
                <p className="text-slate-600 text-sm font-medium">
                  {type === "import" ? "شاهد خطوات استيراد الطلاب من منصة أجيال" : "شاهد خطوات تعبئة الغياب على منصة أجيال"}
                </p>
                <p className="text-slate-400 text-xs">اضغط 'تشغيل' لمشاهدة المحاكاة</p>
              </div>
            ) : completed ? (
              <div className="text-center space-y-3 animate-in fade-in duration-500">
                <div className="text-6xl">🎉</div>
                <p className="text-green-700 font-bold text-lg">تمت العملية بنجاح!</p>
                <p className="text-slate-500 text-sm">
                  {type === "import" ? "تم استيراد وحفظ جميع بيانات الطلبة" : "تم رصد جميع حالات الغياب وتأكيدها"}
                </p>
              </div>
            ) : (
              <div className="text-center space-y-4 animate-in fade-in slide-in-from-left-4 duration-300" key={currentStep}>
                <div className="text-6xl transition-transform duration-300 hover:scale-110">
                  {steps[currentStep]?.screenshot}
                </div>
                <div className="space-y-2">
                  <h3 className="text-slate-800 font-bold text-base">{steps[currentStep]?.title}</h3>
                  <p className="text-slate-600 text-sm max-w-md">{steps[currentStep]?.description}</p>
                  {steps[currentStep]?.highlight && (
                    <Badge className="bg-blue-500 text-white hover:bg-blue-600 text-xs px-3 py-1">
                      {steps[currentStep].highlight}
                    </Badge>
                  )}
                </div>
                {/* Navigation arrows */}
                {currentStep > 0 && currentStep < steps.length - 1 && (
                  <div className="flex justify-center">
                    <ArrowLeft className="w-5 h-5 text-slate-400 animate-pulse rotate-180" />
                    <span className="text-slate-400 text-xs mx-2">الانتقال للخطوة التالية...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {(isPlaying || completed) && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>الخطوة {Math.min(currentStep + 1, steps.length)} من {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {/* Step indicators */}
        {currentStep >= 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  idx < currentStep ? "bg-green-500 scale-90" :
                  idx === currentStep ? "bg-blue-500 ring-2 ring-blue-300 scale-110" :
                  "bg-slate-200"
                }`}
                title={step.title}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 justify-center">
          {!isPlaying && !completed && (
            <Button onClick={startSimulation} className="gap-2">
              <Play className="w-4 h-4" />
              تشغيل المحاكاة
            </Button>
          )}
          {(isPlaying || completed) && (
            <Button onClick={resetSimulation} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              إعادة التشغيل
            </Button>
          )}
          {completed && (
            <Badge variant="default" className="gap-1 py-1.5 px-3">
              <CheckCircle2 className="w-4 h-4" />
              اكتملت المحاكاة
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
