import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Teacher, ClassTimetable, TimetableCell } from "@/types/timetable";
import { getClassKey, DAYS, MAX_PERIODS } from "@/types/timetable";

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
  addTeacher: (teacher: Teacher) => void;
  updateTeacher: (teacher: Teacher) => void;
  removeTeacher: (id: string) => void;
  setTimetable: (tt: ClassTimetable) => void;
  updateCell: (classKey: string, day: number, period: number, cell: TimetableCell | null) => void;
  swapCells: (classKey: string, day: number, period: number, periodA: number) => boolean;
  placeFromStaging: (stagingIdx: number, classKey: string, day: number, period: number) => boolean;
  generateTimetable: () => void;
  getTeacherSchedule: (teacherId: string) => { classKey: string; day: number; period: number; subjectName: string }[];
  getAllClassKeys: () => string[];
  clearTimetable: () => void;
  generateDailySchedule: (day: number, absentTeacherIds: string[]) => ClassTimetable;
}

const TimetableContext = createContext<TimetableContextType | null>(null);

const STORAGE_KEY = "school_timetable_data";

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

          if (period === sixthPeriodIdx) score += 35 + latePeriodCount[assignment.teacherId].sixth * 5;
          if (period === seventhPeriodIdx) score += 55 + latePeriodCount[assignment.teacherId].seventh * 6;

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
          if (sixthCell) latePeriodCount[sixthCell.teacherId].sixth += 1;
        }
        if (seventhPeriodIdx >= 0) {
          const seventhCell = days[day]?.[seventhPeriodIdx];
          if (seventhCell) latePeriodCount[seventhCell.teacherId].seventh += 1;
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
      addTeacher, updateTeacher, removeTeacher,
      setTimetable, updateCell, swapCells, placeFromStaging, generateTimetable,
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
