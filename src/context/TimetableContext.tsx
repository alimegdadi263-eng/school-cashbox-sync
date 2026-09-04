import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Teacher, ClassTimetable, TimetableCell } from "@/types/timetable";
import { getClassKey, parseClassKey, CLASS_NAMES, SECTIONS, DAYS, MAX_PERIODS, DOUBLE_PERIOD_SUBJECTS, ACTIVITY_TEACHER_ID, ACTIVITY_SUBJECT, ACTIVITY_PERIODS, getActivityDay, isActivityCell, compareClassKeys } from "@/types/timetable";

export interface UnplacedPeriod {
  teacherId: string;
  teacherName: string;
  subjectName: string;
  classKey: string;
  count: number;
}

/** القيود الاختيارية للجدول — كل قيد يمكن تفعيله/تعطيله من تبويب "القيود" */
export interface TimetableConstraints {
  /** المهارات الرقمية / التربية المهنية حصتان متتاليتان (إلزامي عند التفعيل) */
  pairDoubleSubjects: boolean;
  /** حجز حصص النشاط (الثانية والثالثة) حسب الصف واليوم */
  activityPeriods: boolean;
  /** تركيز أيام تأخر المعلم (السادسة مع السابعة في نفس اليوم) */
  alignLateDays: boolean;
  /** تفضيل التربية الفنية/الرياضية في الحصة الثامنة */
  preferArtLastPeriod: boolean;
  /** إزالة الفراغات الداخلية بين الحصص */
  fillGaps: boolean;
  /** سقف متغير: الصفوف >35 حصة لها ثامنة، وغيرها 7 حصص */
  variablePeriodCap: boolean;
  /** مزامنة تلقائية: أي تعديل على المعلمين ينعكس على الجدول دون إعادة توليد */
  autoSyncTeachers: boolean;
  /** توزيع حصص المعلم بشكل متساوٍ قدر الإمكان على أيام الأسبوع */
  balanceTeacherDaily: boolean;
  /** منع تكرار نفس المادة أكثر من حصة في اليوم إلا إذا كان نصابها الأسبوعي أكثر من 5 */
  oneSubjectPerDay: boolean;
  /** الصفوف الأول والثاني والثالث: 5 حصص يومياً بالضبط */
  lowerGradesFivePeriods: boolean;
}

export const DEFAULT_CONSTRAINTS: TimetableConstraints = {
  pairDoubleSubjects: false,
  activityPeriods: false,
  alignLateDays: true,
  preferArtLastPeriod: true,
  fillGaps: true,
  variablePeriodCap: true,
  autoSyncTeachers: true,
  balanceTeacherDaily: true,
  oneSubjectPerDay: true,
  lowerGradesFivePeriods: true,
};


export interface SavedTimetable {
  id: string;
  name: string;
  createdAt: string;
  periodsPerDay: number;
  timetable: ClassTimetable;
  teachers: Teacher[];
}

interface TimetableContextType {
  teachers: Teacher[];
  timetable: ClassTimetable;
  unplacedPeriods: UnplacedPeriod[];
  periodsPerDay: number;
  setPeriodsPerDay: (n: number) => void;
  /** تفعيل جعل حصص المهارات الرقمية والتربية المهنية حصتين متتاليتين */
  pairDoubleSubjects: boolean;
  setPairDoubleSubjects: (v: boolean) => void;
  /** تفعيل حجز حصص النشاط (الثانية والثالثة) حسب الصف واليوم */
  activityPeriods: boolean;
  setActivityPeriods: (v: boolean) => void;
  constraints: TimetableConstraints;
  setConstraint: (key: keyof TimetableConstraints, value: boolean) => void;
  /** الجداول المحفوظة (نسخ يمكن الرجوع إليها) */
  savedTimetables: SavedTimetable[];
  saveCurrentTimetable: (name: string) => void;
  restoreSavedTimetable: (id: string) => boolean;
  deleteSavedTimetable: (id: string) => void;
  /** استيراد نسخ جداول محفوظة من ملف (JSON) */
  importSavedTimetables: (snaps: SavedTimetable[]) => number;

  addTeacher: (teacher: Teacher) => void;
  updateTeacher: (teacher: Teacher) => void;
  removeTeacher: (id: string) => void;
  setTimetable: (tt: ClassTimetable) => void;
  updateCell: (classKey: string, day: number, period: number, cell: TimetableCell | null) => void;
  swapCells: (classKey: string, day: number, period: number, periodA: number) => boolean;
  /** تبديل حصتين داخل نفس الصف حتى لو كانتا في يومين مختلفين (نقل يدوي حرّ) */
  swapCellsAcrossDays: (classKey: string, dayA: number, periodA: number, dayB: number, periodB: number) => boolean;
  moveCell: (classKey: string, fromDay: number, fromPeriod: number, toDay: number, toPeriod: number) => boolean;

  moveToStaging: (classKey: string, day: number, period: number) => boolean;
  placeFromStaging: (stagingIdx: number, classKey: string, day: number, period: number) => boolean;
  generateTimetable: () => void;
  getTeacherSchedule: (teacherId: string) => { classKey: string; day: number; period: number; subjectName: string }[];
  getAllClassKeys: () => string[];
  reorderClasses: () => void;
  clearTimetable: () => void;
  generateDailySchedule: (day: number, absentTeacherIds: string[]) => ClassTimetable;
}

const TimetableContext = createContext<TimetableContextType | null>(null);

const STORAGE_KEY = "school_timetable_data";
const DOUBLE_KEY = "school_timetable_pair_double";
const ACTIVITY_KEY = "school_timetable_activity_periods";
const CONSTRAINTS_KEY = "school_timetable_constraints";
const SNAPSHOTS_KEY = "school_timetable_snapshots";


function getElectronLanHelper() {
  return (window as any)?.electronAPI?.lan;
}

async function lanSyncSaveTimetable(data: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const lan = getElectronLanHelper();
  if (!lan) return;
  try {
    const conn = await lan.isConnected();
    if (conn?.connected) {
      await lan.setData(STORAGE_KEY, data);
    }
  } catch {}
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TimetableProvider({ children }: { children: React.ReactNode }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetable, setTimetableState] = useState<ClassTimetable>({});
  const [periodsPerDay, setPeriodsPerDayState] = useState(7);
  const [unplacedPeriods, setUnplacedPeriods] = useState<UnplacedPeriod[]>([]);
  const [constraints, setConstraintsState] = useState<TimetableConstraints>(() => {
    try {
      const raw = localStorage.getItem(CONSTRAINTS_KEY);
      if (raw) return { ...DEFAULT_CONSTRAINTS, ...JSON.parse(raw) };
    } catch {}
    // ترحيل الإعدادات القديمة
    let legacy: Partial<TimetableConstraints> = {};
    try {
      legacy = {
        pairDoubleSubjects: localStorage.getItem(DOUBLE_KEY) === "1",
        activityPeriods: localStorage.getItem(ACTIVITY_KEY) === "1",
      };
    } catch {}
    return { ...DEFAULT_CONSTRAINTS, ...legacy };
  });

  const [savedTimetables, setSavedTimetables] = useState<SavedTimetable[]>(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const persistConstraints = (c: TimetableConstraints) => {
    try {
      localStorage.setItem(CONSTRAINTS_KEY, JSON.stringify(c));
      localStorage.setItem(DOUBLE_KEY, c.pairDoubleSubjects ? "1" : "0");
      localStorage.setItem(ACTIVITY_KEY, c.activityPeriods ? "1" : "0");
    } catch {}
  };

  const setConstraint = (key: keyof TimetableConstraints, value: boolean) => {
    setConstraintsState(prev => {
      const next = { ...prev, [key]: value };
      persistConstraints(next);
      return next;
    });
  };

  const pairDoubleSubjects = constraints.pairDoubleSubjects;
  const activityPeriods = constraints.activityPeriods;
  const setPairDoubleSubjects = (v: boolean) => setConstraint("pairDoubleSubjects", v);
  const setActivityPeriods = (v: boolean) => setConstraint("activityPeriods", v);


  useEffect(() => {
    const loadData = async () => {
      const lan = getElectronLanHelper();
      let loaded = false;
      if (lan) {
        try {
          const conn = await lan.isConnected();
          if (conn?.connected) {
            const result = await lan.getData(STORAGE_KEY);
            if (result?.success && result.data) {
              setTeachers(result.data.teachers || []);
              setTimetableState(result.data.timetable || {});
              setPeriodsPerDayState(result.data.periodsPerDay || 7);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
              loaded = true;
            }
          }
        } catch {}
      }
      if (!loaded) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const data = JSON.parse(saved);
            setTeachers(data.teachers || []);
            setTimetableState(data.timetable || {});
            setPeriodsPerDayState(data.periodsPerDay || 7);
          }
        } catch (e) {
          console.error("Failed to load timetable data", e);
        }
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const lan = getElectronLanHelper();
    if (!lan) return;
    const timer = setInterval(async () => {
      try {
        const conn = await lan.isConnected();
        if (!conn?.connected) return;
        const result = await lan.getData(STORAGE_KEY);
        if (result?.success && result.data) {
          const currentStr = localStorage.getItem(STORAGE_KEY);
          const newStr = JSON.stringify(result.data);
          if (currentStr !== newStr) {
            setTeachers(result.data.teachers || []);
            setTimetableState(result.data.timetable || {});
            setPeriodsPerDayState(result.data.periodsPerDay || 7);
            localStorage.setItem(STORAGE_KEY, newStr);
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const save = useCallback((t: Teacher[], tt: ClassTimetable, ppd: number) => {
    const data = { teachers: t, timetable: tt, periodsPerDay: ppd };
    lanSyncSaveTimetable(data);
  }, []);

  /**
   * مزامنة الجدول الحالي مع بيانات المعلمين دون إعادة توليد:
   * 1) تحديث اسم المعلم في كل خاناته (تغيير الاسم ينعكس فوراً).
   * 2) حذف الخانات لمعلم لم يعد يدرّس هذه المادة لهذا الصف.
   * 3) حذف الحصص الزائدة عند تقليل عدد الحصص الأسبوعية.
   * 4) إضافة الحصص الناقصة في خانات فارغة بلا تعارض عند زيادة العدد.
   */
  const syncTimetableWithTeachers = useCallback((tt: ClassTimetable, list: Teacher[], ppd: number): ClassTimetable => {
    const next: ClassTimetable = {};
    for (const [ck, days] of Object.entries(tt)) {
      next[ck] = days.map(d => d.map(c => (c ? { ...c } : null)));
    }
    const byId = new Map(list.map(t => [t.id, t]));
    const required = new Map<string, number>();
    list.forEach(t => t.subjects.forEach(s => {
      const ck = getClassKey(s.className, s.section);
      required.set(`${t.id}|${s.subjectName}|${ck}`, s.periodsPerWeek);
      if (!next[ck]) next[ck] = Array.from({ length: DAYS.length }, () => Array(MAX_PERIODS).fill(null));
    }));

    const counts = new Map<string, { day: number; period: number }[]>();
    for (const [ck, days] of Object.entries(next)) {
      for (let d = 0; d < days.length; d++) {
        for (let p = 0; p < days[d].length; p++) {
          const cell = days[d][p];
          if (!cell || isActivityCell(cell)) continue;
          const teacher = byId.get(cell.teacherId);
          if (!teacher) { days[d][p] = null; continue; }
          if (teacher.name !== cell.teacherName) cell.teacherName = teacher.name;
          const key = `${cell.teacherId}|${cell.subjectName}|${ck}`;
          if (!required.has(key)) { days[d][p] = null; continue; }
          const arr = counts.get(key) || [];
          arr.push({ day: d, period: p });
          counts.set(key, arr);
        }
      }
    }

    // حذف الزائد
    for (const [key, spots] of counts.entries()) {
      const need = required.get(key) ?? 0;
      if (spots.length <= need) continue;
      const ck = key.split("|")[2];
      spots.slice(need).forEach(s => { next[ck][s.day][s.period] = null; });
      counts.set(key, spots.slice(0, need));
    }

    const teacherBusy = (teacherId: string, day: number, period: number) => {
      for (const days of Object.values(next)) {
        if (days[day]?.[period]?.teacherId === teacherId) return true;
      }
      return false;
    };

    // إضافة الناقص
    for (const [key, need] of required.entries()) {
      const [teacherId, subjectName, ck] = key.split("|");
      const teacher = byId.get(teacherId);
      if (!teacher) continue;
      let have = (counts.get(key) || []).length;
      for (let d = 0; d < DAYS.length && have < need; d++) {
        for (let p = 0; p < ppd && have < need; p++) {
          if (next[ck][d]?.[p]) continue;
          if (teacherBusy(teacherId, d, p)) continue;
          if (isBlocked(teacher, d, p)) continue;
          next[ck][d][p] = { teacherId, teacherName: teacher.name, subjectName };
          have++;
        }
      }
    }

    return next;
  }, []);

  const addTeacher = (teacher: Teacher) => {
    setTeachers(prev => {
      const next = [...prev, teacher];
      const hasTT = Object.keys(timetable).length > 0;
      const newTT = hasTT && constraints.autoSyncTeachers
        ? syncTimetableWithTeachers(timetable, next, periodsPerDay)
        : timetable;
      if (newTT !== timetable) setTimetableState(newTT);
      save(next, newTT, periodsPerDay);
      return next;
    });
  };

  /** تحديث أسماء المعلمين داخل خانات الجدول (ينعكس فوراً على الملحفة) */
  const renameTeachersInTimetable = (tt: ClassTimetable, list: Teacher[]): ClassTimetable => {
    const byId = new Map(list.map(t => [t.id, t]));
    let changed = false;
    const next: ClassTimetable = {};
    for (const [ck, days] of Object.entries(tt)) {
      next[ck] = days.map(d => d.map(c => {
        if (!c) return c;
        const t = byId.get(c.teacherId);
        if (t && t.name !== c.teacherName) { changed = true; return { ...c, teacherName: t.name }; }
        return c;
      }));
    }
    return changed ? next : tt;
  };

  const updateTeacher = (teacher: Teacher) => {
    setTeachers(prev => {
      const next = prev.map(t => t.id === teacher.id ? teacher : t);
      const hasTT = Object.keys(timetable).length > 0;
      const newTT = hasTT
        ? (constraints.autoSyncTeachers
            ? syncTimetableWithTeachers(timetable, next, periodsPerDay)
            : renameTeachersInTimetable(timetable, next))
        : timetable;
      if (newTT !== timetable) setTimetableState(newTT);
      save(next, newTT, periodsPerDay);
      return next;
    });
  };


  /** حفظ نسخة من الجدول الحالي للرجوع إليها لاحقاً */
  const saveCurrentTimetable = (name: string) => {
    const snap: SavedTimetable = {
      id: `${Date.now()}`,
      name: name.trim() || `جدول ${new Date().toLocaleString("ar")}`,
      createdAt: new Date().toISOString(),
      periodsPerDay,
      timetable: JSON.parse(JSON.stringify(timetable)),
      teachers: JSON.parse(JSON.stringify(teachers)),
    };
    setSavedTimetables(prev => {
      const next = [snap, ...prev].slice(0, 30);
      try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const restoreSavedTimetable = (id: string): boolean => {
    const snap = savedTimetables.find(s => s.id === id);
    if (!snap) return false;
    const restoredTeachers = snap.teachers?.length ? snap.teachers : teachers;
    setTeachers(restoredTeachers);
    setTimetableState(snap.timetable);
    setPeriodsPerDayState(snap.periodsPerDay || periodsPerDay);
    save(restoredTeachers, snap.timetable, snap.periodsPerDay || periodsPerDay);
    return true;
  };

  const deleteSavedTimetable = (id: string) => {
    setSavedTimetables(prev => {
      const next = prev.filter(s => s.id !== id);
      try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  /** استيراد نسخ محفوظة من ملف JSON (تُضاف للقائمة مع تجاهل المكرر) */
  const importSavedTimetables = (snaps: SavedTimetable[]): number => {
    const valid = (Array.isArray(snaps) ? snaps : []).filter(
      s => s && typeof s === "object" && s.timetable && typeof s.timetable === "object"
    );
    if (valid.length === 0) return 0;
    let added = 0;
    setSavedTimetables(prev => {
      const existing = new Set(prev.map(s => s.id));
      const incoming = valid.map(s => {
        let id = s.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (existing.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
        existing.add(id);
        added++;
        return {
          id,
          name: s.name || `جدول مستورد ${new Date().toLocaleDateString("ar")}`,
          createdAt: s.createdAt || new Date().toISOString(),
          periodsPerDay: s.periodsPerDay || 7,
          timetable: s.timetable,
          teachers: Array.isArray(s.teachers) ? s.teachers : [],
        } as SavedTimetable;
      });
      const next = [...incoming, ...prev].slice(0, 30);
      try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    return added;
  };



  const removeTeacher = (id: string) => {
    const newTT = { ...timetable };
    for (const key of Object.keys(newTT)) {
      newTT[key] = newTT[key].map(day =>
        day.map(cell => (cell && cell.teacherId === id ? null : cell))
      );
    }
    setTeachers(prev => {
      const next = prev.filter(t => t.id !== id);
      setTimetableState(newTT);
      save(next, newTT, periodsPerDay);
      return next;
    });
  };

  const setTimetable = (tt: ClassTimetable) => {
    setTimetableState(tt);
    save(teachers, tt, periodsPerDay);
  };

  const setPeriodsPerDay = (n: number) => {
    setPeriodsPerDayState(n);
    save(teachers, timetable, n);
  };

  const updateCell = (classKey: string, day: number, period: number, cell: TimetableCell | null) => {
    const newTT = { ...timetable };
    if (!newTT[classKey]) {
      newTT[classKey] = Array.from({ length: DAYS.length }, () => Array(MAX_PERIODS).fill(null));
    }
    newTT[classKey] = newTT[classKey].map((d, di) =>
      di === day ? d.map((p, pi) => (pi === period ? cell : p)) : d
    );
    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);
  };

  const swapCells = (classKey: string, day: number, periodA: number, periodB: number): boolean => {
    const newTT = { ...timetable };
    if (!newTT[classKey]) return false;
    const cellA = newTT[classKey][day][periodA];
    const cellB = newTT[classKey][day][periodB];

    const wouldConflict = (teacherId: string | undefined, period: number) => {
      if (!teacherId) return false;
      for (const [key, days] of Object.entries(newTT)) {
        if (key === classKey) continue;
        if (days[day]?.[period]?.teacherId === teacherId) return true;
      }
      return false;
    };

    if (wouldConflict(cellA?.teacherId, periodB) || wouldConflict(cellB?.teacherId, periodA)) {
      return false;
    }

    newTT[classKey] = newTT[classKey].map((d, di) => {
      if (di !== day) return d;
      return d.map((p, pi) => {
        if (pi === periodA) return cellB;
        if (pi === periodB) return cellA;
        return p;
      });
    });
    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);
    return true;
  };

  /**
   * تبديل يدوي حرّ بين حصتين داخل نفس الصف حتى لو كانتا في يومين مختلفين.
   * يُستخدم لنقل حصص مثل التربية الفنية/الرياضية من الحصة الثامنة إلى أي مكان آخر.
   */
  const swapCellsAcrossDays = (classKey: string, dayA: number, periodA: number, dayB: number, periodB: number): boolean => {
    const days = timetable[classKey];
    if (!days) return false;
    if (dayA === dayB) return swapCells(classKey, dayA, periodA, periodB);
    const cellA = days[dayA]?.[periodA] ?? null;
    const cellB = days[dayB]?.[periodB] ?? null;
    if (!cellA && !cellB) return false;

    const busy = (teacherId: string | undefined, day: number, period: number) => {
      if (!teacherId) return false;
      for (const [key, d] of Object.entries(timetable)) {
        if (key === classKey) continue;
        if (d[day]?.[period]?.teacherId === teacherId) return true;
      }
      const teacher = teachers.find(t => t.id === teacherId);
      return !!teacher && (teacher.blockedPeriods || []).some(bp => bp.day === day && bp.period === period);
    };

    if (busy(cellA?.teacherId, dayB, periodB) || busy(cellB?.teacherId, dayA, periodA)) return false;

    const newTT = { ...timetable };
    newTT[classKey] = days.map((d, di) =>
      d.map((p, pi) => {
        if (di === dayA && pi === periodA) return cellB;
        if (di === dayB && pi === periodB) return cellA;
        return p;
      })
    );
    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);
    return true;
  };


  /**
   * نقل حصة من مكانها إلى خانة فارغة (يمكن أن تكون في يوم آخر داخل نفس الصف).
   * يتحقق من خلو الخانة الهدف ومن عدم تعارض المعلم وعدم كونها حصة ممنوعة له.
   */
  const moveCell = (classKey: string, fromDay: number, fromPeriod: number, toDay: number, toPeriod: number): boolean => {
    const days = timetable[classKey];
    if (!days) return false;
    const cell = days[fromDay]?.[fromPeriod];
    if (!cell) return false;
    if (fromDay === toDay && fromPeriod === toPeriod) return false;
    if (days[toDay]?.[toPeriod]) return false; // الهدف ليس فارغاً

    // تعارض المعلم في نفس التوقيت داخل صف آخر
    for (const [ck, d] of Object.entries(timetable)) {
      if (ck === classKey) continue;
      if (d[toDay]?.[toPeriod]?.teacherId === cell.teacherId) return false;
    }
    // حصة ممنوعة للمعلم
    const teacher = teachers.find(t => t.id === cell.teacherId);
    if (teacher && (teacher.blockedPeriods || []).some(bp => bp.day === toDay && bp.period === toPeriod)) return false;

    const newTT = { ...timetable };
    newTT[classKey] = days.map((d, di) =>
      d.map((p, pi) => {
        if (di === fromDay && pi === fromPeriod) return null;
        if (di === toDay && pi === toPeriod) return cell;
        return p;
      })
    );
    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);
    return true;
  };


  // Place a period from the unplaced staging area into the timetable
  const placeFromStaging = (stagingIdx: number, classKey: string, day: number, period: number): boolean => {
    if (stagingIdx < 0 || stagingIdx >= unplacedPeriods.length) return false;
    const item = unplacedPeriods[stagingIdx];

    // Must match classKey
    if (item.classKey !== classKey) return false;

    // Check slot is empty
    if (timetable[classKey]?.[day]?.[period] !== null) return false;

    // Check teacher not busy at that slot
    for (const [ck, days] of Object.entries(timetable)) {
      if (ck === classKey) continue;
      if (days[day]?.[period]?.teacherId === item.teacherId) return false;
    }

    // Check blocked
    const teacher = teachers.find(t => t.id === item.teacherId);
    if (teacher && (teacher.blockedPeriods || []).some(bp => bp.day === day && bp.period === period)) return false;

    // Place it
    const newTT = { ...timetable };
    newTT[classKey] = newTT[classKey].map((d, di) =>
      di === day ? d.map((p, pi) => pi === period ? { teacherId: item.teacherId, teacherName: item.teacherName, subjectName: item.subjectName } : p) : d
    );
    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);

    // Update unplaced
    const newUnplaced = [...unplacedPeriods];
    if (item.count <= 1) {
      newUnplaced.splice(stagingIdx, 1);
    } else {
      newUnplaced[stagingIdx] = { ...item, count: item.count - 1 };
    }
    setUnplacedPeriods(newUnplaced);
    return true;
  };

  // Move a placed period from the timetable back to the unplaced staging area
  const moveToStaging = (classKey: string, day: number, period: number): boolean => {
    const cell = timetable[classKey]?.[day]?.[period];
    if (!cell) return false;

    const newTT = { ...timetable };
    newTT[classKey] = newTT[classKey].map((d, di) =>
      di === day ? d.map((p, pi) => (pi === period ? null : p)) : d
    );
    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);

    setUnplacedPeriods(prev => {
      const idx = prev.findIndex(
        u => u.classKey === classKey && u.teacherId === cell.teacherId && u.subjectName === cell.subjectName
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], count: next[idx].count + 1 };
        return next;
      }
      return [...prev, {
        teacherId: cell.teacherId,
        teacherName: cell.teacherName,
        subjectName: cell.subjectName,
        classKey,
        count: 1,
      }];
    });
    return true;
  };

  const getAllClassKeys = (): string[] => {
    const keys = new Set<string>();
    teachers.forEach(t => t.subjects.forEach(s => keys.add(getClassKey(s.className, s.section))));
    // نضيف أي صف موجود في الجدول الحالي حتى لو لم يعد مرتبطاً بمعلم
    Object.keys(timetable).forEach(k => keys.add(k));
    return Array.from(keys).sort(compareClassKeys);
  };

  /** إعادة ترتيب صفوف الجدول الحالي (الأول أ، ب... ثم الثاني...) دون إعادة توليد */
  const reorderClasses = () => {
    const ordered: ClassTimetable = {};
    Object.keys(timetable).sort(compareClassKeys).forEach(k => { ordered[k] = timetable[k]; });
    setTimetableState(ordered);
    save(teachers, ordered, periodsPerDay);
  };


  const getTeacherSchedule = (teacherId: string) => {
    const schedule: { classKey: string; day: number; period: number; subjectName: string }[] = [];
    for (const [classKey, days] of Object.entries(timetable)) {
      days.forEach((periods, dayIdx) => {
        periods.forEach((cell, periodIdx) => {
          if (cell && cell.teacherId === teacherId) {
            schedule.push({ classKey, day: dayIdx, period: periodIdx, subjectName: cell.subjectName });
          }
        });
      });
    }
    return schedule;
  };

  const clearTimetable = () => {
    setTimetableState({});
    setUnplacedPeriods([]);
    save(teachers, {}, periodsPerDay);
  };

  const isBlocked = (teacher: Teacher, day: number, period: number): boolean => {
    return (teacher.blockedPeriods || []).some(bp => bp.day === day && bp.period === period);
  };

  const generateTimetable = () => {
    const classKeys = getAllClassKeys();
    const newTT: ClassTimetable = {};
    const daysCount = DAYS.length;

    classKeys.forEach(key => {
      newTT[key] = Array.from({ length: daysCount }, () => Array(periodsPerDay).fill(null));
    });

    /**
     * حجز حصص النشاط قبل التوزيع: الحصتان الثانية والثالثة (فهرس 1 و 2) في يوم
     * الصف المحدّد تُملأ بخانة "نشاط" مقفلة، فلا يضع فيها المولّد أي مادة ولا
     * تُحرَّك في جولات الرصّ أو التبديل. يُسند لها معلم في نهاية التوليد.
     */
    const activityLocked = new Set<string>();
    const lockKey = (ck: string, d: number, p: number) => `${ck}|${d}|${p}`;
    const isLocked = (ck: string, d: number, p: number) => activityLocked.has(lockKey(ck, d, p));

    if (activityPeriods && ACTIVITY_PERIODS[1] < periodsPerDay) {
      classKeys.forEach(ck => {
        const { className } = parseClassKey(ck);
        const day = getActivityDay(className);
        if (day === undefined || day >= daysCount) return;
        ACTIVITY_PERIODS.forEach(p => {
          newTT[ck][day][p] = { teacherId: ACTIVITY_TEACHER_ID, teacherName: "", subjectName: ACTIVITY_SUBJECT };
          activityLocked.add(lockKey(ck, day, p));
        });
      });
    }

    /**
     * سقف الحصص لكل صف:
     * - الصف الذي مجموع حصصه الأسبوعية أكثر من 35 → يُسمح له بالحصة الثامنة.
     * - الصف الذي مجموعه 35 أو أقل → الحد الأقصى 7 حصص يومياً (ترتيب حتى الحصة السابعة فقط).
     * الخانات التي تتجاوز السقف تُقفل فلا يضع فيها المولّد أي حصة.
     */
    const classWeeklyTotal: Record<string, number> = {};
    classKeys.forEach(ck => { classWeeklyTotal[ck] = 0; });
    teachers.forEach(t => {
      t.subjects.forEach(s => {
        const ck = getClassKey(s.className, s.section);
        if (classWeeklyTotal[ck] === undefined) classWeeklyTotal[ck] = 0;
        classWeeklyTotal[ck] += s.periodsPerWeek;
      });
    });

    const classCap: Record<string, number> = {};
    classKeys.forEach(ck => {
      classCap[ck] = !constraints.variablePeriodCap
        ? periodsPerDay
        : (classWeeklyTotal[ck] > 35 ? periodsPerDay : Math.min(periodsPerDay, 7));
    });

    const overCap = (ck: string, period: number) => period >= (classCap[ck] ?? periodsPerDay);

    classKeys.forEach(ck => {
      for (let d = 0; d < daysCount; d++) {
        for (let p = classCap[ck]; p < periodsPerDay; p++) activityLocked.add(lockKey(ck, d, p));
      }
    });

    /** المواد المفضّلة للحصة الثامنة عند الصفوف التي تتجاوز 35 حصة */
    const LAST_PERIOD_PREFERRED = ["تربية فنية", "تربية رياضية"];

    const latePeriodCount: Record<string, { sixth: number; seventh: number }> = {};
    teachers.forEach(t => { latePeriodCount[t.id] = { sixth: 0, seventh: 0 }; });


    const classDayLoad: Record<string, number[]> = {};
    classKeys.forEach(key => {
      classDayLoad[key] = Array(daysCount).fill(0);
    });

    interface Assignment {
      teacherId: string;
      teacherName: string;
      subjectName: string;
      classKey: string;
      total: number;
      remaining: number;
      perDayCount: number[];
    }

    const assignments: Assignment[] = [];
    teachers.forEach(t => {
      t.subjects.forEach(s => {
        const key = getClassKey(s.className, s.section);
        // مادة "نشاط" لا تُوزَّع كباقي المواد: خاناتها محجوزة مسبقاً (ح2 + ح3) في يوم الصف
        if (activityPeriods && s.subjectName.trim() === ACTIVITY_SUBJECT) return;
        assignments.push({
          teacherId: t.id,
          teacherName: t.name,
          subjectName: s.subjectName,
          classKey: key,
          total: s.periodsPerWeek,
          remaining: s.periodsPerWeek,
          perDayCount: Array(daysCount).fill(0),
        });
      });
    });

    const sixthPeriodIdx = periodsPerDay - 2;
    const seventhPeriodIdx = periodsPerDay - 1;

    // For subjects with 6+ periods, allow up to 2 per day; otherwise 1
    const getMaxPerDay = (totalPeriods: number): number => {
      if (totalPeriods >= 6) return 2;
      const avg = totalPeriods / daysCount;
      return Math.max(1, Math.ceil(avg));
    };

    const isTeacherBusy = (teacherId: string, day: number, period: number, ignoreClassKey?: string) => {
      for (const [classKey, days] of Object.entries(newTT)) {
        if (ignoreClassKey && classKey === ignoreClassKey) continue;
        if (days[day]?.[period]?.teacherId === teacherId) return true;
      }
      return false;
    };

    const getTeacherDayLoad = (teacherId: string, day: number) => {
      let count = 0;
      for (const days of Object.values(newTT)) {
        for (let period = 0; period < periodsPerDay; period++) {
          if (days[day]?.[period]?.teacherId === teacherId) count++;
        }
      }
      return count;
    };

    const placeAssignment = (assignment: Assignment, day: number, period: number) => {
      newTT[assignment.classKey][day][period] = {
        teacherId: assignment.teacherId,
        teacherName: assignment.teacherName,
        subjectName: assignment.subjectName,
      };
      assignment.remaining -= 1;
      assignment.perDayCount[day] += 1;
      classDayLoad[assignment.classKey][day] += 1;
      if (period === sixthPeriodIdx) latePeriodCount[assignment.teacherId].sixth += 1;
      if (period === seventhPeriodIdx) latePeriodCount[assignment.teacherId].seventh += 1;
    };

    const findBestSlot = (assignment: Assignment, respectDailyLimit: boolean) => {
      const teacher = teachers.find(t => t.id === assignment.teacherId);
      if (!teacher) return null;

      const maxPerDay = getMaxPerDay(assignment.total);
      let best: { day: number; period: number; score: number } | null = null;

      // Randomize day/period iteration order for variety
      const dayOrder = shuffle(Array.from({ length: daysCount }, (_, i) => i));
      const periodOrder = shuffle(Array.from({ length: periodsPerDay }, (_, i) => i));

      for (const day of dayOrder) {
        if (respectDailyLimit && assignment.perDayCount[day] >= maxPerDay) continue;

        for (const period of periodOrder) {
          if (overCap(assignment.classKey, period)) continue;
          if (newTT[assignment.classKey][day][period] !== null) continue;
          if (isTeacherBusy(assignment.teacherId, day, period, assignment.classKey)) continue;
          if (isBlocked(teacher, day, period)) continue;

          // Prefer earlier periods (lower period index)
          let score = period * 100;
          // Spread across days
          score += assignment.perDayCount[day] * 20;
          score += classDayLoad[assignment.classKey][day] * 4;
          score += getTeacherDayLoad(assignment.teacherId, day) * 8;
          // Add small random noise for variety
          score += Math.random() * 15;

          if (period === sixthPeriodIdx) score += 30 + latePeriodCount[assignment.teacherId].sixth * 45;
          if (period === seventhPeriodIdx) score += 45 + latePeriodCount[assignment.teacherId].seventh * 70;

          // الحصة الأخيرة (الثامنة) للصفوف التي تتجاوز 35 حصة: تُفضَّل التربية الفنية والرياضية
          const lastIdx = (classCap[assignment.classKey] ?? periodsPerDay) - 1;
          if (period === lastIdx && lastIdx >= 7) {
            score += LAST_PERIOD_PREFERRED.includes(assignment.subjectName.trim()) ? -400 : 250;
          }


          if (!best || score < best.score) {
            best = { day, period, score };
          }
        }
      }

      return best;
    };

    // Main placement loop
    let progress = true;
    let guard = 0;

    while (progress && guard < 500) {
      progress = false;
      guard += 1;

      const activeAssignments = shuffle(
        assignments.filter(a => a.remaining > 0)
      ).sort((a, b) => {
        if (b.remaining !== a.remaining) return b.remaining - a.remaining;
        return 0;
      });

      for (const assignment of activeAssignments) {
        const slot = findBestSlot(assignment, true) ?? findBestSlot(assignment, false);
        if (!slot) continue;
        placeAssignment(assignment, slot.day, slot.period);
        progress = true;
      }
    }

    // Compaction function
    const compactTimetable = (tt: ClassTimetable) => {
      const allClassKeys = Object.keys(tt);
      let changed = true;
      let passes = 0;
      while (changed && passes < 50) {
        changed = false;
        passes++;
        const shuffledKeys = [...allClassKeys].sort(() => Math.random() - 0.5);
        for (const ck of shuffledKeys) {
          for (let day = 0; day < daysCount; day++) {
            const periods = tt[ck][day];
            for (let p = 0; p < periodsPerDay - 1; p++) {
              if (periods[p] !== null) continue;
              for (let np = p + 1; np < periodsPerDay; np++) {
                if (periods[np] === null) continue;
                const cell = periods[np]!;
                if (isActivityCell(cell)) continue;
                let conflict = false;
                for (const [otherKey, otherDays] of Object.entries(tt)) {
                  if (otherKey === ck) continue;
                  if (otherDays[day]?.[p]?.teacherId === cell.teacherId) {
                    conflict = true;
                    break;
                  }
                }
                if (!conflict) {
                  const teacher = teachers.find(t => t.id === cell.teacherId);
                  if (teacher && isBlocked(teacher, day, p)) continue;
                  periods[p] = cell;
                  periods[np] = null;
                  changed = true;
                  break;
                }
              }
            }
          }
        }
      }

      // Swap pass to resolve remaining gaps
      let swapPass = 0;
      let swapChanged = true;
      while (swapChanged && swapPass < 30) {
        swapChanged = false;
        swapPass++;
        for (const ck of allClassKeys) {
          for (let day = 0; day < daysCount; day++) {
            const periods = tt[ck][day];
            for (let p = 0; p < periodsPerDay - 1; p++) {
              if (periods[p] !== null) continue;
              for (let np = p + 1; np < periodsPerDay; np++) {
                if (periods[np] === null) continue;
                const cellToMove = periods[np]!;
                if (isActivityCell(cellToMove)) continue;
                let conflictingClassKey = "";
                for (const [otherKey, otherDays] of Object.entries(tt)) {
                  if (otherKey === ck) continue;
                  if (otherDays[day]?.[p]?.teacherId === cellToMove.teacherId) {
                    conflictingClassKey = otherKey;
                    break;
                  }
                }
                if (conflictingClassKey && tt[conflictingClassKey]) {
                  const otherPeriods = tt[conflictingClassKey][day];
                  const conflictCell = otherPeriods[p]!;
                  if (otherPeriods[np] === null && !overCap(conflictingClassKey, np)) {
                    let canSwap = true;
                    for (const [checkKey, checkDays] of Object.entries(tt)) {
                      if (checkKey === conflictingClassKey || checkKey === ck) continue;
                      if (checkDays[day]?.[np]?.teacherId === conflictCell.teacherId) {
                        canSwap = false;
                        break;
                      }
                    }
                    if (canSwap) {
                      const moveTeacher = teachers.find(t => t.id === conflictCell.teacherId);
                      if (moveTeacher && isBlocked(moveTeacher, day, np)) continue;
                      otherPeriods[np] = conflictCell;
                      otherPeriods[p] = null;
                      periods[p] = cellToMove;
                      periods[np] = null;
                      swapChanged = true;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    compactTimetable(newTT);

    // Recovery loop
    Object.keys(latePeriodCount).forEach(teacherId => {
      latePeriodCount[teacherId] = { sixth: 0, seventh: 0 };
    });
    for (const days of Object.values(newTT)) {
      for (let day = 0; day < daysCount; day++) {
        if (sixthPeriodIdx >= 0) {
          const sixthCell = days[day]?.[sixthPeriodIdx];
          if (sixthCell && !isActivityCell(sixthCell)) latePeriodCount[sixthCell.teacherId].sixth += 1;
        }
        if (seventhPeriodIdx >= 0) {
          const seventhCell = days[day]?.[seventhPeriodIdx];
          if (seventhCell && !isActivityCell(seventhCell)) latePeriodCount[seventhCell.teacherId].seventh += 1;
        }
      }
    }

    let recoveryProgress = true;
    let recoveryGuard = 0;
    while (recoveryProgress && recoveryGuard < 200) {
      recoveryProgress = false;
      recoveryGuard += 1;
      const remainingAssignments = shuffle(
        assignments.filter(a => a.remaining > 0)
      ).sort((a, b) => b.remaining - a.remaining);
      for (const assignment of remainingAssignments) {
        const slot = findBestSlot(assignment, false);
        if (!slot) continue;
        placeAssignment(assignment, slot.day, slot.period);
        recoveryProgress = true;
      }
      if (recoveryProgress) compactTimetable(newTT);
    }

    compactTimetable(newTT);

    /**
     * موازنة الحصص المتأخرة (السادسة والسابعة) بين المعلمين قدر الإمكان.
     * تعمل عبر تبديل حصة متأخرة لمعلم مُحمَّل بأكثر من نصيبه مع حصة مبكرة
     * لمعلم أقل تحميلاً داخل نفس الصف ونفس اليوم، مع احترام التعارضات
     * والحصص الممنوعة لكل معلم.
     */
    const balanceLatePeriods = (tt: ClassTimetable) => {
      const latePeriods = [seventhPeriodIdx, sixthPeriodIdx].filter(p => p >= 0);

      const teacherFreeAt = (teacherId: string, day: number, period: number, exceptClassKey: string) => {
        for (const [ck, days] of Object.entries(tt)) {
          if (ck === exceptClassKey) continue;
          if (days[day]?.[period]?.teacherId === teacherId) return false;
        }
        const teacher = teachers.find(t => t.id === teacherId);
        return !(teacher && isBlocked(teacher, day, period));
      };

      for (const lateIdx of latePeriods) {
        for (let pass = 0; pass < 40; pass++) {
          // عدّ الحصص المتأخرة لكل معلم
          const counts: Record<string, number> = {};
          teachers.forEach(t => { counts[t.id] = 0; });
          for (const days of Object.values(tt)) {
            for (let day = 0; day < daysCount; day++) {
              const cell = days[day]?.[lateIdx];
              if (cell) counts[cell.teacherId] = (counts[cell.teacherId] || 0) + 1;
            }
          }

          let swapped = false;
          const slots: { ck: string; day: number }[] = [];
          for (const ck of Object.keys(tt)) {
            for (let day = 0; day < daysCount; day++) slots.push({ ck, day });
          }
          // الأثقل أولاً
          slots.sort((a, b) => {
            const ca = tt[a.ck][a.day][lateIdx];
            const cb = tt[b.ck][b.day][lateIdx];
            return (cb ? counts[cb.teacherId] || 0 : -1) - (ca ? counts[ca.teacherId] || 0 : -1);
          });

          for (const { ck, day } of slots) {
            const lateCell = tt[ck][day][lateIdx];
            if (!lateCell || isActivityCell(lateCell)) continue;
            const heavy = counts[lateCell.teacherId] || 0;

            for (let q = 0; q < lateIdx; q++) {
              const earlyCell = tt[ck][day][q];
              if (!earlyCell || isActivityCell(earlyCell)) continue;
              if (earlyCell.teacherId === lateCell.teacherId) continue;
              const light = counts[earlyCell.teacherId] || 0;
              if (heavy <= light + 1) continue;
              if (!teacherFreeAt(lateCell.teacherId, day, q, ck)) continue;
              if (!teacherFreeAt(earlyCell.teacherId, day, lateIdx, ck)) continue;

              tt[ck][day][lateIdx] = earlyCell;
              tt[ck][day][q] = lateCell;
              counts[lateCell.teacherId] = heavy - 1;
              counts[earlyCell.teacherId] = light + 1;
              swapped = true;
              break;
            }
          }

          if (!swapped) break;
        }
      }
    };

    balanceLatePeriods(newTT);

    /**
     * محاذاة أيام التأخير: نحاول جعل الحصة السادسة للمعلم في نفس اليوم الذي
     * لديه فيه حصة سابعة، حتى تتركّز أيام التأخير في أقل عدد ممكن من الأيام
     * ويستطيع المعلم المغادرة مبكراً في باقي الأيام.
     * الآلية: تبديل خانة الحصة السادسة بين يومين داخل نفس الصف (نفس رقم الحصة)
     * مع التحقق من التعارضات والحصص الممنوعة، وعدم الإضرار بالمعلم الآخر.
     */
    const alignLateDays = (tt: ClassTimetable) => {
      if (sixthPeriodIdx < 0 || seventhPeriodIdx < 0) return;

      const freeAt = (teacherId: string, day: number, period: number, exceptClassKey: string) => {
        for (const [ck, days] of Object.entries(tt)) {
          if (ck === exceptClassKey) continue;
          if (days[day]?.[period]?.teacherId === teacherId) return false;
        }
        const teacher = teachers.find(t => t.id === teacherId);
        return !(teacher && isBlocked(teacher, day, period));
      };

      // عدد الأيام التي يتأخر فيها المعلم (لديه حصة سادسة أو سابعة)
      const lateDays = (teacherId: string) => {
        const set = new Set<number>();
        for (const days of Object.values(tt)) {
          for (let d = 0; d < daysCount; d++) {
            const c6 = days[d]?.[sixthPeriodIdx];
            const c7 = days[d]?.[seventhPeriodIdx];
            if (c6?.teacherId === teacherId || c7?.teacherId === teacherId) set.add(d);
          }
        }
        return set;
      };

      const hasAt = (teacherId: string, day: number, periodIdx: number) => {
        for (const days of Object.values(tt)) {
          if (days[day]?.[periodIdx]?.teacherId === teacherId) return true;
        }
        return false;
      };

      for (let pass = 0; pass < 30; pass++) {
        let moved = false;

        for (const ck of Object.keys(tt)) {
          for (let dayA = 0; dayA < daysCount; dayA++) {
            const cellA = tt[ck][dayA]?.[sixthPeriodIdx];
            if (!cellA || isActivityCell(cellA)) continue;
            const tA = cellA.teacherId;
            // المعلم متأخر أصلاً في هذا اليوم بحصة سابعة؟ لا حاجة للنقل
            if (hasAt(tA, dayA, seventhPeriodIdx)) continue;

            for (let dayB = 0; dayB < daysCount; dayB++) {
              if (dayB === dayA) continue;
              // نريد يوماً لدى المعلم فيه حصة سابعة ولا يملك حصة سادسة
              if (!hasAt(tA, dayB, seventhPeriodIdx)) continue;
              if (hasAt(tA, dayB, sixthPeriodIdx)) continue;

              const cellB = tt[ck][dayB]?.[sixthPeriodIdx] ?? null;
              if (isActivityCell(cellB)) continue;
              const tB = cellB?.teacherId;
              if (tB === tA) continue;

              if (!freeAt(tA, dayB, sixthPeriodIdx, ck)) continue;
              if (cellB && !freeAt(tB!, dayA, sixthPeriodIdx, ck)) continue;

              const beforeA = lateDays(tA).size;
              const beforeB = tB ? lateDays(tB).size : 0;

              tt[ck][dayA][sixthPeriodIdx] = cellB;
              tt[ck][dayB][sixthPeriodIdx] = cellA;

              const afterA = lateDays(tA).size;
              const afterB = tB ? lateDays(tB).size : 0;

              if (afterA < beforeA && afterB <= beforeB) {
                moved = true;
                break;
              }
              // تراجع عن التبديل إن لم يكن مفيداً
              tt[ck][dayA][sixthPeriodIdx] = cellA;
              tt[ck][dayB][sixthPeriodIdx] = cellB;
            }
          }
        }

        if (!moved) break;
      }
    };

    if (constraints.alignLateDays) alignLateDays(newTT);

    /**
     * جعل حصص المواد المحددة (المهارات الرقمية / التربية المهنية) حصتين متتاليتين
     * داخل نفس اليوم لنفس الصف — يعمل فقط عند تفعيل الخيار من إعدادات الجدول.
     * الآلية: البحث عن حصتين لنفس المادة في أيام مختلفة، ثم تبديل إحداهما مع
     * الحصة المجاورة للأخرى، مع التحقق من تعارضات المعلمين والحصص الممنوعة.
     */



    const pairDoublePeriodSubjects = (tt: ClassTimetable) => {
      const freeAt = (teacherId: string, day: number, period: number, exceptClassKey: string) => {
        for (const [ck, days] of Object.entries(tt)) {
          if (ck === exceptClassKey) continue;
          if (days[day]?.[period]?.teacherId === teacherId) return false;
        }
        const teacher = teachers.find(t => t.id === teacherId);
        return !(teacher && isBlocked(teacher, day, period));
      };

      /**
       * محاولة تفريغ المعلم في توقيت معيّن بنقل حصته المتعارضة (في صف آخر)
       * إلى خانة فارغة مناسبة داخل صفّها، دون تعارض ودون المساس بخانات النشاط.
       */
      const freeUpTeacher = (teacherId: string, day: number, period: number, exceptClassKey: string) => {
        const teacher = teachers.find(t => t.id === teacherId);
        if (teacher && isBlocked(teacher, day, period)) return false;
        for (const [ck2, days] of Object.entries(tt)) {
          if (ck2 === exceptClassKey) continue;
          const cell = days[day]?.[period];
          if (!cell || cell.teacherId !== teacherId) continue;
          if (isLocked(ck2, day, period)) return false;
          for (let d2 = 0; d2 < daysCount; d2++) {
            for (let p2 = 0; p2 < periodsPerDay; p2++) {
              if (d2 === day && p2 === period) continue;
              if (tt[ck2][d2][p2] !== null) continue;
              if (isLocked(ck2, d2, p2)) continue;
              if (!freeAt(teacherId, d2, p2, ck2)) continue;
              tt[ck2][d2][p2] = cell;
              tt[ck2][day][period] = null;
              return true;
            }
          }
          return false;
        }
        return false;
      };




      for (const ck of Object.keys(tt)) {
        for (const subject of DOUBLE_PERIOD_SUBJECTS) {
          for (let pass = 0; pass < 12; pass++) {
            // مواقع المادة داخل هذا الصف
            const spots: { day: number; period: number }[] = [];
            for (let d = 0; d < daysCount; d++) {
              for (let p = 0; p < periodsPerDay; p++) {
                if (tt[ck][d]?.[p]?.subjectName === subject) spots.push({ day: d, period: p });
              }
            }
            if (spots.length < 2) break;

            // الحصص غير المقترنة (لا يوجد بجانبها نفس المادة)
            const lonely = spots.filter(s => !(
              tt[ck][s.day]?.[s.period - 1]?.subjectName === subject ||
              tt[ck][s.day]?.[s.period + 1]?.subjectName === subject
            ));
            if (lonely.length < 2) break;

            let done = false;
            for (const anchor of lonely) {
              if (isLocked(ck, anchor.day, anchor.period)) continue;
              for (const neighbor of [anchor.period + 1, anchor.period - 1]) {
                if (neighbor < 0 || neighbor >= periodsPerDay) continue;
                if (isLocked(ck, anchor.day, neighbor)) continue;
                const target = tt[ck][anchor.day][neighbor];
                if (isActivityCell(target)) continue;

                for (const other of lonely) {
                  if (other.day === anchor.day && other.period === anchor.period) continue;
                  if (other.day === anchor.day && other.period === neighbor) continue;
                  if (isLocked(ck, other.day, other.period)) continue;
                  const otherCell = tt[ck][other.day][other.period]!;
                  if (!otherCell) continue;
                  if (!freeAt(otherCell.teacherId, anchor.day, neighbor, ck) && !freeUpTeacher(otherCell.teacherId, anchor.day, neighbor, ck)) continue;
                  if (target && !freeAt(target.teacherId, other.day, other.period, ck) && !freeUpTeacher(target.teacherId, other.day, other.period, ck)) continue;


                  tt[ck][anchor.day][neighbor] = otherCell;
                  tt[ck][other.day][other.period] = target;
                  done = true;
                  break;
                }
                if (done) break;
              }
              if (done) break;
            }

            if (!done) break;
          }
        }
      }
    };


    /**
     * أدوات مشتركة للتبديل الآمن داخل نفس الصف.
     * تبدّل محتوى خانتين في نفس الصف بشرط عدم حدوث تعارض للمعلمين
     * وعدم وقوع أي حصة في حصة ممنوعة لمعلمها.
     */
    const makeSwapper = (tt: ClassTimetable) => {
      const freeAt = (teacherId: string, day: number, period: number, exceptClassKey: string) => {
        for (const [ck, days] of Object.entries(tt)) {
          if (ck === exceptClassKey) continue;
          if (days[day]?.[period]?.teacherId === teacherId) return false;
        }
        const teacher = teachers.find(t => t.id === teacherId);
        return !(teacher && isBlocked(teacher, day, period));
      };

      const trySwap = (ck: string, d1: number, p1: number, d2: number, p2: number) => {
        if (d1 === d2 && p1 === p2) return false;
        if (isLocked(ck, d1, p1) || isLocked(ck, d2, p2)) return false;
        const a = tt[ck][d1][p1];
        const b = tt[ck][d2][p2];
        if (isActivityCell(a) || isActivityCell(b)) return false;
        if (!a && !b) return false;

        if (a && !freeAt(a.teacherId, d2, p2, ck)) return false;
        if (b && !freeAt(b.teacherId, d1, p1, ck)) return false;
        tt[ck][d1][p1] = b;
        tt[ck][d2][p2] = a;
        return true;
      };

      return { freeAt, trySwap };
    };

    /**
     * حصص النشاط: الخانتان الثانية والثالثة محجوزتان مسبقاً (قبل التوزيع) في يوم
     * الصف المحدّد (الأول–الرابع الأحد، الخامس–السابع الاثنين، الثامن–العاشر الثلاثاء).
     * هنا نُسند لهما معلماً حقيقياً حرّاً في الحصتين معاً، مع بقاء المادة "نشاط"
     * حتى تظهر في الملحفة باسم المعلم والمادة كحصتين متتاليتين.
     */
    const assignActivityTeachers = (tt: ClassTimetable) => {
      const [pA, pB] = ACTIVITY_PERIODS;
      if (pB >= periodsPerDay) return;

      // المعلم مشغول فعلياً في هذا التوقيت؟ (يشمل حصص النشاط المُسندة سابقاً)
      const busy = (teacherName: string, teacherId: string, day: number, period: number) => {
        for (const days of Object.values(tt)) {
          const c = days[day]?.[period];
          if (!c) continue;
          if (c.teacherId === teacherId) return true;
          if (isActivityCell(c) && c.teacherName && c.teacherName === teacherName) return true;
        }
        return false;
      };

      const activityLoad: Record<string, number> = {};

      /**
       * محاولة تفريغ المعلم في توقيت معيّن: ننقل حصصه المتعارضة (في صفوف أخرى)
       * إلى خانات فارغة مناسبة داخل صفوفها دون تعارض ودون المساس بخانات النشاط.
       */
      const relocateTeacherLesson = (teacherId: string, day: number, period: number): boolean => {
        for (const [ck2, days] of Object.entries(tt)) {
          const cell = days[day]?.[period];
          if (!cell || cell.teacherId !== teacherId) continue;
          let moved = false;
          for (let d2 = 0; d2 < daysCount && !moved; d2++) {
            for (let p2 = 0; p2 < periodsPerDay && !moved; p2++) {
              if (d2 === day && p2 === period) continue;
              if (tt[ck2][d2]?.[p2] !== null) continue;
              if (overCap(ck2, p2)) continue;
              // لا نضع حصة داخل خانة نشاط محجوزة لهذا الصف
              const { className: cn2 } = parseClassKey(ck2);
              const aDay2 = getActivityDay(cn2);
              if (aDay2 === d2 && ACTIVITY_PERIODS.includes(p2)) continue;
              const t = teachers.find(x => x.id === teacherId);
              if (t && isBlocked(t, d2, p2)) continue;
              // المعلم حرّ في التوقيت الجديد؟
              let free = true;
              for (const [ck3, dd] of Object.entries(tt)) {
                if (ck3 === ck2) continue;
                if (dd[d2]?.[p2]?.teacherId === teacherId) { free = false; break; }
              }
              if (!free) continue;
              tt[ck2][d2][p2] = cell;
              tt[ck2][day][period] = null;
              moved = true;
            }
          }
          if (!moved) return false;
        }
        return true;
      };

      for (const ck of Object.keys(tt)) {
        const { className } = parseClassKey(ck);
        const day = getActivityDay(className);
        if (day === undefined || day >= daysCount) continue;
        const cA = tt[ck][day][pA];
        const cB = tt[ck][day][pB];
        if (!isActivityCell(cA) || !isActivityCell(cB)) continue;

        // معلمو هذا الصف مرتّبون حسب أقل نصيب نشاط
        // أولاً: المعلمون المُسنَد لهم مادة "نشاط" لهذا الصف تحديداً
        const activityTeachers = teachers.filter(t =>
          t.subjects.some(s =>
            getClassKey(s.className, s.section) === ck &&
            s.subjectName.trim() === ACTIVITY_SUBJECT
          )
        );
        const classTeachers = teachers.filter(t =>
          t.subjects.some(s => getClassKey(s.className, s.section) === ck)
        );
        const pool = activityTeachers.length
          ? activityTeachers
          : (classTeachers.length ? classTeachers : teachers);
        const sorted = [...pool].sort(
          (a, b) => (activityLoad[a.id] || 0) - (activityLoad[b.id] || 0)
        );

        /**
         * الخيار (ج): النشاط يبقى دائماً للمعلم المُسنَد له مادة "نشاط" لهذا الصف.
         * أي حصة أخرى تتعارض معه في الحصتين 2 و 3 تُنقل تلقائياً لخانة فارغة،
         * وإن تعذّر النقل تُزال من ذلك التوقيت (تُترك فارغة) ولا يُستبدل المعلم أبداً.
         */
        const forceFree = (teacherId: string, d: number, p: number) => {
          if (relocateTeacherLesson(teacherId, d, p)) return;
          for (const [ck2, days] of Object.entries(tt)) {
            const cell = days[d]?.[p];
            if (cell && cell.teacherId === teacherId) tt[ck2][d][p] = null;
          }
        };

        let chosen: Teacher | undefined;

        if (activityTeachers.length) {
          // المعلم الأصلي للنشاط — نتمسّك به مهما كان
          chosen = [...activityTeachers].sort(
            (a, b) => (activityLoad[a.id] || 0) - (activityLoad[b.id] || 0)
          )[0];
          forceFree(chosen.id, day, pA);
          forceFree(chosen.id, day, pB);
        } else {
          chosen = sorted.find(t =>
            !isBlocked(t, day, pA) && !isBlocked(t, day, pB) &&
            !busy(t.name, t.id, day, pA) && !busy(t.name, t.id, day, pB)
          );

          if (!chosen) {
            for (const t of sorted) {
              if (isBlocked(t, day, pA) || isBlocked(t, day, pB)) continue;
              const nameClash = [pA, pB].some(p =>
                Object.values(tt).some(days => {
                  const c = days[day]?.[p];
                  return c && isActivityCell(c) && c.teacherName === t.name;
                })
              );
              if (nameClash) continue;
              if (relocateTeacherLesson(t.id, day, pA) && relocateTeacherLesson(t.id, day, pB)) {
                chosen = t;
                break;
              }
            }
          }

          if (!chosen) {
            chosen = sorted.find(t => ![pA, pB].some(p =>
              Object.values(tt).some(days => {
                const c = days[day]?.[p];
                return c && isActivityCell(c) && c.teacherName === t.name;
              })
            )) || sorted[0];
          }
        }
        if (!chosen) continue;


        activityLoad[chosen.id] = (activityLoad[chosen.id] || 0) + 1;
        tt[ck][day][pA] = { teacherId: ACTIVITY_TEACHER_ID, teacherName: chosen.name, subjectName: ACTIVITY_SUBJECT };
        tt[ck][day][pB] = { teacherId: ACTIVITY_TEACHER_ID, teacherName: chosen.name, subjectName: ACTIVITY_SUBJECT };
      }

    };



    /**
     * محاولة أخيرة لتقليل الحصص غير الموزّعة: لكل حصة متبقية نبحث عن خانة فارغة
     * في صفّها، وإن كان المعلم مشغولاً في ذلك التوقيت نحاول نقل الحصة المتعارضة
     * إلى خانة فارغة أخرى في صفّها (بدون أي تعارض) ثم نضع الحصة المتبقية.
     * إن لم ينفع ذلك نحاول سلسلة إزاحة من مستويين (تبديل داخل الصف المتعارض).
     */
    const forcePlaceRemaining = (tt: ClassTimetable) => {
      const busyElsewhere = (teacherId: string, day: number, period: number, exceptClassKey: string) => {
        for (const [ck, days] of Object.entries(tt)) {
          if (ck === exceptClassKey) continue;
          if (days[day]?.[period]?.teacherId === teacherId) return ck;
        }
        return null;
      };
      const canHost = (teacherId: string, ck: string, day: number, period: number) => {
        if (tt[ck][day][period] !== null) return false;
        if (isLocked(ck, day, period)) return false;
        if (busyElsewhere(teacherId, day, period, ck)) return false;
        const teacher = teachers.find(t => t.id === teacherId);
        return !(teacher && isBlocked(teacher, day, period));
      };
      const { trySwap } = makeSwapper(tt);


      for (let round = 0; round < 12; round++) {
        let placed = false;
        for (const a of assignments) {
          while (a.remaining > 0) {
            let didPlace = false;
            for (let day = 0; day < daysCount && !didPlace; day++) {
              for (let period = 0; period < periodsPerDay && !didPlace; period++) {
                if (tt[a.classKey][day][period] !== null) continue;
                if (isLocked(a.classKey, day, period)) continue;
                const teacher = teachers.find(t => t.id === a.teacherId);
                if (teacher && isBlocked(teacher, day, period)) continue;

                const conflictKey = busyElsewhere(a.teacherId, day, period, a.classKey);
                if (!conflictKey) {
                  placeAssignment(a, day, period);
                  didPlace = true;
                  break;
                }
                // لا نحرّك حصص النشاط المثبّتة
                if (isLocked(conflictKey, day, period)) continue;
                // (1) حاول إزاحة الحصة المتعارضة إلى خانة فارغة أخرى في صفّها
                const conflictCell = tt[conflictKey][day][period]!;
                let moved = false;
                for (let d2 = 0; d2 < daysCount && !moved; d2++) {
                  for (let p2 = 0; p2 < periodsPerDay && !moved; p2++) {
                    if (d2 === day && p2 === period) continue;
                    if (!canHost(conflictCell.teacherId, conflictKey, d2, p2)) continue;
                    tt[conflictKey][d2][p2] = conflictCell;
                    tt[conflictKey][day][period] = null;
                    moved = true;
                  }
                }
                // (2) وإلا جرّب تبديلها مع حصة أخرى داخل صفّها (سلسلة من مستويين)
                if (!moved) {
                  for (let d2 = 0; d2 < daysCount && !moved; d2++) {
                    for (let p2 = 0; p2 < periodsPerDay && !moved; p2++) {
                      if (d2 === day && p2 === period) continue;
                      if (isLocked(conflictKey, d2, p2)) continue;
                      if (tt[conflictKey][d2][p2] === null) continue;
                      if (trySwap(conflictKey, day, period, d2, p2)) {
                        // بعد التبديل قد يصبح المعلم متفرغاً
                        if (!busyElsewhere(a.teacherId, day, period, a.classKey)) moved = true;
                        else trySwap(conflictKey, day, period, d2, p2); // تراجع
                      }
                    }
                  }
                }
                if (moved) {
                  placeAssignment(a, day, period);
                  didPlace = true;
                }

              }
            }
            if (!didPlace) break;
            placed = true;
          }
        }
        if (!placed) break;
      }
    };

    /**
     * الحصة الثامنة للصفوف التي تتجاوز 35 حصة: نحاول جعلها تربية فنية أو تربية
     * رياضية عبر تبديلها مع حصة من هذه المواد داخل نفس الصف دون إحداث تعارض.
     */
    const preferArtInLastPeriod = (tt: ClassTimetable) => {
      const { trySwap } = makeSwapper(tt);
      const isPreferred = (c: TimetableCell | null) =>
        !!c && LAST_PERIOD_PREFERRED.includes(c.subjectName.trim());

      for (const ck of Object.keys(tt)) {
        const cap = classCap[ck] ?? periodsPerDay;
        if (cap < 8) continue;
        const last = cap - 1;
        for (let day = 0; day < daysCount; day++) {
          if (!tt[ck][day][last] || isPreferred(tt[ck][day][last])) continue;
          if (isLocked(ck, day, last)) continue;
          let done = false;
          for (let d2 = 0; d2 < daysCount && !done; d2++) {
            for (let p2 = 0; p2 < cap && !done; p2++) {
              if (d2 === day && p2 === last) continue;
              if (p2 === last) continue; // لا نسحب من حصة ثامنة أخرى
              if (!isPreferred(tt[ck][d2][p2])) continue;
              if (isLocked(ck, d2, p2)) continue;
              if (trySwap(ck, day, last, d2, p2)) done = true;
            }
          }
        }
      }
    };

    // ترتيب الجولات: ملء ورصّ ← إقران المهارات الرقمية/المهني (بأي يوم، دائماً)

    // ← ملء أخير. خانات النشاط (الثانية والثالثة في يوم الصف) محجوزة منذ البداية
    // فلا يمسّها أي من هذه الجولات، ثم نُسند لها معلماً في النهاية.
    /**
     * إزالة الفراغات الداخلية: أي خانة فارغة يليها حصص في نفس اليوم تُملأ بآخر
     * حصة من يوم آخر لنفس الصف (نقلها لا يُحدث فراغاً جديداً) إن لم يوجد تعارض.
     */
    const fillInteriorGaps = (tt: ClassTimetable) => {
      for (const ck of Object.keys(tt)) {
        const cap = classCap[ck] ?? periodsPerDay;
        for (let day = 0; day < daysCount; day++) {
          for (let p = 0; p < cap; p++) {
            if (tt[ck][day][p] !== null) continue;
            if (isLocked(ck, day, p)) continue;
            // فراغ داخلي فقط (يوجد حصة بعده في نفس اليوم)
            let hasLater = false;
            for (let q = p + 1; q < cap; q++) if (tt[ck][day][q]) { hasLater = true; break; }
            if (!hasLater) continue;

            let filled = false;
            for (let d2 = 0; d2 < daysCount && !filled; d2++) {
              if (d2 === day) continue;
              // آخر حصة في اليوم الآخر
              let lastIdx = -1;
              for (let q = cap - 1; q >= 0; q--) if (tt[ck][d2][q]) { lastIdx = q; break; }
              if (lastIdx < 0) continue;
              const cell = tt[ck][d2][lastIdx]!;
              if (isActivityCell(cell) || isLocked(ck, d2, lastIdx)) continue;
              let conflict = false;
              for (const [otherKey, otherDays] of Object.entries(tt)) {
                if (otherKey === ck) continue;
                if (otherDays[day]?.[p]?.teacherId === cell.teacherId) { conflict = true; break; }
              }
              if (conflict) continue;
              const teacher = teachers.find(t => t.id === cell.teacherId);
              if (teacher && isBlocked(teacher, day, p)) continue;
              tt[ck][day][p] = cell;
              tt[ck][d2][lastIdx] = null;
              filled = true;
            }
          }
        }
      }
    };

    /**
     * قيد إلزامي: المهارات الرقمية / التربية المهنية حصتان متتاليتان.
     * جولة صارمة تعمل بعد الإقران العادي: تُخلي الخانة المجاورة بالقوة عبر
     * نقل الحصة المتعارضة في الصف الآخر إلى خانة فارغة أو تبديلها داخل صفها.
     */
    const enforceDoublePairsStrict = (tt: ClassTimetable) => {
      const teacherFreeAt = (teacherId: string, day: number, period: number, exceptCk: string) => {
        for (const [ck, days] of Object.entries(tt)) {
          if (ck === exceptCk) continue;
          if (days[day]?.[period]?.teacherId === teacherId) return false;
        }
        const teacher = teachers.find(t => t.id === teacherId);
        return !(teacher && isBlocked(teacher, day, period));
      };

      /** إخلاء المعلم في توقيت محدد بنقل حصته في صف آخر أو تبديلها داخل صفها */
      const forceFreeTeacher = (teacherId: string, day: number, period: number, exceptCk: string): boolean => {
        const teacher = teachers.find(t => t.id === teacherId);
        if (teacher && isBlocked(teacher, day, period)) return false;
        for (const [ck2, days] of Object.entries(tt)) {
          if (ck2 === exceptCk) continue;
          const cell = days[day]?.[period];
          if (!cell || cell.teacherId !== teacherId) continue;
          if (isLocked(ck2, day, period) || isActivityCell(cell)) return false;
          const cap2 = classCap[ck2] ?? periodsPerDay;
          // 1) خانة فارغة داخل نفس الصف
          for (let d2 = 0; d2 < daysCount; d2++) {
            for (let p2 = 0; p2 < cap2; p2++) {
              if (tt[ck2][d2][p2] !== null || isLocked(ck2, d2, p2)) continue;
              if (!teacherFreeAt(teacherId, d2, p2, ck2)) continue;
              tt[ck2][d2][p2] = cell;
              tt[ck2][day][period] = null;
              return true;
            }
          }
          // 2) تبديل داخل نفس الصف مع حصة أخرى بلا تعارض
          for (let d2 = 0; d2 < daysCount; d2++) {
            for (let p2 = 0; p2 < cap2; p2++) {
              if (d2 === day && p2 === period) continue;
              const other = tt[ck2][d2][p2];
              if (!other || isActivityCell(other) || isLocked(ck2, d2, p2)) continue;
              if (!teacherFreeAt(teacherId, d2, p2, ck2)) continue;
              if (!teacherFreeAt(other.teacherId, day, period, ck2)) continue;
              tt[ck2][d2][p2] = cell;
              tt[ck2][day][period] = other;
              return true;
            }
          }
          return false;
        }
        return true;
      };

      const ensureFree = (teacherId: string, day: number, period: number, ck: string) =>
        teacherFreeAt(teacherId, day, period, ck) || forceFreeTeacher(teacherId, day, period, ck);

      for (const ck of Object.keys(tt)) {
        const cap = classCap[ck] ?? periodsPerDay;
        for (const subject of DOUBLE_PERIOD_SUBJECTS) {
          for (let pass = 0; pass < 10; pass++) {
            const spots: { day: number; period: number }[] = [];
            for (let d = 0; d < daysCount; d++) {
              for (let p = 0; p < cap; p++) {
                if (tt[ck][d]?.[p]?.subjectName === subject) spots.push({ day: d, period: p });
              }
            }
            const lonely = spots.filter(s => !(
              tt[ck][s.day]?.[s.period - 1]?.subjectName === subject ||
              tt[ck][s.day]?.[s.period + 1]?.subjectName === subject
            ));
            if (lonely.length < 2) break;

            const anchor = lonely[0];
            const partner = lonely[1];
            const anchorCell = tt[ck][anchor.day][anchor.period]!;
            let done = false;

            for (const neighbor of [anchor.period + 1, anchor.period - 1]) {
              if (neighbor < 0 || neighbor >= cap) continue;
              if (isLocked(ck, anchor.day, neighbor) || isLocked(ck, partner.day, partner.period)) continue;
              const target = tt[ck][anchor.day][neighbor];
              if (isActivityCell(target)) continue;
              const partnerCell = tt[ck][partner.day][partner.period]!;
              if (!partnerCell) continue;
              if (partner.day === anchor.day && partner.period === neighbor) { done = true; break; }
              if (!ensureFree(partnerCell.teacherId, anchor.day, neighbor, ck)) continue;
              if (target && !ensureFree(target.teacherId, partner.day, partner.period, ck)) continue;
              tt[ck][anchor.day][neighbor] = partnerCell;
              tt[ck][partner.day][partner.period] = target ?? null;
              done = true;
              break;
            }
            if (!done) {
              // الحل الأخير: نقل حصة المرساة بجانب الشريك
              let moved = false;
              for (const neighbor of [partner.period + 1, partner.period - 1]) {
                if (neighbor < 0 || neighbor >= cap) continue;
                if (isLocked(ck, partner.day, neighbor)) continue;
                const target = tt[ck][partner.day][neighbor];
                if (isActivityCell(target)) continue;
                if (!ensureFree(anchorCell.teacherId, partner.day, neighbor, ck)) continue;
                if (target && !ensureFree(target.teacherId, anchor.day, anchor.period, ck)) continue;
                tt[ck][partner.day][neighbor] = anchorCell;
                tt[ck][anchor.day][anchor.period] = target ?? null;
                moved = true;
                break;
              }
              if (!moved) break;
            }
          }
        }
      }
    };

    /** عدد التعارضات: معلم واحد في أكثر من صف بنفس اليوم والحصة */
    const countConflicts = (tt: ClassTimetable) => {
      const seen = new Map<string, number>();
      for (const days of Object.values(tt)) {
        days.forEach((row, d) => row.forEach((cell, p) => {
          if (!cell || isActivityCell(cell)) return;
          const k = `${cell.teacherId}|${d}|${p}`;
          seen.set(k, (seen.get(k) ?? 0) + 1);
        }));
      }
      let c = 0;
      seen.forEach(v => { if (v > 1) c += v - 1; });
      return c;
    };

    /** تشغيل الجولة الصارمة على نسخة، واعتمادها فقط إن لم تُنتج تعارضات جديدة */
    const applyStrictSafely = (tt: ClassTimetable) => {
      const before = countConflicts(tt);
      const clone: ClassTimetable = JSON.parse(JSON.stringify(tt));
      enforceDoublePairsStrict(clone);
      if (countConflicts(clone) > before) return;
      for (const ck of Object.keys(tt)) tt[ck] = clone[ck];
    };

    /** هل المعلم متفرغ في هذا التوقيت (خارج الصف المستثنى)؟ */
    const teacherIsFree = (tt: ClassTimetable, teacherId: string, day: number, period: number, exceptCk: string) => {
      for (const [ck2, days] of Object.entries(tt)) {
        if (ck2 === exceptCk) continue;
        if (days[day]?.[period]?.teacherId === teacherId) return false;
      }
      const t = teachers.find(x => x.id === teacherId);
      return !(t && isBlocked(t, day, period));
    };

    /**
     * إزالة الفراغات الداخلية نهائياً: لا يجوز وجود حصة فارغة يليها حصص في نفس
     * اليوم. تُسحب حصة لاحقة من نفس اليوم إلى الفراغ، وإن تعارض المعلم يُنقل
     * المتعارض في صفه إلى خانة فارغة أخرى ثم يتم السحب. الفراغ يبقى في النهاية فقط.
     */
    const eliminateInteriorGaps = (tt: ClassTimetable) => {
      for (let pass = 0; pass < 40; pass++) {
        let changed = false;
        for (const ck of Object.keys(tt)) {
          const cap = classCap[ck] ?? periodsPerDay;
          for (let day = 0; day < daysCount; day++) {
            for (let p = 0; p < cap; p++) {
              if (tt[ck][day][p] !== null || isLocked(ck, day, p)) continue;
              let hasLater = false;
              for (let q = p + 1; q < cap; q++) if (tt[ck][day][q]) { hasLater = true; break; }
              if (!hasLater) continue;

              // مرشحون: من آخر اليوم إلى الأقرب
              for (let q = cap - 1; q > p; q--) {
                const cell = tt[ck][day][q];
                if (!cell || isActivityCell(cell) || isLocked(ck, day, q)) continue;
                const t = teachers.find(x => x.id === cell.teacherId);
                if (t && isBlocked(t, day, p)) continue;

                if (teacherIsFree(tt, cell.teacherId, day, p, ck)) {
                  tt[ck][day][p] = cell;
                  tt[ck][day][q] = null;
                  changed = true;
                  break;
                }

                // إخلاء المعلم: نقل حصته المتعارضة في الصف الآخر إلى خانة فارغة
                let blockerCk = "";
                for (const [ck2, days] of Object.entries(tt)) {
                  if (ck2 === ck) continue;
                  if (days[day]?.[p]?.teacherId === cell.teacherId) { blockerCk = ck2; break; }
                }
                if (!blockerCk) continue;
                const blockerCell = tt[blockerCk][day][p];
                if (!blockerCell || isActivityCell(blockerCell) || isLocked(blockerCk, day, p)) continue;
                const cap2 = classCap[blockerCk] ?? periodsPerDay;
                let relocated = false;
                for (let d2 = 0; d2 < daysCount && !relocated; d2++) {
                  for (let p2 = 0; p2 < cap2; p2++) {
                    if (tt[blockerCk][d2][p2] !== null || isLocked(blockerCk, d2, p2)) continue;
                    // لا نصنع فراغاً داخلياً جديداً في الصف الآخر
                    if (!teacherIsFree(tt, blockerCell.teacherId, d2, p2, blockerCk)) continue;
                    tt[blockerCk][d2][p2] = blockerCell;
                    tt[blockerCk][day][p] = null;
                    relocated = true;
                    break;
                  }
                }
                if (!relocated) continue;
                tt[ck][day][p] = cell;
                tt[ck][day][q] = null;
                changed = true;
                break;
              }
            }
          }
        }
        if (!changed) break;
      }
    };

    /**
     * موازنة نصاب المعلم اليومي: محاولة جعل عدد حصص المعلم متقارباً في جميع
     * أيام الأسبوع بنقل حصة من أثقل يوم إلى أخف يوم داخل نفس الصف دون تعارض.
     */
    const balanceTeacherDailyLoad = (tt: ClassTimetable) => {
      const counts = () => {
        const m: Record<string, number[]> = {};
        for (const days of Object.values(tt)) {
          days.forEach((row, d) => row.forEach(cell => {
            if (!cell || isActivityCell(cell)) return;
            if (!m[cell.teacherId]) m[cell.teacherId] = Array(daysCount).fill(0);
            m[cell.teacherId][d] += 1;
          }));
        }
        return m;
      };

      for (let pass = 0; pass < 25; pass++) {
        let changed = false;
        const m = counts();
        for (const [teacherId, perDay] of Object.entries(m)) {
          const max = Math.max(...perDay);
          const min = Math.min(...perDay);
          if (max - min < 2) continue;
          const heavy = perDay.indexOf(max);
          const light = perDay.indexOf(min);
          let moved = false;
          for (const ck of Object.keys(tt)) {
            if (moved) break;
            const cap = classCap[ck] ?? periodsPerDay;
            for (let p = cap - 1; p >= 0; p--) {
              const cell = tt[ck][heavy][p];
              if (!cell || cell.teacherId !== teacherId) continue;
              if (isActivityCell(cell) || isLocked(ck, heavy, p)) continue;
              // لا ننقل إن كان يكسر إقران الحصص المزدوجة
              if (DOUBLE_PERIOD_SUBJECTS.includes(cell.subjectName)) continue;
              // خانة فارغة في اليوم الخفيف بلا فراغ داخلي جديد
              for (let p2 = 0; p2 < cap; p2++) {
                if (tt[ck][light][p2] !== null || isLocked(ck, light, p2)) continue;
                let laterExists = false;
                for (let z = p2 + 1; z < cap; z++) if (tt[ck][light][z]) { laterExists = true; break; }
                if (laterExists) continue;
                if (!teacherIsFree(tt, teacherId, light, p2, ck)) continue;
                tt[ck][light][p2] = cell;
                tt[ck][heavy][p] = null;
                moved = true;
                changed = true;
                break;
              }
              if (moved) break;
            }
          }
        }
        if (!changed) break;
      }
    };

    for (let i = 0; i < 3; i++) {
      forcePlaceRemaining(newTT);
      compactTimetable(newTT);
    }
    if (pairDoubleSubjects) {
      for (let r = 0; r < 3; r++) {
        forcePlaceRemaining(newTT);
        pairDoublePeriodSubjects(newTT);
      }
      pairDoublePeriodSubjects(newTT);
      for (let s = 0; s < 3; s++) applyStrictSafely(newTT);
    }
    forcePlaceRemaining(newTT);
    if (constraints.fillGaps) {
      for (let g = 0; g < 3; g++) {
        fillInteriorGaps(newTT);
        compactTimetable(newTT);
      }
    }
    /** تشغيل أي جولة على نسخة، واعتمادها فقط إن لم تزد التعارضات */
    const applySafely = (tt: ClassTimetable, fn: (t: ClassTimetable) => void) => {
      const before = countConflicts(tt);
      const clone: ClassTimetable = JSON.parse(JSON.stringify(tt));
      fn(clone);
      if (countConflicts(clone) > before) return;
      for (const ck of Object.keys(tt)) tt[ck] = clone[ck];
    };

    /**
     * ضمان نهائي: صفر تعارضات. أي معلم موجود في أكثر من صف بنفس اليوم والحصة
     * تُنقل حصصه الزائدة إلى خانة فارغة آمنة، وإن تعذّر تُرفع إلى المنطقة الفارغة.
     */
    const droppedCells: { teacherId: string; teacherName: string; subjectName: string; classKey: string }[] = [];
    const resolveAllConflicts = (tt: ClassTimetable) => {
      for (let pass = 0; pass < 20; pass++) {
        const occupied = new Map<string, string>(); // teacher|day|period -> classKey
        let fixed = false;
        for (const ck of Object.keys(tt)) {
          const cap = classCap[ck] ?? periodsPerDay;
          for (let d = 0; d < daysCount; d++) {
            for (let p = 0; p < cap; p++) {
              const cell = tt[ck][d][p];
              if (!cell || isActivityCell(cell)) continue;
              const key = `${cell.teacherId}|${d}|${p}`;
              if (!occupied.has(key)) { occupied.set(key, ck); continue; }
              // تعارض: أخرج هذه الحصة إلى خانة آمنة
              fixed = true;
              let placed = false;
              for (let d2 = 0; d2 < daysCount && !placed; d2++) {
                for (let p2 = 0; p2 < cap; p2++) {
                  if (tt[ck][d2][p2] !== null || isLocked(ck, d2, p2)) continue;
                  if (!teacherIsFree(tt, cell.teacherId, d2, p2, ck)) continue;
                  tt[ck][d2][p2] = cell;
                  placed = true;
                  break;
                }
              }
              tt[ck][d][p] = null;
              if (!placed) {
                droppedCells.push({
                  teacherId: cell.teacherId,
                  teacherName: cell.teacherName,
                  subjectName: cell.subjectName,
                  classKey: ck,
                });
              }
            }
          }
        }
        if (!fixed) break;
      }
    };

    if (constraints.preferArtLastPeriod) preferArtInLastPeriod(newTT);
    if (constraints.balanceTeacherDaily) applySafely(newTT, balanceTeacherDailyLoad);
    if (constraints.fillGaps) {
      applySafely(newTT, fillInteriorGaps);
      compactTimetable(newTT);
      applySafely(newTT, eliminateInteriorGaps);
    }
    if (pairDoubleSubjects) applyStrictSafely(newTT);
    if (constraints.fillGaps) applySafely(newTT, eliminateInteriorGaps);
    if (activityPeriods) assignActivityTeachers(newTT);
    // ضمان نهائي: لا تعارضات إطلاقاً، ثم رصّ الفراغات الناتجة
    resolveAllConflicts(newTT);
    // ثم رصّ نهائي للفراغات (لا يُنتج تعارضات لأنه يتحقق من تفرّغ المعلم)
    if (constraints.fillGaps) {
      for (let f = 0; f < 3; f++) applySafely(newTT, eliminateInteriorGaps);
    }













    // Collect unplaced periods
    const newUnplaced: UnplacedPeriod[] = [];
    for (const assignment of assignments) {
      if (assignment.remaining > 0) {
        newUnplaced.push({
          teacherId: assignment.teacherId,
          teacherName: assignment.teacherName,
          subjectName: assignment.subjectName,
          classKey: assignment.classKey,
          count: assignment.remaining,
        });
      }
    }
    // أي حصة أُخرجت لحل تعارض تُضاف إلى الحصص غير الموزّعة
    for (const d of droppedCells) {
      const existing = newUnplaced.find(
        u => u.teacherId === d.teacherId && u.classKey === d.classKey && u.subjectName === d.subjectName
      );
      if (existing) existing.count += 1;
      else newUnplaced.push({ ...d, count: 1 });
    }
    setUnplacedPeriods(newUnplaced);

    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);
  };

  const generateDailySchedule = (day: number, absentTeacherIds: string[]): ClassTimetable => {
    const dailyTT: ClassTimetable = {};
    for (const [classKey, days] of Object.entries(timetable)) {
      dailyTT[classKey] = [days[day].map(cell => cell ? { ...cell } : null)];
    }
    if (absentTeacherIds.length === 0) return dailyTT;
    for (const classKey of Object.keys(dailyTT)) {
      const periods = dailyTT[classKey][0];
      for (let p = 0; p < periods.length; p++) {
        if (periods[p] && absentTeacherIds.includes(periods[p]!.teacherId)) {
          periods[p] = null;
        }
      }
    }
    for (const classKey of Object.keys(dailyTT)) {
      const periods = dailyTT[classKey][0];
      const filled = periods.filter(p => p !== null);
      const compacted = [...filled, ...Array(periodsPerDay - filled.length).fill(null)];
      dailyTT[classKey] = [compacted];
    }
    return dailyTT;
  };

  return (
    <TimetableContext.Provider value={{
      teachers, timetable, unplacedPeriods, periodsPerDay, setPeriodsPerDay,
      pairDoubleSubjects, setPairDoubleSubjects,
      activityPeriods, setActivityPeriods,
      constraints, setConstraint,
      savedTimetables, saveCurrentTimetable, restoreSavedTimetable, deleteSavedTimetable, importSavedTimetables,
      addTeacher, updateTeacher, removeTeacher,
      setTimetable, updateCell, swapCells, swapCellsAcrossDays, moveCell, placeFromStaging, moveToStaging, generateTimetable,
      getTeacherSchedule, getAllClassKeys, reorderClasses, clearTimetable,
      generateDailySchedule,
    }}>
      {children}
    </TimetableContext.Provider>
  );
}

export function useTimetable() {
  const ctx = useContext(TimetableContext);
  if (!ctx) throw new Error("useTimetable must be used within TimetableProvider");
  return ctx;
}
