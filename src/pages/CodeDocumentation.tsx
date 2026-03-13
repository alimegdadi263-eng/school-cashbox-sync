import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Code, Database, Shield, FileText, Layout, Server, Monitor, FolderTree, Lock, KeyRound } from "lucide-react";

interface DocSection {
  title: string;
  icon: typeof Code;
  color: string;
  items: { file: string; description: string }[];
}

const sections: DocSection[] = [
  {
    title: "البنية الأساسية للمشروع",
    icon: FolderTree,
    color: "text-blue-500",
    items: [
      { file: "src/App.tsx", description: "الملف الرئيسي: يحتوي على تعريف المسارات (Routes) وحماية الصفحات (ProtectedRoute/AdminRoute) ومزودات السياق (Providers)." },
      { file: "src/main.tsx", description: "نقطة الدخول: يقوم بتحميل تطبيق React وربطه بعنصر root في الصفحة." },
      { file: "src/index.css", description: "ملف التنسيق العام: يحتوي على متغيرات الألوان (CSS Variables) ونظام التصميم (Design System) للوضع الفاتح والداكن." },
      { file: "vite.config.ts", description: "إعدادات Vite: أداة بناء المشروع، تحدد المنافذ والاختصارات (aliases) والإضافات (plugins)." },
      { file: "tailwind.config.ts", description: "إعدادات Tailwind CSS: تعريف الألوان والخطوط والأنماط المخصصة المستخدمة في التطبيق." },
    ],
  },
  {
    title: "المصادقة وإدارة المستخدمين",
    icon: Shield,
    color: "text-red-500",
    items: [
      { file: "src/hooks/useAuth.tsx", description: "هوك المصادقة: يدير حالة تسجيل الدخول، التحقق من الأدوار (admin/school)، فحص الاشتراك، وقفل الحساب بعد 5 محاولات خاطئة." },
      { file: "src/pages/Auth.tsx", description: "صفحة تسجيل الدخول: واجهة إدخال البريد وكلمة المرور مع حماية من محاولات الاختراق." },
      { file: "src/pages/AdminUsers.tsx", description: "لوحة إدارة المستخدمين (أدمن فقط): إنشاء/حذف حسابات المدارس، عرض بيانات الدخول، إدارة الاشتراكات." },
      { file: "src/components/SubscriptionExpired.tsx", description: "مكون انتهاء الاشتراك: يظهر عند انتهاء صلاحية حساب المدرسة." },
      { file: "src/components/ChangePasswordDialog.tsx", description: "نافذة تغيير كلمة المرور: تتيح للمستخدم تغيير كلمة مروره بشكل آمن." },
    ],
  },
  {
    title: "قاعدة البيانات السحابية",
    icon: Database,
    color: "text-green-500",
    items: [
      { file: "src/integrations/supabase/client.ts", description: "عميل الاتصال بقاعدة البيانات: يتم إنشاؤه تلقائياً ويوفر واجهة للتعامل مع البيانات السحابية." },
      { file: "src/integrations/supabase/types.ts", description: "أنواع البيانات: تعريف هيكل الجداول (profiles, school_credentials, user_roles) وأنواع القيم." },
      { file: "جدول profiles", description: "يخزن بيانات المستخدمين: الاسم، حالة التفعيل، تاريخ انتهاء الاشتراك." },
      { file: "جدول school_credentials", description: "يخزن بيانات الدخول (البريد وكلمة المرور النصية) لعرضها في لوحة الأدمن." },
      { file: "جدول user_roles", description: "يحدد دور كل مستخدم (admin أو school) للتحكم بالصلاحيات." },
    ],
  },
  {
    title: "الوظائف السحابية (Edge Functions)",
    icon: Server,
    color: "text-purple-500",
    items: [
      { file: "supabase/functions/setup-admin", description: "إعداد حساب الأدمن: ينشئ حساب المدير الرئيسي مع حمايات ضد إنشاء أكثر من أدمن واحد." },
      { file: "supabase/functions/create-school-user", description: "إنشاء حساب مدرسة: يستقبل طلب POST ببيانات المدرسة وينشئ الحساب مع الدور والاشتراك." },
      { file: "supabase/functions/delete-school-user", description: "حذف حساب مدرسة: يحذف الحساب مع حماية ضد حذف حسابات الأدمن." },
      { file: "supabase/functions/change-password", description: "تغيير كلمة المرور: وظيفة سحابية آمنة لتغيير كلمة مرور المستخدم مع تحديث بيانات الاعتماد." },
    ],
  },
  {
    title: "إدارة البيانات المالية (محلي)",
    icon: FileText,
    color: "text-amber-500",
    items: [
      { file: "src/context/FinanceContext.tsx", description: "سياق البيانات المالية: يدير الحركات والأرصدة الافتتاحية والإعدادات. البيانات تُحفظ في localStorage مرتبطة بمعرف المستخدم." },
      { file: "src/types/finance.ts", description: "أنواع البيانات المالية: تعريف هيكل الحركات (Transaction) والأرصدة (OpeningBalance) والأعمدة المحاسبية (9 أعمدة)." },
      { file: "src/pages/CashBook.tsx", description: "دفتر الصندوق: عرض جميع الحركات المالية مع إمكانية التصفية والتصدير لملف Word." },
      { file: "src/pages/TransactionPage.tsx", description: "صفحة إدخال الحركات: إضافة/تعديل حركة مالية (قبض، صرف، قيد، سلفة) مع تحديد المبالغ لكل عمود." },
      { file: "src/pages/MonthlySummary.tsx", description: "الخلاصة الشهرية: ملخص الأرصدة والحركات لكل شهر مع تصدير لملف Word وExcel." },
      { file: "src/pages/Index.tsx", description: "لوحة التحكم الرئيسية: عرض ملخص الأرصدة والإحصائيات والحالة المالية العامة." },
    ],
  },
  {
    title: "المعاملات المالية والقوالب",
    icon: FileText,
    color: "text-orange-500",
    items: [
      { file: "src/pages/FinancialForms.tsx", description: "صفحة المعاملات المالية: تحتوي على نماذج المطالبة المالية، قرار التكليف، وطلب المشترى المحلي مع حفظ الطلبات." },
      { file: "src/lib/fillFinancialForms.ts", description: "تعبئة القوالب: تحميل ملفات Word وتعبئتها ببيانات المستخدم باستخدام docxtemplater مع إصلاح الأقواس المكسورة." },
      { file: "src/lib/generatePaymentVoucherDocx.ts", description: "توليد سند الصرف: إنشاء ملف Word برمجياً لسند الصرف." },
      { file: "src/lib/generateJournalVoucherDocx.ts", description: "توليد سند القيد: إنشاء ملف Word برمجياً لسند القيد." },
      { file: "src/lib/generateLocalPurchaseDocx.ts", description: "توليد طلب المشترى المحلي: إنشاء ملف Word بجدول ديناميكي مع أعمدة فرعية (دينار/فلس)." },
      { file: "src/lib/generateMonthlySummaryDocx.ts", description: "توليد الخلاصة الشهرية: إنشاء ملف Word أفقي معقد للخلاصة الشهرية." },
      { file: "src/lib/exportMonthlySummaryExcel.ts", description: "تصدير الخلاصة الشهرية كملف Excel مع تنسيق احترافي باستخدام exceljs." },
      { file: "src/pages/SdiAnalysis.tsx", description: "تحليل منحة SDI: تبويب مالي لتحليل أوجه صرف منح المدرسة ضمن 5 مجالات (تعلم، صيانة، شراكة، تعلم عن بعد، تميز) مع فلترة بتاريخ بداية/نهاية، توزيع تلقائي لحركات SDI، وتصدير Excel مطابق للنموذج الرسمي." },
      { file: "public/templates/", description: "مجلد القوالب: يحتوي على ملفات Word الجاهزة التي يتم تعبئتها (مطالبة، تكليف، مشترى محلي، سند صرف)." },
    ],
  },
  {
    title: "واجهة المستخدم والتخطيط",
    icon: Layout,
    color: "text-cyan-500",
    items: [
      { file: "src/components/AppLayout.tsx", description: "التخطيط العام: يوفر الشريط الجانبي والمحتوى الرئيسي لجميع الصفحات." },
      { file: "src/components/AppSidebar.tsx", description: "الشريط الجانبي: قائمة التنقل مع روابط الصفحات وزر تسجيل الخروج وحقوق الملكية." },
      { file: "src/pages/SettingsPage.tsx", description: "صفحة الإعدادات: تعديل اسم المدرسة والمديرية وأعضاء اللجنة والشهر/السنة." },
      { file: "src/pages/InstructionsPage.tsx", description: "صفحة التعليمات: شرح الحركات المالية والمستندات المطلوبة لكل معاملة." },
      { file: "src/components/PrintVoucher.tsx", description: "مكون طباعة السندات: عرض السند بتنسيق قابل للطباعة." },
      { file: "src/pages/PresentationExport.tsx", description: "صفحة العرض التقديمي: تصدير عرض تقديمي PDF يشرح جميع الحركات والمعاملات المالية." },
    ],
  },
  {
    title: "الحماية والتشفير (Electron)",
    icon: Lock,
    color: "text-rose-500",
    items: [
      { file: "electron/main.cjs", description: "النافذة الرئيسية مع حماية شاملة: تعطيل DevTools في الإنتاج، حظر اختصارات (F12, Ctrl+Shift+I, Ctrl+U)، حذف قائمة البرنامج، وتطبيق Content Security Policy (CSP)." },
      { file: "electron/preload.cjs", description: "ملف التحميل المسبق: يوفر واجهة آمنة (contextBridge) بين Electron وصفحة الويب مع عزل السياق (contextIsolation)." },
      { file: "electron/scripts/obfuscate.cjs", description: "تشفير الكود (javascript-obfuscator): تطبيق حماية عالية المستوى تشمل Control Flow Flattening، Dead Code Injection، String Array Encoding، وSelf-Defending." },
      { file: "electron/scripts/generate-integrity.cjs", description: "فحص سلامة الملفات (Integrity Check): توليد SHA-256 hashes لجميع ملفات JS/CSS/HTML والتحقق منها عند بدء التشغيل لمنع التلاعب." },
      { file: "electron-builder.yml", description: "إعدادات التجميع: تفعيل ASAR Encryption لتشفير ملفات المصدر داخل حزمة واحدة محمية مع منع فك التجميع." },
    ],
  },
  {
    title: "أمان قاعدة البيانات (RLS)",
    icon: KeyRound,
    color: "text-emerald-500",
    items: [
      { file: "RLS - profiles", description: "سياسات أمان جدول الملفات الشخصية: المستخدم يرى/يعدل ملفه فقط، الأدمن يملك صلاحيات كاملة (SELECT, INSERT, UPDATE, DELETE)." },
      { file: "RLS - school_credentials", description: "سياسات أمان بيانات الاعتماد: الأدمن فقط يمكنه عرض/إنشاء/حذف بيانات الدخول. المستخدمون العاديون لا يملكون أي صلاحية." },
      { file: "RLS - user_roles", description: "سياسات أمان الأدوار: الأدمن يدير جميع الأدوار، المستخدم يرى دوره فقط. الأدوار مخزنة في جدول منفصل لمنع تصعيد الصلاحيات." },
      { file: "has_role() function", description: "دالة SECURITY DEFINER للتحقق من الأدوار: تعمل بصلاحيات المالك لتجنب التكرار اللامتناهي في سياسات RLS." },
      { file: "Edge Functions Auth", description: "جميع الوظائف السحابية تتحقق من صلاحيات الأدمن قبل تنفيذ أي عملية حساسة (إنشاء/حذف مستخدمين)." },
    ],
  },
  {
    title: "تطبيق سطح المكتب (Electron)",
    icon: Monitor,
    color: "text-indigo-500",
    items: [
      { file: "electron/main.cjs", description: "الملف الرئيسي لـ Electron: إنشاء النافذة، تطبيق CSP، منع فتح نوافذ خارجية، فحص Integrity عند البدء." },
      { file: "electron/preload.cjs", description: "ملف التحميل المسبق: يوفر واجهة آمنة بين Electron وصفحة الويب." },
      { file: "electron-builder.yml", description: "إعدادات بناء ملف EXE: تحديد اسم التطبيق، ASAR، مجلد الإخراج، وخيارات التثبيت (NSIS)." },
      { file: ".github/workflows/build-windows.yml", description: "سير عمل GitHub Actions: بناء تلقائي لملف EXE مع خطوات التشفير وفحص السلامة." },
      { file: "package.json scripts", description: "أوامر البناء: electron:dev (تطوير)، electron:build (بناء كامل مع تشفير + integrity + تجميع)." },
    ],
  },
];

export default function CodeDocumentation() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">توثيق الكود البرمجي</h1>
            <p className="text-sm text-muted-foreground">شرح شامل لكل جزء من أجزاء البرمجية</p>
          </div>
        </div>

        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm text-foreground">
              <strong>ملاحظة:</strong> هذه الصفحة مخصصة للأدمن فقط وتعرض شرحاً مفصلاً لكل ملف ووظيفته في النظام.
              البيانات المالية تُحفظ محلياً على جهاز كل مستخدم (localStorage)، بينما بيانات الحسابات والمصادقة تُحفظ في قاعدة البيانات السحابية.
            </p>
          </CardContent>
        </Card>

        {/* Security Summary Card */}
        <Card className="shadow-card border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-emerald-500" />
              <strong className="text-foreground">ملخص طبقات الحماية المُفعّلة</strong>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {[
                "✅ Row Level Security (RLS)",
                "✅ Edge Functions للعمليات الحساسة",
                "✅ javascript-obfuscator تشفير الكود",
                "✅ ASAR Encryption تجميع الملفات",
                "✅ تعطيل DevTools (F12)",
                "✅ حذف قائمة البرنامج",
                "✅ حظر اختصارات لوحة المفاتيح",
                "✅ Integrity Check فحص سلامة الملفات",
                "✅ Content Security Policy (CSP)",
              ].map((item) => (
                <Badge key={item} variant="outline" className="justify-start py-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {sections.map((section) => (
          <Card key={section.title} className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <section.icon className={`w-5 h-5 ${section.color}`} />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item, idx) => (
                <div key={idx}>
                  {idx > 0 && <Separator className="my-2" />}
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="font-mono text-xs shrink-0 mt-0.5">{item.file}</Badge>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
