export interface BlockedPeriod {
  day: number;    // index in DAYS
  period: number; // 0-based period index
}

export interface Teacher {
  id: string;
  name: string;
  phone?: string; // رقم هاتف المعلم لإرسال رسائل تعديل الجدول
  subjects: SubjectAssignment[];
  blockedPeriods?: BlockedPeriod[]; // periods where teacher must be free
}

export interface SubjectAssignment {
  subjectName: string;
  className: string;     // e.g. "الأول", "الثاني"
  section: string;       // e.g. "أ", "ب"
  branch?: string;       // e.g. "علمي", "أدبي" for secondary classes
  periodsPerWeek: number;
}

export const SECONDARY_CLASSES = ["الثاني عشر"];

export interface TimetableCell {
  teacherId: string;
  teacherName: string;
  subjectName: string;
}

// timetable[className-section][dayIndex][periodIndex]
export type ClassTimetable = Record<string, (TimetableCell | null)[][]>;

export interface TimetableData {
  teachers: Teacher[];
  timetable: ClassTimetable;
  schoolName: string;
  daysCount: number;
  periodsPerDay: number;
}

export const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
export const MAX_PERIODS = 8;

/** المواد التي يمكن جعل حصصها متتالية (حصتين ورا بعض) عند تفعيل الخيار */
export const DOUBLE_PERIOD_SUBJECTS = ["المهارات الرقمية", "تربية مهنية"];

export const CLASS_NAMES = [
  "الأول", "الثاني", "الثالث", "الرابع", "الخامس",
  "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر"
];

export const SECTIONS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك"];

/** قائمة المواد الافتراضية (يمكن للمستخدم إضافة مواد جديدة) */
export const DEFAULT_SUBJECTS = [
  "تربية إسلامية",
  "لغة عربية",
  "لغة إنجليزية",
  "رياضيات",
  "علوم",
  "علوم أرض",
  "فيزياء",
  "كيمياء",
  "أحياء",
  "تاريخ",
  "جغرافيا",
  "تربية وطنية ومدنية",
  "تربية اجتماعية ووطنية",
  "تربية فنية",
  "تربية رياضية",
  "تربية مهنية",
  "المهارات الرقمية",
  "ثقافة مالية",
  "علوم حياتية",
  "نشاط",
];

/** خريطة توحيد أسماء المواد المتشابهة */
export const SUBJECT_ALIASES: Record<string, string> = {
  "حاسوب": "المهارات الرقمية",
  "الحاسوب": "المهارات الرقمية",
  "مهارات رقمية": "المهارات الرقمية",
  "اللغة العربية": "لغة عربية",
  "اللغة الإنجليزية": "لغة إنجليزية",
  "اللغة الانجليزية": "لغة إنجليزية",
  "لغة انجليزية": "لغة إنجليزية",
  "التربية الإسلامية": "تربية إسلامية",
  "التربية الفنية": "تربية فنية",
  "التربية الرياضية": "تربية رياضية",
  "التربية المهنية": "تربية مهنية",
  "الرياضيات": "رياضيات",
  "العلوم": "علوم",
  "التاريخ": "تاريخ",
  "الجغرافيا": "جغرافيا",
  "الفيزياء": "فيزياء",
  "الكيمياء": "كيمياء",
  "الأحياء": "أحياء",
};

/** توحيد اسم المادة (إزالة التكرارات والمترادفات) */
export function normalizeSubjectName(name: string): string {
  const trimmed = name.trim();
  return SUBJECT_ALIASES[trimmed] || trimmed;
}

export function getClassKey(className: string, section: string): string {
  return `${className}-${section}`;
}

export function parseClassKey(key: string): { className: string; section: string } {
  const parts = key.split("-");
  return { className: parts[0], section: parts[1] };
}

/** ===== حصص النشاط ===== */
export const ACTIVITY_TEACHER_ID = "__activity__";
export const ACTIVITY_SUBJECT = "نشاط";
/** الحصص المخصصة للنشاط: الثانية والثالثة (فهرس 1 و 2) */
export const ACTIVITY_PERIODS = [1, 2];
/** توزيع أيام النشاط حسب الصف: الأول-الرابع الأحد، الخامس-السابع الاثنين، الثامن-العاشر الثلاثاء */
export const ACTIVITY_DAY_BY_CLASS: Record<string, number> = {
  "الأول": 0, "الثاني": 0, "الثالث": 0, "الرابع": 0,
  "الخامس": 1, "السادس": 1, "السابع": 1,
  "الثامن": 2, "التاسع": 2, "العاشر": 2,
};

export function getActivityDay(className: string): number | undefined {
  return ACTIVITY_DAY_BY_CLASS[className.trim()];
}

export function isActivityCell(cell: { teacherId?: string } | null | undefined): boolean {
  return !!cell && cell.teacherId === ACTIVITY_TEACHER_ID;
}

/** تطبيع اسم الصف لمقارنة الترتيب (يزيل "الصف" والهمزات والمسافات الزائدة) */
export function normalizeClassName(name: string): string {
  return (name || "")
    .replace(/الصف/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

/** تطبيع رمز الشعبة (هـ / ه) */
export function normalizeSection(section: string): string {
  return (section || "").replace(/^ه$/, "هـ").trim();
}

/** مقارنة مفتاحي صف حسب الترتيب الدراسي: الأول أ، الأول ب... ثم الثاني... */
export function compareClassKeys(a: string, b: string): number {
  const ca = parseClassKey(a);
  const cb = parseClassKey(b);
  const norm = CLASS_NAMES.map(normalizeClassName);
  const ia = norm.indexOf(normalizeClassName(ca.className));
  const ib = norm.indexOf(normalizeClassName(cb.className));
  const ra = ia === -1 ? 999 : ia;
  const rb = ib === -1 ? 999 : ib;
  if (ra !== rb) return ra - rb;
  const sa = SECTIONS.indexOf(normalizeSection(ca.section));
  const sb = SECTIONS.indexOf(normalizeSection(cb.section));
  const xa = sa === -1 ? 999 : sa;
  const xb = sb === -1 ? 999 : sb;
  if (xa !== xb) return xa - xb;
  return a.localeCompare(b, "ar");
}
