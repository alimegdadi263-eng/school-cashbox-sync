import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Teacher, ClassTimetable, TimetableCell } from "@/types/timetable";
import { getClassKey, parseClassKey, DAYS, MAX_PERIODS, DOUBLE_PERIOD_SUBJECTS, ACTIVITY_TEACHER_ID, ACTIVITY_SUBJECT, ACTIVITY_PERIODS, getActivityDay, isActivityCell } from "@/types/timetable";

export interface UnplacedPeriod {
  teacherId: string;
  teacherName: string;
  subjectName: string;
  classKey: string;
  count: number;
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
  addTeacher: (teacher: Teacher) => void;
  updateTeacher: (teacher: Teacher) => void;
  removeTeacher: (id: string) => void;
  setTimetable: (tt: ClassTimetable) => void;
  updateCell: (classKey: string, day: number, period: number, cell: TimetableCell | null) => void;
  swapCells: (classKey: string, day: number, period: number, periodA: number) => boolean;
  moveCell: (classKey: string, fromDay: number, fromPeriod: number, toDay: number, toPeriod: number) => boolean;

  moveToStaging: (classKey: string, day: number, period: number) => boolean;
  placeFromStaging: (stagingIdx: number, classKey: string, day: number, period: number) => boolean;
  generateTimetable: () => void;
  getTeacherSchedule: (teacherId: string) => { classKey: string; day: number; period: number; subjectName: string }[];
  getAllClassKeys: () => string[];
  clearTimetable: () => void;
  generateDailySchedule: (day: number, absentTeacherIds: string[]) => ClassTimetable;
}

const TimetableContext = createContext<TimetableContextType | null>(null);

const STORAGE_KEY = "school_timetable_data";
const DOUBLE_KEY = "school_timetable_pair_double";
const ACTIVITY_KEY = "school_timetable_activity_periods";

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
  const [pairDoubleSubjects, setPairDoubleSubjectsState] = useState<boolean>(() => {
    try { return localStorage.getItem(DOUBLE_KEY) === "1"; } catch { return false; }
  });

  const [activityPeriods, setActivityPeriodsState] = useState<boolean>(() => {
    try { return localStorage.getItem(ACTIVITY_KEY) === "1"; } catch { return false; }
  });

  const setActivityPeriods = (v: boolean) => {
    setActivityPeriodsState(v);
    try { localStorage.setItem(ACTIVITY_KEY, v ? "1" : "0"); } catch {}
  };

  const setPairDoubleSubjects = (v: boolean) => {
    setPairDoubleSubjectsState(v);
    try { localStorage.setItem(DOUBLE_KEY, v ? "1" : "0"); } catch {}
  };

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

  const addTeacher = (teacher: Teacher) => {
    setTeachers(prev => {
      const next = [...prev, teacher];
      save(next, timetable, periodsPerDay);
      return next;
    });
  };

  const updateTeacher = (teacher: Teacher) => {
    setTeachers(prev => {
      const next = prev.map(t => t.id === teacher.id ? teacher : t);
      save(next, timetable, periodsPerDay);
      return next;
    });
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
    return Array.from(keys).sort();
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

    // ملاحظة: حصص النشاط لم تعد تُحجز بخانات فارغة باسم "نشاط"،
    // بل تُوزَّع حصص المعلمين كالمعتاد ثم نجعل الحصتين الثانية والثالثة
    // في يوم النشاط لنفس الصف متتاليتين لنفس المعلم والمادة (انظر alignActivityDouble).


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
                  if (otherPeriods[np] === null) {
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

    alignLateDays(newTT);

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


      for (const ck of Object.keys(tt)) {
        for (const subject of DOUBLE_PERIOD_SUBJECTS) {
          for (let pass = 0; pass < 10; pass++) {
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

            const anchor = lonely[0];
            let done = false;

            for (const neighbor of [anchor.period + 1, anchor.period - 1]) {
              if (neighbor < 0 || neighbor >= periodsPerDay) continue;
              const target = tt[ck][anchor.day][neighbor];
              if (isActivityCell(target)) continue;

              for (const other of lonely.slice(1)) {
                if (other.day === anchor.day) continue;
                const otherCell = tt[ck][other.day][other.period]!;
                if (!freeAt(otherCell.teacherId, anchor.day, neighbor, ck)) continue;
                if (target && !freeAt(target.teacherId, other.day, other.period, ck)) continue;

                tt[ck][anchor.day][neighbor] = otherCell;
                tt[ck][other.day][other.period] = target;
                done = true;
                break;
              }
              if (done) break;
            }

            if (!done) break;
          }
        }
      }
    };

    if (pairDoubleSubjects) pairDoublePeriodSubjects(newTT);

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
        const a = tt[ck][d1][p1];
        const b = tt[ck][d2][p2];
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
     * حصص النشاط: لكل صف له يوم نشاط محدّد (الأول–الرابع الأحد، الخامس–السابع الاثنين،
     * الثامن–العاشر الثلاثاء) نجعل الحصتين الثانية والثالثة في ذلك اليوم متتاليتين
     * لنفس المعلم ونفس المادة، بحيث تظهران في الملحفة كحصص عادية باسم المعلم والمادة.
     * نُفضّل مادة من مواد الحصص المزدوجة (المهارات الرقمية / التربية المهنية) إن وُجدت.
     */
    const alignActivityDouble = (tt: ClassTimetable) => {
      const [pA, pB] = ACTIVITY_PERIODS;
      if (pB >= periodsPerDay) return;
      const { trySwap } = makeSwapper(tt);

      for (const ck of Object.keys(tt)) {
        const { className } = parseClassKey(ck);
        const day = getActivityDay(className);
        if (day === undefined || day >= daysCount) continue;

        // اجمع كل حصص الصف مجمّعة حسب (المعلم + المادة)
        const groups: Record<string, { teacherId: string; subjectName: string; spots: { day: number; period: number }[] }> = {};
        for (let d = 0; d < daysCount; d++) {
          for (let p = 0; p < periodsPerDay; p++) {
            const c = tt[ck][d][p];
            if (!c) continue;
            const k = `${c.teacherId}|${c.subjectName}`;
            if (!groups[k]) groups[k] = { teacherId: c.teacherId, subjectName: c.subjectName, spots: [] };
            groups[k].spots.push({ day: d, period: p });
          }
        }

        const candidates = Object.values(groups).filter(g => g.spots.length >= 2);
        if (candidates.length === 0) continue;

        const cur = tt[ck][day][pA] || tt[ck][day][pB];
        candidates.sort((a, b) => {
          const score = (g: typeof a) => {
            let s = 0;
            if (DOUBLE_PERIOD_SUBJECTS.includes(g.subjectName)) s -= 100;
            if (cur && g.teacherId === cur.teacherId && g.subjectName === cur.subjectName) s -= 50;
            s -= g.spots.length; // الأكثر حصصاً أسهل في التحريك
            return s;
          };
          return score(a) - score(b);
        });

        const isMatch = (d: number, p: number, g: { teacherId: string; subjectName: string }) => {
          const c = tt[ck][d][p];
          return !!c && c.teacherId === g.teacherId && c.subjectName === g.subjectName;
        };

        for (const g of candidates) {
          // نسخة احتياطية للتراجع في حال فشل ملء الخانتين
          const backup = tt[ck].map(row => row.slice());
          let ok = true;

          for (const targetP of [pA, pB]) {
            if (isMatch(day, targetP, g)) continue;
            let filled = false;
            // ابحث عن حصة لنفس المعلم/المادة في مكان آخر وبدّلها مع خانة الهدف
            for (let d2 = 0; d2 < daysCount && !filled; d2++) {
              for (let p2 = 0; p2 < periodsPerDay && !filled; p2++) {
                if (d2 === day && (p2 === pA || p2 === pB)) continue;
                if (!isMatch(d2, p2, g)) continue;
                if (trySwap(ck, day, targetP, d2, p2)) filled = true;
              }
            }
            if (!filled) { ok = false; break; }
          }

          if (ok && isMatch(day, pA, g) && isMatch(day, pB, g)) break;
          tt[ck] = backup; // تراجع وجرّب مرشحاً آخر
        }
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
        if (busyElsewhere(teacherId, ck === undefined ? day : day, period, ck)) return false;
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
                const teacher = teachers.find(t => t.id === a.teacherId);
                if (teacher && isBlocked(teacher, day, period)) continue;

                const conflictKey = busyElsewhere(a.teacherId, day, period, a.classKey);
                if (!conflictKey) {
                  placeAssignment(a, day, period);
                  didPlace = true;
                  break;
                }
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

    // جولات متتابعة: ملء أقصى ما يمكن ← رصّ ← ضبط حصص النشاط
    for (let i = 0; i < 3; i++) {
      forcePlaceRemaining(newTT);
      compactTimetable(newTT);
    }
    if (activityPeriods) alignActivityDouble(newTT);
    forcePlaceRemaining(newTT);
    if (activityPeriods) alignActivityDouble(newTT);







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
      addTeacher, updateTeacher, removeTeacher,
      setTimetable, updateCell, swapCells, moveCell, placeFromStaging, moveToStaging, generateTimetable,
      getTeacherSchedule, getAllClassKeys, clearTimetable,
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
