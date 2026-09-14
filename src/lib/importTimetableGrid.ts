import type { Teacher, ClassTimetable, TimetableCell, SubjectAssignment } from "@/types/timetable";
import {
  DAYS,
  SECTIONS,
  MAX_PERIODS,
  ACTIVITY_SUBJECT,
  ACTIVITY_TEACHER_ID,
  getClassKey,
  compareClassKeys,
  normalizeSubjectName,
} from "@/types/timetable";

/**
 * استيراد "جدول ترتيب الدروس" (الملحفة الرسمية) من ملف Excel.
 *
 * شكل الملف المدعوم:
 *   - صف عناوين فيه "اليوم" و"الحصة" ثم اسم كل صف/شعبة فوق عمودين.
 *   - الصف الذي يليه فيه "الموضوع" و"المعلم" لكل صف دراسي.
 *   - بعدها صفوف البيانات: اليوم (يتكرر مرة واحدة لكل مجموعة) ثم اسم الحصة.
 *
 * ينتج: الملحفة كاملة كما في الملف + قائمة المعلمين وأنصبتهم محسوبة من الحصص.
 */

export interface ImportedFullTimetable {
  teachers: Teacher[];
  timetable: ClassTimetable;
  periodsPerDay: number;
  cellsCount: number;
}

const PERIOD_NAMES = [
  "الأولى", "الثانية", "الثالثة", "الرابعة",
  "الخامسة", "السادسة", "السابعة", "الثامنة",
];

function normalize(text: string) {
  return (text || "").replace(/\s+/g, " ").trim();
}

/** "الأول أ" / "الصف الحادي عشر ج" → { className, section } */
export function parseClassLabel(label: string): { className: string; section: string } | null {
  const cleaned = normalize(label).replace(/الصف/g, " ").replace(/[/\\]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const parts = cleaned.split(" ");
  const last = parts[parts.length - 1];
  if (parts.length > 1 && SECTIONS.includes(last)) {
    return { className: parts.slice(0, -1).join(" "), section: last };
  }
  return { className: cleaned, section: "أ" };
}

function periodIndexFromLabel(label: string, fallback: number): number {
  const text = normalize(label);
  if (!text) return fallback;
  const idx = PERIOD_NAMES.findIndex(name => text.includes(name));
  if (idx >= 0) return idx;
  const digits = Number(text.replace(/[^\d]/g, ""));
  if (digits >= 1 && digits <= MAX_PERIODS) return digits - 1;
  return fallback;
}

export function parseFullTimetableGrid(grid: string[][]): ImportedFullTimetable | null {
  // 1) تحديد صف العناوين
  let headRow = -1;
  for (let r = 0; r < grid.length - 1; r++) {
    const row = (grid[r] || []).map(normalize);
    const next = (grid[r + 1] || []).map(normalize);
    const hasDay = row.some(v => v === "اليوم");
    const hasPeriod = row.some(v => v === "الحصة");
    const hasSubjectTeacher = next.some(v => v === "الموضوع") && next.some(v => v === "المعلم");
    if (hasDay && hasPeriod && hasSubjectTeacher) { headRow = r; break; }
  }
  if (headRow < 0) return null;

  const labels = (grid[headRow] || []).map(normalize);
  const subHead = (grid[headRow + 1] || []).map(normalize);
  const dayCol = labels.findIndex(v => v === "اليوم");
  const periodCol = labels.findIndex(v => v === "الحصة");

  const classCols: { col: number; classKey: string }[] = [];
  subHead.forEach((value, col) => {
    if (value !== "الموضوع") return;
    const parsed = parseClassLabel(labels[col] || "");
    if (!parsed) return;
    classCols.push({ col, classKey: getClassKey(parsed.className, parsed.section) });
  });
  if (classCols.length === 0) return null;

  // 2) قراءة صفوف البيانات
  type Entry = { classKey: string; day: number; period: number; subjectName: string; teacherName: string };
  const entries: Entry[] = [];
  let currentDay = -1;
  let periodCursor = 0;
  let maxPeriod = 0;

  for (let r = headRow + 2; r < grid.length; r++) {
    const row = grid[r] || [];
    const dayText = normalize(row[dayCol] || "");
    const periodText = normalize(row[periodCol] || "");

    const dayIdx = DAYS.findIndex(d => dayText && dayText.includes(d));
    if (dayIdx >= 0) { currentDay = dayIdx; periodCursor = 0; }
    if (currentDay < 0) continue;
    if (!periodText && row.every(v => !normalize(v || ""))) continue;

    const period = periodIndexFromLabel(periodText, periodCursor);
    periodCursor = period + 1;
    if (period >= MAX_PERIODS) continue;

    let rowHasData = false;
    classCols.forEach(({ col, classKey }) => {
      const subjectName = normalizeSubjectName(normalize(row[col] || ""));
      const teacherName = normalize(row[col + 1] || "");
      if (!subjectName && !teacherName) return;
      if (!subjectName) return;
      rowHasData = true;
      entries.push({ classKey, day: currentDay, period, subjectName, teacherName });
    });
    if (rowHasData) maxPeriod = Math.max(maxPeriod, period + 1);
  }

  if (entries.length === 0) return null;

  const periodsPerDay = Math.min(MAX_PERIODS, Math.max(7, maxPeriod));

  // 3) بناء المعلمين
  const teacherByName = new Map<string, Teacher>();
  const getTeacher = (name: string): Teacher | null => {
    if (!name) return null;
    let teacher = teacherByName.get(name);
    if (!teacher) {
      teacher = { id: crypto.randomUUID(), name, subjects: [], blockedPeriods: [] };
      teacherByName.set(name, teacher);
    }
    return teacher;
  };

  // عدّ الحصص لكل (معلم | مادة | صف)
  const loadCount = new Map<string, number>();
  entries.forEach(entry => {
    if (!entry.teacherName) return;
    getTeacher(entry.teacherName);
    const key = `${entry.teacherName}|${entry.subjectName}|${entry.classKey}`;
    loadCount.set(key, (loadCount.get(key) || 0) + 1);
  });

  loadCount.forEach((periods, key) => {
    const [teacherName, subjectName, classKey] = key.split("|");
    const teacher = teacherByName.get(teacherName);
    if (!teacher) return;
    const [className, section] = classKey.split("-");
    const assignment: SubjectAssignment = { subjectName, className, section, periodsPerWeek: periods };
    teacher.subjects.push(assignment);
  });

  // 4) بناء الملحفة
  const classKeys = Array.from(new Set(classCols.map(c => c.classKey))).sort(compareClassKeys);
  const timetable: ClassTimetable = {};
  classKeys.forEach(ck => {
    timetable[ck] = Array.from({ length: DAYS.length }, () =>
      Array.from({ length: periodsPerDay }, () => null as TimetableCell | null)
    );
  });

  let cellsCount = 0;
  entries.forEach(({ classKey, day, period, subjectName, teacherName }) => {
    if (!timetable[classKey] || period >= periodsPerDay) return;
    const teacher = teacherName ? teacherByName.get(teacherName) : null;
    const isActivity = subjectName === ACTIVITY_SUBJECT;
    timetable[classKey][day][period] = {
      teacherId: isActivity ? ACTIVITY_TEACHER_ID : (teacher?.id || ""),
      teacherName: teacherName || "",
      subjectName,
    };
    cellsCount++;
  });

  const teachers = Array.from(teacherByName.values())
    .filter(t => t.subjects.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return { teachers, timetable, periodsPerDay, cellsCount };
}
