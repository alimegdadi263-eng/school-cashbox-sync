// Ajyal Platform Simulation - Updated with full absence workflow
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Play, RotateCcw, Monitor, MousePointer2, ArrowLeft, ArrowRight } from "lucide-react";

interface SimulationStep {
  title: string;
  description: string;
  ui: "login" | "home" | "menu" | "table" | "export" | "import" | "discipline" | "discipline-form" | "class-select" | "attendance" | "confirm" | "confirm-all" | "save-form" | "final-confirm" | "done" | "loading";
  highlight?: string;
  clickTarget?: string;
  duration: number;
}

const IMPORT_STEPS: SimulationStep[] = [
  { title: "فتح منصة أجيال", description: "يتم فتح موقع منصة أجيال الإلكتروني...", ui: "loading", duration: 1500 },
  { title: "تسجيل الدخول", description: "إدخال اسم المستخدم وكلمة المرور", ui: "login", clickTarget: "دخول", duration: 2500 },
  { title: "الصفحة الرئيسية", description: "تم تسجيل الدخول بنجاح", ui: "home", duration: 1500 },
  { title: "فتح شؤون الطلبة", description: "الضغط على 'شؤون الطلبة' من القائمة", ui: "menu", highlight: "شؤون الطلبة", clickTarget: "شؤون الطلبة", duration: 2000 },
  { title: "فتح قائمة الطلبة", description: "الضغط على 'الطلبة'", ui: "menu", highlight: "الطلبة", clickTarget: "الطلبة", duration: 1800 },
  { title: "عرض بيانات الطلاب", description: "يتم عرض جدول بيانات الطلاب", ui: "table", duration: 2000 },
  { title: "الضغط على تصدير", description: "الضغط على زر 'تصدير' لتحميل ملف Excel", ui: "export", clickTarget: "تصدير", duration: 2000 },
  { title: "تحميل الملف", description: "يتم تحميل ملف Excel...", ui: "loading", duration: 1500 },
  { title: "استيراد في البرمجية", description: "فتح البرمجية واستيراد الملف في إدارة الطلبة", ui: "import", clickTarget: "استيراد Excel", duration: 2500 },
  { title: "✅ تم بنجاح!", description: "تم استيراد وحفظ جميع بيانات الطلبة", ui: "done", duration: 2500 },
];

const ABSENCE_STEPS: SimulationStep[] = [
  { title: "فتح منصة أجيال", description: "يتم فتح موقع منصة أجيال الإلكتروني...", ui: "loading", duration: 1500 },
  { title: "تسجيل الدخول", description: "إدخال اسم المستخدم وكلمة المرور", ui: "login", clickTarget: "دخول", duration: 2500 },
  { title: "الصفحة الرئيسية", description: "تم تسجيل الدخول بنجاح", ui: "home", duration: 1200 },
  { title: "فتح الانضباط المدرسي", description: "من القائمة الجانبية، اختيار 'الانضباط المدرسي'", ui: "menu", highlight: "الانضباط المدرسي", clickTarget: "الانضباط المدرسي", duration: 2000 },
  { title: "الانضباط والالتزام بالدوام", description: "اختيار 'الانضباط المدرسي والالتزام بالدوام'", ui: "menu", highlight: "الانضباط المدرسي والالتزام بالدوام", clickTarget: "الانضباط المدرسي والالتزام بالدوام", duration: 2000 },
  { title: "تحديد البيانات", description: "اختيار الصف والشعبة ونوع الرصد 'الالتزام بالدوام المدرسي' ونوع الغياب 'يوم كامل' وتحديد التاريخ", ui: "discipline-form", clickTarget: "بحث", duration: 3000 },
  { title: "البحث", description: "الضغط على زر 'بحث' لتوليد قائمة الطلاب", ui: "loading", duration: 1500 },
  { title: "اختيار الصف - الأول أ", description: "عرض طلاب الصف الأول أ", ui: "class-select", clickTarget: "الأول أ", duration: 1800 },
  { title: "تأكيد حضور الجميع", description: "لا يوجد غياب - الضغط على 'تأكيد حضور جميع الطلاب'", ui: "confirm-all", clickTarget: "تأكيد حضور جميع الطلاب", duration: 2500 },
  { title: "اختيار الصف - الثاني أ", description: "الانتقال للصف التالي وتحديد الشعبة", ui: "class-select", clickTarget: "الثاني أ", duration: 1800 },
  { title: "تعبئة الغياب - الثاني أ", description: "وضع علامة ✓ على الطلاب الغائبين واختيار نوع الغياب", ui: "attendance", highlight: "بدون عذر", clickTarget: "✓", duration: 3000 },
  { title: "الإقرار والحفظ", description: "تفعيل مربع 'أتعهد...' ثم الضغط على زر 'حفظ'", ui: "save-form", clickTarget: "حفظ", duration: 2500 },
  { title: "اختيار الصف - الثالث أ", description: "الانتقال للصف التالي", ui: "class-select", clickTarget: "الثالث أ", duration: 1800 },
  { title: "تعبئة الغياب - الثالث أ", description: "تكرار العملية لكل صف...", ui: "attendance", highlight: "بعذر", clickTarget: "✓", duration: 2500 },
  { title: "الإقرار والحفظ", description: "تفعيل مربع 'أتعهد...' والضغط على 'حفظ'", ui: "save-form", clickTarget: "حفظ", duration: 2000 },
  { title: "تأكيد الانتهاء من الغياب", description: "الدخول على تبويب 'تأكيد الانتهاء من الغياب اليومي' والتأكيد", ui: "final-confirm", clickTarget: "تأكيد الانتهاء", duration: 3000 },
  { title: "✅ تم بنجاح!", description: "تم رصد جميع حالات الغياب وتأكيد الانتهاء من الغياب اليومي", ui: "done", duration: 2500 },
];

interface Props {
  type: "import" | "absence";
}

function CursorAnimation({ target }: { target?: string }) {
  if (!target) return null;
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-1 animate-bounce text-orange-500">
      <MousePointer2 className="w-5 h-5 fill-orange-200" />
      <span className="text-[10px] font-bold bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">{target}</span>
    </div>
  );
}

function LoginScreen({ active }: { active: boolean }) {
  return (
    <div className="w-full max-w-[260px] mx-auto space-y-3">
      <div className="text-center space-y-1">
        <div className="text-3xl">🎓</div>
        <p className="font-bold text-slate-700 text-sm">منصة أجيال - تسجيل الدخول</p>
      </div>
      <div className="space-y-2">
        <div className={`bg-slate-100 rounded px-3 py-1.5 text-xs text-right border ${active ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
          <span className="text-slate-400">اسم المستخدم: </span>
          {active && <span className="text-slate-700 font-mono animate-pulse">admin_school</span>}
        </div>
        <div className={`bg-slate-100 rounded px-3 py-1.5 text-xs text-right border ${active ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
          <span className="text-slate-400">كلمة المرور: </span>
          {active && <span className="text-slate-700 font-mono animate-pulse">••••••••</span>}
        </div>
        <div className={`text-center py-1.5 rounded text-xs font-bold transition-all ${active ? "bg-green-500 text-white scale-105 shadow-md" : "bg-blue-500 text-white"}`}>
          دخول
        </div>
      </div>
    </div>
  );
}

function HomeScreen() {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between px-3 py-2 bg-blue-600 rounded-t text-white text-xs">
        <span>منصة أجيال</span>
        <span>🏫 المدرسة</span>
      </div>
      <div className="grid grid-cols-3 gap-2 px-2">
        {["📚 شؤون الطلبة", "📖 الانضباط", "📊 التقارير", "⚙️ الإعدادات", "👥 المعلمين", "📋 الجدول"].map(item => (
          <div key={item} className="bg-slate-50 border rounded p-2 text-center text-[10px] hover:bg-blue-50 transition-colors">{item}</div>
        ))}
      </div>
    </div>
  );
}

function MenuScreen({ highlight, clickTarget }: { highlight?: string; clickTarget?: string }) {
  const items = ["الرئيسية", "شؤون الطلبة", "الطلبة", "الانضباط المدرسي", "الانضباط المدرسي والالتزام بالدوام", "تأكيد الانتهاء من الغياب اليومي"];
  return (
    <div className="w-full max-w-[280px] mx-auto">
      <div className="bg-blue-700 text-white text-xs px-3 py-2 rounded-t">القائمة الجانبية</div>
      <div className="border border-t-0 rounded-b divide-y">
        {items.map(item => {
          const isHighlighted = item === highlight || item === clickTarget;
          return (
            <div key={item} className={`px-3 py-2 text-xs text-right transition-all duration-500 ${
              isHighlighted
                ? "bg-yellow-200 border-r-4 border-r-orange-500 font-bold text-orange-800 scale-[1.02]"
                : "hover:bg-slate-50"
            }`}>
              {isHighlighted && <span className="ml-1">👈</span>}
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableScreen() {
  const rows = [
    ["أحمد محمد", "الأول أ", "0791234567"],
    ["سارة علي", "الأول أ", "0797654321"],
    ["خالد يوسف", "الثاني ب", "0781112233"],
  ];
  return (
    <div className="w-full overflow-hidden">
      <div className="text-xs font-bold text-slate-600 mb-1 text-right">قائمة الطلبة المسجلين</div>
      <table className="w-full text-[10px] border">
        <thead>
          <tr className="bg-blue-600 text-white">
            <th className="p-1 text-right">الاسم</th>
            <th className="p-1 text-center">الصف</th>
            <th className="p-1 text-center">الهاتف</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-blue-50"} animate-in fade-in`} style={{ animationDelay: `${i * 200}ms` }}>
              <td className="p-1 text-right border">{r[0]}</td>
              <td className="p-1 text-center border">{r[1]}</td>
              <td className="p-1 text-center border font-mono">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[10px] text-slate-400 mt-1 text-left">إجمالي: 156 طالب</div>
    </div>
  );
}

function ExportScreen() {
  return (
    <div className="text-center space-y-3">
      <div className="inline-flex items-center gap-2 bg-green-100 border-2 border-green-400 rounded-lg px-4 py-2 animate-pulse">
        <span className="text-2xl">📥</span>
        <span className="text-sm font-bold text-green-700">تصدير إلى Excel</span>
      </div>
      <div className="text-xs text-slate-500">يتم تحميل ملف students_export.xls...</div>
      <Progress value={75} className="h-1.5 max-w-[200px] mx-auto" />
    </div>
  );
}

function ImportScreen() {
  return (
    <div className="text-center space-y-3">
      <div className="inline-flex items-center gap-2 bg-blue-100 border-2 border-blue-400 rounded-lg px-4 py-2">
        <span className="text-2xl">📤</span>
        <span className="text-sm font-bold text-blue-700">استيراد في البرمجية</span>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
        <span>students_export.xls</span>
        <ArrowLeft className="w-4 h-4 text-blue-500 animate-pulse" />
        <span className="font-bold">إدارة الطلبة</span>
      </div>
      <div className="text-[10px] text-green-600 font-bold animate-pulse">جاري الاستيراد... 156 طالب</div>
    </div>
  );
}

function ClassSelectScreen({ clickTarget }: { clickTarget?: string }) {
  const classes = ["الأول أ", "الأول ب", "الثاني أ", "الثاني ب", "الثالث أ"];
  return (
    <div className="w-full max-w-[250px] mx-auto space-y-2">
      <div className="text-xs font-bold text-slate-600 text-right">اختيار الصف والشعبة:</div>
      <div className="grid grid-cols-2 gap-1.5">
        {classes.map(cls => {
          const isTarget = cls === clickTarget;
          return (
            <div key={cls} className={`text-center text-[11px] rounded py-1.5 border transition-all duration-500 cursor-pointer ${
              isTarget
                ? "bg-orange-400 text-white border-orange-500 font-bold scale-105 shadow-md ring-2 ring-orange-300"
                : "bg-white border-slate-200 hover:bg-slate-50"
            }`}>
              {isTarget && "👈 "}{cls}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttendanceScreen({ highlight }: { highlight?: string }) {
  const students = [
    { name: "أحمد محمد", absent: true },
    { name: "سارة علي", absent: false },
    { name: "خالد يوسف", absent: true },
    { name: "نور حسين", absent: false },
  ];
  const absenceType = highlight === "بعذر" ? "بعذر" : "بدون عذر";
  return (
    <div className="w-full space-y-2">
      <div className="text-xs font-bold text-slate-600 text-right">سجل الحضور والغياب:</div>
      <table className="w-full text-[10px] border">
        <thead>
          <tr className="bg-blue-600 text-white">
            <th className="p-1 text-center w-8">✓</th>
            <th className="p-1 text-right">اسم الطالب</th>
            <th className="p-1 text-center">نوع الغياب</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={i} className={`${s.absent ? "bg-red-50" : "bg-white"}`}>
              <td className="p-1 text-center border">
                <div className={`w-4 h-4 mx-auto border-2 rounded-sm flex items-center justify-center transition-all ${
                  s.absent ? "border-red-500 bg-red-100" : "border-slate-300"
                }`}>
                  {s.absent && <span className="text-red-600 text-[10px] font-bold animate-pulse">✓</span>}
                </div>
              </td>
              <td className="p-1 text-right border font-medium">{s.name}</td>
              <td className="p-1 text-center border">
                {s.absent ? (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                    highlight ? "bg-red-500 text-white scale-110 ring-2 ring-orange-300 animate-pulse" : "bg-red-100 text-red-700"
                  }`}>
                    {absenceType}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DisciplineFormScreen({ clickTarget }: { clickTarget?: string }) {
  return (
    <div className="w-full max-w-[280px] mx-auto space-y-2">
      <div className="text-xs font-bold text-slate-600 text-right mb-2">تحديد بيانات الرصد:</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between bg-slate-50 border rounded px-2 py-1.5 text-[11px]">
          <span className="text-slate-500">الصف:</span>
          <span className="font-bold bg-blue-100 text-blue-700 px-2 rounded">الأول</span>
        </div>
        <div className="flex items-center justify-between bg-slate-50 border rounded px-2 py-1.5 text-[11px]">
          <span className="text-slate-500">الشعبة:</span>
          <span className="font-bold bg-blue-100 text-blue-700 px-2 rounded">أ</span>
        </div>
        <div className="flex items-center justify-between bg-slate-50 border rounded px-2 py-1.5 text-[11px]">
          <span className="text-slate-500">نوع الرصد:</span>
          <span className="font-bold bg-purple-100 text-purple-700 px-2 rounded">الالتزام بالدوام المدرسي</span>
        </div>
        <div className="flex items-center justify-between bg-slate-50 border rounded px-2 py-1.5 text-[11px]">
          <span className="text-slate-500">نوع الغياب:</span>
          <span className="font-bold bg-orange-100 text-orange-700 px-2 rounded">يوم كامل</span>
        </div>
        <div className="flex items-center justify-between bg-slate-50 border rounded px-2 py-1.5 text-[11px]">
          <span className="text-slate-500">التاريخ:</span>
          <span className="font-bold bg-green-100 text-green-700 px-2 rounded">📅 {new Date().toLocaleDateString('ar-JO')}</span>
        </div>
        <div className={`text-center py-1.5 rounded text-xs font-bold transition-all mt-2 ${
          clickTarget === "بحث" ? "bg-blue-600 text-white scale-105 shadow-md ring-2 ring-blue-300 animate-pulse" : "bg-blue-500 text-white"
        }`}>
          🔍 بحث
        </div>
      </div>
    </div>
  );
}

function ConfirmAllScreen({ clickTarget }: { clickTarget?: string }) {
  return (
    <div className="text-center space-y-3">
      <div className="text-xs font-bold text-slate-600 mb-2">لا يوجد غياب في هذا الصف</div>
      <div className={`inline-block px-4 py-2 rounded-lg text-sm font-bold transition-all ${
        clickTarget ? "bg-green-500 text-white scale-105 shadow-lg ring-2 ring-green-300 animate-pulse" : "bg-green-100 text-green-700"
      }`}>
        ✅ تأكيد حضور جميع الطلاب ليوم {new Date().toLocaleDateString('ar-JO')}
      </div>
      <p className="text-[10px] text-slate-400">الضغط هنا يؤكد حضور جميع طلاب الصف</p>
    </div>
  );
}

function SaveFormScreen({ clickTarget }: { clickTarget?: string }) {
  return (
    <div className="w-full max-w-[280px] mx-auto space-y-3">
      <div className="text-xs font-bold text-slate-600 text-right">الحفظ النهائي:</div>
      <div className={`flex items-center gap-2 bg-yellow-50 border-2 border-yellow-300 rounded px-3 py-2 text-[11px] transition-all ${
        clickTarget ? "ring-2 ring-orange-300" : ""
      }`}>
        <div className="w-4 h-4 border-2 border-orange-500 bg-orange-100 rounded-sm flex items-center justify-center">
          <span className="text-orange-600 text-[10px] font-bold animate-pulse">✓</span>
        </div>
        <span className="font-medium text-yellow-800">أتعهد بصحة البيانات المدخلة</span>
      </div>
      <div className={`text-center py-2 rounded text-xs font-bold transition-all ${
        clickTarget === "حفظ" ? "bg-green-600 text-white scale-105 shadow-lg ring-2 ring-green-300 animate-pulse" : "bg-green-500 text-white"
      }`}>
        💾 حفظ
      </div>
    </div>
  );
}

function FinalConfirmScreen({ clickTarget }: { clickTarget?: string }) {
  return (
    <div className="text-center space-y-3">
      <div className="bg-blue-700 text-white text-xs px-3 py-2 rounded-t max-w-[280px] mx-auto">
        تأكيد الانتهاء من الغياب اليومي
      </div>
      <div className="max-w-[280px] mx-auto border border-t-0 rounded-b p-3 space-y-2">
        <p className="text-[11px] text-slate-600">تم الانتهاء من رصد غياب جميع الصفوف</p>
        <div className={`text-center py-2 rounded text-xs font-bold transition-all ${
          clickTarget ? "bg-blue-600 text-white scale-105 shadow-lg ring-2 ring-blue-300 animate-pulse" : "bg-blue-500 text-white"
        }`}>
          ✅ تأكيد الانتهاء من الغياب اليومي
        </div>
      </div>
    </div>
  );
}

function ConfirmScreen() {
  return (
    <div className="text-center space-y-3">
      <div className="text-xs font-bold text-slate-600 mb-2">الصفوف بدون غياب:</div>
      <div className="space-y-1.5">
        {["الثالث أ", "الرابع ب", "الخامس أ"].map((cls, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-green-50 border border-green-200 rounded text-[11px]"
               style={{ animationDelay: `${i * 400}ms` }}>
            <span>{cls}</span>
            <span className="text-green-600 font-bold animate-pulse">✅ تأكيد الجميع حضور</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DoneScreen({ type }: { type: "import" | "absence" }) {
  return (
    <div className="text-center space-y-3 animate-in fade-in zoom-in duration-500">
      <div className="text-6xl">🎉</div>
      <p className="text-green-700 font-bold text-lg">تمت العملية بنجاح!</p>
      <div className="inline-block bg-green-50 border border-green-200 rounded-lg px-4 py-2">
        {type === "import" ? (
          <div className="space-y-1 text-xs text-green-800">
            <p>📥 تم استيراد <strong>156</strong> طالب</p>
            <p>🏫 من <strong>12</strong> شعبة</p>
            <p>💾 تم الحفظ في إدارة الطلبة</p>
          </div>
        ) : (
          <div className="space-y-1 text-xs text-green-800">
            <p>📋 تم معالجة <strong>12</strong> صف</p>
            <p>❌ تم رصد غياب <strong>8</strong> طلاب</p>
            <p>✅ تم تأكيد حضور <strong>4</strong> صفوف</p>
            <p>📝 تم تأكيد الانتهاء من الغياب اليومي</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="text-center space-y-3">
      <div className="text-4xl animate-spin">⏳</div>
      <p className="text-slate-500 text-sm animate-pulse">جاري التحميل...</p>
      <Progress value={60} className="h-1.5 max-w-[200px] mx-auto" />
    </div>
  );
}

function SimulationUI({ step, type }: { step: SimulationStep; type: "import" | "absence" }) {
  switch (step.ui) {
    case "login": return <LoginScreen active />;
    case "home": return <HomeScreen />;
    case "menu": return <MenuScreen highlight={step.highlight} clickTarget={step.clickTarget} />;
    case "table": return <TableScreen />;
    case "export": return <ExportScreen />;
    case "import": return <ImportScreen />;
    case "discipline-form": return <DisciplineFormScreen clickTarget={step.clickTarget} />;
    case "class-select": return <ClassSelectScreen clickTarget={step.clickTarget} />;
    case "attendance": return <AttendanceScreen highlight={step.highlight} />;
    case "confirm-all": return <ConfirmAllScreen clickTarget={step.clickTarget} />;
    case "save-form": return <SaveFormScreen clickTarget={step.clickTarget} />;
    case "final-confirm": return <FinalConfirmScreen clickTarget={step.clickTarget} />;
    case "confirm": return <ConfirmScreen />;
    case "done": return <DoneScreen type={type} />;
    case "loading": return <LoadingScreen />;
    default: return <LoadingScreen />;
  }
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

  const goToStep = (idx: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    setCompleted(false);
    setCurrentStep(idx);
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
          {/* Browser bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-t-lg">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-slate-600 rounded px-3 py-0.5 text-[10px] text-slate-300 text-center">
              {currentStep >= 0 && steps[currentStep]?.ui === "import" ? "البرمجية" : "https://ajyal.moe.gov.jo"}
            </div>
          </div>
          {/* Screen */}
          <div className="bg-white dark:bg-slate-100 min-h-[250px] flex flex-col items-center justify-center p-4 rounded-b-lg relative overflow-hidden" dir="rtl">
            {currentStep < 0 && !completed ? (
              <div className="text-center space-y-3">
                <div className="text-5xl">🎬</div>
                <p className="text-slate-600 text-sm font-medium">
                  {type === "import" ? "شاهد خطوات استيراد الطلاب من منصة أجيال" : "شاهد خطوات تعبئة الغياب على منصة أجيال"}
                </p>
                <p className="text-slate-400 text-xs">اضغط 'تشغيل' لمشاهدة كل خطوة أمامك</p>
              </div>
            ) : completed ? (
              <DoneScreen type={type} />
            ) : (
              <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300" key={currentStep}>
                <SimulationUI step={steps[currentStep]} type={type} />
              </div>
            )}
            {/* Cursor animation */}
            {currentStep >= 0 && !completed && <CursorAnimation target={steps[currentStep]?.clickTarget} />}
          </div>
        </div>

        {/* Step title */}
        {currentStep >= 0 && !completed && (
          <div className="text-center space-y-1">
            <p className="font-bold text-sm">{steps[currentStep]?.title}</p>
            <p className="text-xs text-muted-foreground">{steps[currentStep]?.description}</p>
            {steps[currentStep]?.highlight && (
              <Badge className="bg-orange-500 text-white text-[10px]">{steps[currentStep].highlight}</Badge>
            )}
          </div>
        )}

        {/* Progress */}
        {(isPlaying || completed || currentStep >= 0) && (
          <div className="space-y-1">
            <Progress value={completed ? 100 : progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>الخطوة {Math.min(currentStep + 1, steps.length)} من {steps.length}</span>
              <span>{Math.round(completed ? 100 : progress)}%</span>
            </div>
          </div>
        )}

        {/* Step dots - clickable */}
        {currentStep >= 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => goToStep(idx)}
                className={`w-3 h-3 rounded-full transition-all duration-300 cursor-pointer hover:scale-125 ${
                  idx < currentStep || completed ? "bg-green-500 scale-90" :
                  idx === currentStep ? "bg-blue-500 ring-2 ring-blue-300 scale-110" :
                  "bg-slate-200 hover:bg-slate-300"
                }`}
                title={step.title}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 justify-center flex-wrap">
          {!isPlaying && !completed && currentStep < 0 && (
            <Button onClick={startSimulation} className="gap-2">
              <Play className="w-4 h-4" />
              تشغيل المحاكاة
            </Button>
          )}
          {!isPlaying && currentStep >= 0 && !completed && (
            <>
              <Button onClick={startSimulation} size="sm" className="gap-1">
                <Play className="w-3 h-3" /> استمرار تلقائي
              </Button>
              <Button onClick={() => goToStep(Math.max(0, currentStep - 1))} size="sm" variant="outline" disabled={currentStep <= 0}>
                <ArrowRight className="w-3 h-3" />
              </Button>
              <Button onClick={() => { if (currentStep < steps.length - 1) goToStep(currentStep + 1); else { setCompleted(true); } }} size="sm" variant="outline">
                <ArrowLeft className="w-3 h-3" />
              </Button>
            </>
          )}
          {(isPlaying || completed || currentStep >= 0) && (
            <Button onClick={resetSimulation} variant="outline" size="sm" className="gap-1">
              <RotateCcw className="w-3 h-3" /> إعادة
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
