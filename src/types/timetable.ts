export interface BlockedPeriod {
  day: number;    // index in DAYS
  period: number; // 0-based period index
}

export interface Teacher {
  id: string;
  name: string;
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

export const SECONDARY_CLASSES = ["الحادي عشر", "الثاني عشر"];
export const BRANCHES = ["علمي", "أدبي", "صناعي", "زراعي", "فندقي", "اقتصاد منزلي", "تمريض", "شرعي"];

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
export const MAX_PERIODS = 7;

export const CLASS_NAMES = [
  "الأول", "الثاني", "الثالث", "الرابع", "الخامس",
  "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر"
];

export const SECTIONS = ["أ", "ب", "ج", "د", "هـ"];

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
  "حاسوب",
  "ثقافة مالية",
  "علوم حياتية",
];

export function getClassKey(className: string, section: string): string {
  return `${className}-${section}`;
}

export function parseClassKey(key: string): { className: string; section: string } {
  const parts = key.split("-");
  return { className: parts[0], section: parts[1] };
}
