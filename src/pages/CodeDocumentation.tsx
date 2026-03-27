import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Code, Database, Shield, FileText, Layout, Server, Monitor, FolderTree, Lock, KeyRound, MessageSquare, Users, Smartphone, Globe } from "lucide-react";

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
      { file: "src/App.tsx", description: "الملف الرئيسي: يحتوي على تعريف المسارات (Routes) وحماية الصفحات (ProtectedRoute/AdminRoute) ومزودات السياق (Providers). يحدد أي صفحات يراها المستخدم العادي وأيها للأدمن فقط." },
      { file: "src/main.tsx", description: "نقطة الدخول: يقوم بتحميل تطبيق React وربطه بعنصر root في الصفحة. يلف التطبيق بـ QueryClientProvider و BrowserRouter." },
      { file: "src/index.css", description: "ملف التنسيق العام: يحتوي على متغيرات الألوان (CSS Variables) ونظام التصميم (Design System) للوضع الفاتح والداكن. جميع الألوان بصيغة HSL." },
      { file: "vite.config.ts", description: "إعدادات Vite: أداة بناء المشروع، تحدد المنافذ والاختصارات (aliases مثل @ → src) والإضافات (plugins). base: './' مطلوب لتشغيل Electron." },
      { file: "tailwind.config.ts", description: "إعدادات Tailwind CSS: تعريف الألوان والخطوط والأنماط المخصصة. الألوان مرتبطة بمتغيرات CSS في index.css لدعم الثيمات." },
      { file: "tsconfig.app.json", description: "إعدادات TypeScript: تحدد قواعد الترجمة والمسارات والأنواع المسموحة." },
      { file: "components.json", description: "إعدادات shadcn/ui: يحدد مسارات المكونات والأنماط المستخدمة في مكتبة واجهة المستخدم." },
    ],
  },
  {
    title: "المصادقة وإدارة المستخدمين",
    icon: Shield,
    color: "text-red-500",
    items: [
      { file: "src/hooks/useAuth.tsx", description: "هوك المصادقة الرئيسي: يدير حالة تسجيل الدخول عبر onAuthStateChange، يتحقق من الدور (admin/school) بالاستعلام من user_roles، يفحص الاشتراك من profiles، ويقفل الحساب بعد 5 محاولات خاطئة باستخدام localStorage." },
      { file: "src/pages/Auth.tsx", description: "صفحة تسجيل الدخول: واجهة بسيطة لإدخال البريد وكلمة المرور. تستخدم supabase.auth.signInWithPassword ولا تسمح بالتسجيل الذاتي (الأدمن فقط ينشئ الحسابات)." },
      { file: "src/pages/AdminUsers.tsx", description: "لوحة إدارة المستخدمين (أدمن فقط): تستدعي Edge Functions (create-school-user, delete-school-user) لإنشاء/حذف حسابات المدارس. تعرض بيانات الدخول من school_credentials وتدير الاشتراكات." },
      { file: "src/components/SubscriptionExpired.tsx", description: "مكون انتهاء الاشتراك: يظهر تلقائياً عندما يكون subscription_expires_at < now() ويمنع الوصول للبرنامج." },
      { file: "src/components/ChangePasswordDialog.tsx", description: "نافذة تغيير كلمة المرور: تستدعي Edge Function (change-password) لتغيير الكلمة بشكل آمن مع تحديث school_credentials." },
    ],
  },
  {
    title: "قاعدة البيانات السحابية",
    icon: Database,
    color: "text-green-500",
    items: [
      { file: "src/integrations/supabase/client.ts", description: "عميل الاتصال: يتم إنشاؤه تلقائياً من Lovable Cloud. لا يُعدّل يدوياً أبداً. يستخدم VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY من .env." },
      { file: "src/integrations/supabase/types.ts", description: "أنواع البيانات المولّدة تلقائياً: تعكس هيكل الجداول الحالي (profiles, school_credentials, user_roles) والـ Enums (app_role: admin|school) والدوال (has_role)." },
      { file: "جدول profiles", description: "بيانات المستخدمين: id (مرتبط بـ auth.users)، school_name، is_active، subscription_expires_at، created_at، updated_at. يُنشأ تلقائياً عبر trigger handle_new_user." },
      { file: "جدول school_credentials", description: "بيانات الدخول النصية: email + password_plain + user_id. يُنشأ بواسطة Edge Function فقط. الأدمن فقط يراه (RLS). الهدف: عرض كلمات المرور للمدارس في لوحة الأدمن." },
      { file: "جدول user_roles", description: "أدوار المستخدمين: user_id + role (admin|school). منفصل عن profiles لمنع تصعيد الصلاحيات. يُستخدم مع دالة has_role() في جميع سياسات RLS." },
      { file: "handle_new_user() trigger", description: "يعمل تلقائياً عند تسجيل مستخدم جديد في auth.users: ينشئ صف في profiles مع school_name من metadata." },
      { file: "update_updated_at_column()", description: "trigger يحدّث حقل updated_at تلقائياً عند تعديل أي صف في profiles." },
    ],
  },
  {
    title: "الوظائف السحابية (Edge Functions)",
    icon: Server,
    color: "text-purple-500",
    items: [
      { file: "supabase/functions/setup-admin", description: "إعداد حساب الأدمن: POST يستقبل email + password. يتحقق أنه لا يوجد أدمن مسبقاً، ينشئ الحساب عبر admin.createUser، يضيف الدور في user_roles، ويحدّث profile. يُستخدم مرة واحدة فقط." },
      { file: "supabase/functions/create-school-user", description: "إنشاء حساب مدرسة: يتحقق أن الطالب أدمن (has_role)، ينشئ حساب عبر admin.createUser مع email_confirm: true، يضيف دور 'school'، يحفظ credentials، ويحدّث subscription_expires_at." },
      { file: "supabase/functions/delete-school-user", description: "حذف حساب مدرسة: يتحقق من صلاحية الأدمن ويمنع حذف حسابات الأدمن. يحذف من auth.users (الباقي يُحذف cascade)." },
      { file: "supabase/functions/change-password", description: "تغيير كلمة المرور: يقبل userId + newPassword. يتحقق أن المستخدم هو نفسه أو أدمن، يستخدم admin.updateUserById، ويحدّث password_plain في school_credentials." },
      { file: "supabase/functions/sms-proxy", description: "وسيط SMS: يمرر طلبات SMS من المتصفح إلى API تطبيق SMSGate (سحابي أو محلي) لتجاوز قيود CORS. يدعم GET (اختبار) و POST (إرسال). يقرأ بيانات المصادقة من headers مخصصة (x-sms-auth, x-sms-mode, x-sms-server)." },
    ],
  },
  {
    title: "نظام غياب الطلبة",
    icon: Users,
    color: "text-teal-500",
    items: [
      { file: "src/pages/StudentAbsencePage.tsx", description: "الصفحة الرئيسية: تحتوي على تبويبات (رصد الغياب، إدارة الطلبة، التقارير، الإحصائيات، غياب المعلمين، إعدادات SMS). تمرر userId و schoolName لجميع المكونات الفرعية." },
      { file: "src/components/studentAbsence/DailyAbsenceTracker.tsx", description: "رصد الغياب اليومي: يعرض الطلاب حسب الصف/التاريخ، يحفظ الغياب في localStorage مع absenceKey مرتبط بـ userId. يدعم إرسال SMS فردي (sendIndividualSmsGateway) وجماعي (sendBulkSmsMultiGateway) وواتساب فردي وجماعي (وضع آمن)." },
      { file: "src/components/studentAbsence/StudentManager.tsx", description: "إدارة الطلاب: إضافة/تعديل/حذف طلاب مع بيانات (الاسم، الصف، الشعبة، ولي الأمر، الرقم). يدعم استيراد CSV. حقل الفرع يظهر للصفوف 11-12 فقط مع نظام تعلم ذاتي (self-learning) يحفظ القيم المدخلة كاقتراحات." },
      { file: "src/components/studentAbsence/AbsenceReports.tsx", description: "تقارير الغياب: تجميع سجلات الغياب لكل طالب مع عدد الأيام وتنبيه ⚠️ عند تجاوز 10 أيام. تصدير Word/Excel." },
      { file: "src/components/studentAbsence/AbsenceStatistics.tsx", description: "إحصائيات الغياب: تحليل على مستوى المدرسة/الصف/الشعبة مع نسب مئوية وتنبيهات لونية عند تجاوز 20%." },
      { file: "src/components/TeacherAbsenceTracker.tsx", description: "غياب المعلمين: رصد غياب المعلمين اليومي مع تقارير شهرية." },
      { file: "src/types/studentAbsence.ts", description: "أنواع البيانات: StudentInfo (بيانات الطالب)، StudentAbsenceRecord (سجل غياب). مفاتيح localStorage: STUDENTS_LIST_KEY و STUDENT_STORAGE_KEY مرتبطة بـ userId." },
    ],
  },
  {
    title: "بوابة SMS والمراسلة",
    icon: Smartphone,
    color: "text-emerald-500",
    items: [
      { file: "src/lib/smsGateway.ts", description: "المكتبة الأساسية لـ SMS: تدعم عدة بوابات (Multi-Gateway Profiles) مع توزيع Round-Robin. تحفظ الإعدادات في localStorage. تدعم وضعين: سحابي (Cloud عبر api.sms-gate.app) ومحلي (LAN عبر IP مباشر). جميع الطلبات تمر عبر Edge Function (sms-proxy)." },
      { file: "loadGatewayProfiles()", description: "يحمّل جميع بوابات SMS المحفوظة. يدعم الترقية التلقائية من الإعداد القديم (single config) إلى النظام الجديد (multi-profile)." },
      { file: "sendSmsViaGateway()", description: "إرسال رسالة واحدة: يبني طلب POST مع headers مخصصة (x-sms-auth للمصادقة Base64، x-sms-mode، x-sms-server) ويرسلها عبر sms-proxy Edge Function. يدعم تحديد simNumber للهواتف ذات الشريحتين." },
      { file: "sendBulkSmsMultiGateway()", description: "الإرسال الجماعي: يوزع الرسائل بالتناوب (Round-Robin) على جميع البوابات المتاحة. مثال: 30 رسالة + 3 هواتف = 10 رسائل لكل هاتف. يدعم onProgress callback لإظهار تقدم الإرسال." },
      { file: "testGatewayConnection()", description: "اختبار الاتصال: يرسل طلب GET عبر sms-proxy مع x-sms-action: test للتحقق من أن البوابة تعمل." },
      { file: "src/components/studentAbsence/SmsGatewaySettings.tsx", description: "واجهة إعدادات SMS: تدعم إضافة/تعديل/حذف عدة هواتف (GatewayProfileCard). كل بوابة لها اسم ووضع اتصال وبيانات مصادقة وخيار SIM. تتضمن دليل إعداد كامل (SmsInstructions) وأزرار تحميل التطبيق." },
      { file: "وضع واتساب الآمن", description: "في DailyAbsenceTracker: يفتح محادثات واتساب واحدة تلو الأخرى عبر wa.me links مع تحويل تلقائي للأرقام الأردنية (07xx → 962xx). يمنع الحظر من واتساب مقارنة بالفتح الجماعي." },
      { file: "supabase/functions/sms-proxy", description: "Edge Function وسيطة: تتجاوز CORS عن طريق استقبال الطلبات من المتصفح وتمريرها إلى SMSGate API. في الوضع السحابي ترسل إلى https://api.sms-gate.app/3rdparty/v1، وفي المحلي ترسل إلى عنوان IP المحلي." },
    ],
  },
  {
    title: "ربط منصة أجيال (Ajyal Integration)",
    icon: Globe,
    color: "text-lime-500",
    items: [
      { file: "src/components/studentAbsence/AjyalIntegration.tsx", description: "واجهة ربط أجيال: تبويب داخل صفحة غياب الطلبة يتيح إدخال بيانات حساب أجيال (username + password) وفتح نافذة مضمّنة لتسجيل الدخول. بعد إدخال OTP يدوياً والتأكيد، يمكن تعبئة غياب اليوم تلقائياً بضغطة زر." },
      { file: "electron/main.cjs (Ajyal handlers)", description: "IPC Handlers في Electron: ajyal-open-window يفتح BrowserWindow لصفحة login أجيال ويحقن credentials تلقائياً. ajyal-check-login يفحص إذا اكتمل الدخول. ajyal-submit-absence يحقن JavaScript في النافذة للبحث عن الطالب وتسجيل غيابه." },
      { file: "electron/preload.cjs (ajyal API)", description: "واجهة IPC آمنة: يوفر electronAPI.ajyal مع 4 دوال (openWindow, checkLogin, submitAbsence, closeWindow) عبر contextBridge. يمنع الوصول المباشر لـ Node.js." },
      { file: "آلية التعبئة التلقائية", description: "عند الضغط على 'تعبئة الغياب تلقائياً' في البرمجية، يتم حقن executeJavaScript في نافذة أجيال المفتوحة للبحث عن اسم الطالب في الصفحة وتعبئة checkbox الغياب. يتم إرسال الطلاب واحداً تلو الآخر مع تأخير 1.5 ثانية بينهم." },
      { file: "أمان بيانات أجيال", description: "بيانات الدخول تُحفظ في localStorage على جهاز المستخدم فقط (بمفتاح ajyal_credentials_{userId}). لا تُرسل لأي سيرفر خارجي. CSP في Electron محدّث للسماح بتحميل ajyal.edu.jo فقط." },
    ],
  },
  {
    title: "إدارة البيانات المالية (محلي)",
    icon: FileText,
    color: "text-amber-500",
    items: [
      { file: "src/context/FinanceContext.tsx", description: "سياق البيانات المالية (Context + Provider): يدير الحركات (transactions)، الأرصدة الافتتاحية (openingBalances)، والإعدادات (settings). البيانات تُحفظ في localStorage مرتبطة بمعرف المستخدم (userId). يوفر دوال CRUD وحساب الأرصدة تلقائياً." },
      { file: "src/types/finance.ts", description: "أنواع البيانات المالية: Transaction (حركة مالية مع 9 أعمدة محاسبية)، OpeningBalance (أرصدة افتتاحية)، FinanceSettings (إعدادات المدرسة). الحسابات: صندوق، تبرعات، أنشطة، SDI، رياضة، سلفة، بنك، إيداع، شيكات." },
      { file: "src/pages/CashBook.tsx", description: "دفتر الصندوق: عرض جدول الحركات المالية مع فلترة بالتاريخ والنوع. تصدير Word عبر generatePaymentVoucherDocx." },
      { file: "src/pages/TransactionPage.tsx", description: "إدخال الحركات: نموذج لإضافة/تعديل حركة مالية مع تحديد النوع (قبض/صرف/قيد/سلفة)، الحسابات (من/إلى)، المبالغ لكل عمود، والملاحظات." },
      { file: "src/pages/MonthlySummary.tsx", description: "الخلاصة الشهرية: ملخص الأرصدة والحركات. تصدير Word (generateMonthlySummaryDocx) و Excel (exportMonthlySummaryExcel)." },
      { file: "src/pages/Index.tsx", description: "لوحة التحكم: إحصائيات سريعة (إجمالي القبض/الصرف، أرصدة الحسابات). الصفحة الأولى بعد تسجيل الدخول." },
    ],
  },
  {
    title: "المعاملات المالية والقوالب",
    icon: FileText,
    color: "text-orange-500",
    items: [
      { file: "src/pages/FinancialForms.tsx", description: "صفحة المعاملات المالية: نماذج المطالبة المالية، قرار التكليف، وطلب المشترى المحلي مع حفظ الطلبات في localStorage." },
      { file: "src/lib/fillFinancialForms.ts", description: "تعبئة القوالب: يحمّل ملفات Word من public/templates/ ويعبئها ببيانات المستخدم باستخدام docxtemplater. يعالج الأقواس المكسورة (split tags) في القوالب." },
      { file: "src/lib/generatePaymentVoucherDocx.ts", description: "توليد سند الصرف: ينشئ ملف Word برمجياً باستخدام مكتبة docx مع جداول وتنسيق رسمي." },
      { file: "src/lib/generateJournalVoucherDocx.ts", description: "توليد سند القيد: مشابه لسند الصرف مع اختلاف في البنية والحقول." },
      { file: "src/lib/generateLocalPurchaseDocx.ts", description: "طلب المشترى المحلي: جدول ديناميكي مع أعمدة فرعية (دينار/فلس) وحساب المجموع تلقائياً." },
      { file: "src/lib/generateMonthlySummaryDocx.ts", description: "الخلاصة الشهرية Word: ملف أفقي (landscape) معقد بـ 9 أعمدة محاسبية + مجاميع." },
      { file: "src/lib/exportMonthlySummaryExcel.ts", description: "الخلاصة الشهرية Excel: تنسيق احترافي باستخدام exceljs مع دمج خلايا وحدود وألوان." },
      { file: "src/pages/SdiAnalysis.tsx", description: "تحليل منحة SDI: فلترة حركات SDI بتاريخ، توزيعها على 5 مجالات (تعلم 30%، صيانة 30%، شراكة 10%، تعلم عن بعد 20%، تميز 10%)، تصدير Excel بالنموذج الرسمي." },
      { file: "src/lib/generateAdvanceInvoicesDocx.ts", description: "كشوف السلف: توليد مستند Word لكشف تسديد السلفة." },
      { file: "public/templates/", description: "مجلد القوالب: ملفات Word جاهزة (مطالبة، تكليف، مشترى محلي، سند صرف) تُعبأ بـ docxtemplater." },
    ],
  },
  {
    title: "الجدول المدرسي",
    icon: Layout,
    color: "text-cyan-500",
    items: [
      { file: "src/context/TimetableContext.tsx", description: "سياق الجدول: يدير بيانات المعلمين والحصص والإعدادات. يحفظ في localStorage مرتبط بـ userId. يتضمن خوارزمية التوليد التلقائي مع منع التعارض وضغط الفراغات." },
      { file: "src/types/timetable.ts", description: "أنواع البيانات: Teacher (معلم + مواد)، TimetableEntry (حصة في خانة)، BlockedPeriod (فترة محظورة). الجدول مصفوفة ثلاثية الأبعاد [صف][يوم][حصة]." },
      { file: "src/components/timetable/TeacherManager.tsx", description: "إدارة المعلمين: إضافة/تعديل/حذف + استيراد Excel. حقل الفرع يظهر للصف 12 فقط مع self-learning." },
      { file: "src/components/timetable/TimetableGrid.tsx", description: "شبكة الجدول: عرض جدول الصف أو المعلم مع دعم السحب والإفلات (drag & drop) لتبديل الحصص. يفحص التعارض قبل التبديل." },
      { file: "src/components/timetable/MalhafaView.tsx", description: "الملحفة التفاعلية: عرض شامل لجدول المدرسة كاملة في جدول واحد كبير مع drag & drop." },
      { file: "src/components/timetable/TimetableStatistics.tsx", description: "إحصائيات الجدول: مخططات بيانية (recharts) لتوزيع الحصص لكل صف ومادة." },
      { file: "src/components/timetable/DailyScheduleManager.tsx", description: "الجدول اليومي: اختيار يوم + تحديد المعلمين الغائبين → توليد جدول يومي مع مناوبين. تصدير Word/Excel." },
      { file: "src/components/timetable/BlockedPeriodsEditor.tsx", description: "الفترات المحظورة: تحديد أوقات لا يمكن فيها تعيين حصص لمعلم معين." },
      { file: "src/lib/exportTimetableExcel.ts", description: "تصدير الجدول Excel: بتنسيق مخصص لكل صف أو معلم أو المدرسة كاملة." },
      { file: "src/lib/exportTimetableDocx.ts", description: "تصدير الجدول Word: مع ترويسة رسمية وشعار الوزارة." },
    ],
  },
  {
    title: "واجهة المستخدم والتخطيط",
    icon: Layout,
    color: "text-sky-500",
    items: [
      { file: "src/components/AppLayout.tsx", description: "التخطيط العام: يوفر SidebarProvider + SidebarInset لجميع الصفحات. يتحكم في عرض/إخفاء الشريط الجانبي." },
      { file: "src/components/AppSidebar.tsx", description: "الشريط الجانبي: قائمة التنقل مع أيقونات لكل صفحة، زر تسجيل الخروج، وحقوق الملكية. يُخفي صفحات الأدمن عن المستخدم العادي." },
      { file: "src/components/NavLink.tsx", description: "رابط تنقل: مكون يعرض رابط مع أيقونة وتمييز الصفحة الحالية." },
      { file: "src/pages/SettingsPage.tsx", description: "صفحة الإعدادات: تعديل بيانات المدرسة والمديرية والأعضاء. تحفظ في FinanceContext." },
      { file: "src/components/PrintVoucher.tsx", description: "طباعة السندات: عرض السند بتنسيق جاهز للطباعة مع window.print()." },
      { file: "src/pages/PresentationExport.tsx", description: "تصدير عرض تقديمي: يستخدم pptxgenjs لإنشاء ملف PowerPoint يشرح الحركات والمعاملات." },
      { file: "src/components/ImportMappingDialog.tsx", description: "واجهة مطابقة الأعمدة: عند استيراد Excel/Word تظهر نافذة لربط أعمدة الملف بحقول النظام مع اقتراح تلقائي وحفظ القالب." },
      { file: "src/components/NetworkModeSelector.tsx", description: "اختيار وضع الشبكة: واجهة لاختيار (منفرد/رئيسي/فرعي) مع عرض عنوان IP الجهاز الحالي." },
    ],
  },
  {
    title: "الشبكة المحلية (LAN)",
    icon: Server,
    color: "text-violet-500",
    items: [
      { file: "src/context/NetworkContext.tsx", description: "سياق الشبكة: يدير وضع التشغيل (standalone/master/slave) وعنوان IP السيرفر. في وضع slave يستعلم البيانات من الجهاز الرئيسي." },
      { file: "src/hooks/useLanStorage.ts", description: "هوك تخزين LAN: يوفر واجهة موحدة للقراءة/الكتابة سواء محلياً (localStorage) أو عبر الشبكة (HTTP إلى الجهاز الرئيسي)." },
      { file: "electron/lan-server.cjs", description: "سيرفر LAN (Electron فقط): يفتح منفذ HTTP محلي لمشاركة البيانات مع الأجهزة الفرعية على نفس الشبكة." },
      { file: "electron/lan-client.cjs", description: "عميل LAN (Electron فقط): يتصل بالسيرفر الرئيسي لاستقبال/إرسال البيانات." },
      { file: "electron/lan-database.cjs", description: "قاعدة بيانات محلية: تخزين مؤقت للبيانات على مستوى الشبكة المحلية." },
    ],
  },
  {
    title: "الحماية والتشفير (Electron)",
    icon: Lock,
    color: "text-rose-500",
    items: [
      { file: "electron/main.cjs", description: "النافذة الرئيسية: تعطيل DevTools في الإنتاج، حظر اختصارات (F12, Ctrl+Shift+I, Ctrl+U)، حذف قائمة البرنامج (setMenu(null))، تطبيق Content Security Policy." },
      { file: "electron/preload.cjs", description: "التحميل المسبق: contextBridge يوفر واجهة آمنة بين Electron وصفحة الويب مع contextIsolation: true. يمنع الوصول المباشر لـ Node.js من الصفحة." },
      { file: "electron/scripts/obfuscate.cjs", description: "تشفير الكود (اختياري/يدوي): javascript-obfuscator مع Control Flow Flattening، Dead Code Injection، String Array Encoding، وSelf-Defending. مستبعد من CI/CD لتجنب مشاكل." },
      { file: "electron/scripts/generate-integrity.cjs", description: "فحص السلامة: توليد SHA-256 hashes لجميع ملفات JS/CSS/HTML. عند بدء التشغيل يُقارن كل ملف بالبصمة المسجلة لمنع التلاعب." },
      { file: "electron-builder.yml", description: "إعدادات التجميع: ASAR Encryption لتشفير الملفات المصدرية داخل حزمة واحدة محمية + إعدادات NSIS installer." },
    ],
  },
  {
    title: "أمان قاعدة البيانات (RLS)",
    icon: KeyRound,
    color: "text-emerald-500",
    items: [
      { file: "RLS - profiles", description: "المستخدم يرى/يعدل ملفه فقط (id = auth.uid()). الأدمن يملك صلاحيات كاملة عبر has_role(auth.uid(), 'admin')." },
      { file: "RLS - school_credentials", description: "الأدمن فقط يمكنه SELECT/INSERT/DELETE. لا يوجد UPDATE policy (لأمان إضافي). المستخدمون العاديون لا يملكون أي صلاحية." },
      { file: "RLS - user_roles", description: "الأدمن يدير جميع الأدوار (ALL). المستخدم يرى دوره فقط (SELECT where user_id = auth.uid()). الأدوار في جدول منفصل لمنع privilege escalation." },
      { file: "has_role() function", description: "SECURITY DEFINER function: تنفّذ بصلاحيات مالكها (postgres) لتجنب infinite recursion في RLS policies. تستعلم من user_roles مباشرة." },
      { file: "Edge Functions Auth", description: "كل Edge Function تتحقق من: 1) وجود Authorization header 2) صحة الـ JWT 3) أن المستخدم admin عبر has_role() قبل تنفيذ أي عملية حساسة." },
    ],
  },
  {
    title: "تطبيق سطح المكتب (Electron)",
    icon: Monitor,
    color: "text-indigo-500",
    items: [
      { file: "electron/main.cjs", description: "الملف الرئيسي: BrowserWindow يحمّل dist/index.html. يطبق CSP، يمنع فتح نوافذ خارجية (setWindowOpenHandler)، يفحص Integrity عند البدء." },
      { file: "electron/updater.cjs", description: "التحديث التلقائي: electron-updater يتحقق من GitHub Releases بعد 5 ثوانٍ. يرسل أحداث IPC (checking/available/downloading/downloaded) لعرض حالة التحديث في الواجهة." },
      { file: "src/components/UpdateNotification.tsx", description: "واجهة التحديث: تعرض حالة التحديث (تحقق/تنزيل/جاهز) مع زر إعادة التشغيل للتثبيت." },
      { file: ".github/workflows/build-windows.yml", description: "CI/CD: GitHub Actions يبني ملف EXE تلقائياً عند push tag جديد. خطوات: install → build → integrity → package → upload release." },
      { file: "electron-builder.yml + package.json", description: "أوامر البناء: electron:dev (تطوير مع hot-reload)، electron:build (بناء كامل). NSIS installer يسمح بالتثبيت لكل مستخدم أو للجميع." },
    ],
  },
  {
    title: "ملفات التصدير والتقارير",
    icon: FileText,
    color: "text-pink-500",
    items: [
      { file: "src/lib/exportStudentList.ts", description: "تصدير قائمة الطلاب: Word مع تجميع حسب الصف (grouped tables) وترويسة رسمية." },
      { file: "src/lib/exportStudentAbsence.ts", description: "تصدير سجل الغياب: Word/Excel مع تصنيف الحالة (⚠️ إنذار عند 10+ أيام)." },
      { file: "src/lib/exportAbsenceReport.ts", description: "تقارير الغياب المفصلة: Word مع جدول لكل طالب يوضح تواريخ غيابه." },
      { file: "src/lib/exportAbsenceStatistics.ts", description: "تصدير الإحصائيات: Excel مع نسب ومعدلات الغياب لكل مستوى." },
      { file: "src/lib/exportDailySchedule.ts", description: "تصدير الجدول اليومي: Word مع جدول المناوبين والحصص البديلة." },
      { file: "src/lib/exportTimetableStatistics.ts", description: "تصدير إحصائيات الجدول: كشف أنصبة المعلمين بالمواد وعدد الحصص." },
      { file: "src/lib/exportPresentation.ts", description: "تصدير عرض تقديمي PowerPoint: شرح مرئي للحركات والمعاملات المالية باستخدام pptxgenjs." },
      { file: "src/lib/fillSecretaryForms.ts", description: "تعبئة نماذج السكرتارية: استجواب، إجازة عرضية، عدم صرف مع بيانات تلقائية." },
      { file: "src/lib/generateCommitteeDocx.ts", description: "كتاب تشكيل اللجنة: Word رسمي مع ترويسة الوزارة والمديرية وجدول الأعضاء." },
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
            <h1 className="text-2xl font-bold text-foreground">توثيق الكود البرمجي - الادارة المدرسية</h1>
            <p className="text-sm text-muted-foreground">شرح شامل لكل جزء من أجزاء البرمجية وارتباطاته</p>
          </div>
        </div>

        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm text-foreground">
              <strong>ملاحظة:</strong> هذه الصفحة مخصصة للأدمن فقط وتعرض شرحاً مفصلاً لكل ملف ووظيفته في النظام.
              البيانات المالية وبيانات الطلاب والجدول تُحفظ محلياً على جهاز كل مستخدم (localStorage مرتبطة بـ userId)،
              بينما بيانات الحسابات والمصادقة والأدوار تُحفظ في قاعدة البيانات السحابية.
            </p>
          </CardContent>
        </Card>

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

        <Card className="shadow-card border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-blue-500" />
              <strong className="text-foreground">خريطة تدفق البيانات</strong>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>📱 <strong>المتصفح/Electron</strong> → React Components → Context/Hooks → localStorage (بيانات مالية + طلاب + جدول)</p>
              <p>☁️ <strong>المصادقة</strong> → Supabase Auth → Edge Functions → Database (profiles + roles + credentials)</p>
              <p>📨 <strong>SMS</strong> → smsGateway.ts → sms-proxy Edge Function → SMSGate Cloud API → هاتف المستخدم → رسالة SMS</p>
              <p>🔗 <strong>أجيال</strong> → AjyalIntegration.tsx → IPC → Electron BrowserWindow → executeJavaScript → صفحة أجيال (تعبئة تلقائية)</p>
              <p>💬 <strong>واتساب</strong> → wa.me links مباشرة (بدون وسيط) مع تحويل تلقائي للأرقام</p>
              <p>📄 <strong>التصدير</strong> → مكتبات (docx + exceljs + pptxgenjs) → Blob → تحميل ملف</p>
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
