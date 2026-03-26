import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Teacher, ClassTimetable, TimetableCell } from "@/types/timetable";
import { getClassKey, DAYS, MAX_PERIODS } from "@/types/timetable";

interface TimetableContextType {
  teachers: Teacher[];
  timetable: ClassTimetable;
  periodsPerDay: number;
  setPeriodsPerDay: (n: number) => void;
  addTeacher: (teacher: Teacher) => void;
  updateTeacher: (teacher: Teacher) => void;
  removeTeacher: (id: string) => void;
  setTimetable: (tt: ClassTimetable) => void;
  updateCell: (classKey: string, day: number, period: number, cell: TimetableCell | null) => void;
  swapCells: (classKey: string, day: number, periodA: number, periodB: number) => boolean;
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

export function TimetableProvider({ children }: { children: React.ReactNode }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetable, setTimetableState] = useState<ClassTimetable>({});
  const [periodsPerDay, setPeriodsPerDayState] = useState(7);

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

  // Bidirectional LAN sync - both server and client pull changes
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
    const next = [...teachers, teacher];
    setTeachers(next);
    save(next, timetable, periodsPerDay);
  };

  const updateTeacher = (teacher: Teacher) => {
    const next = teachers.map(t => t.id === teacher.id ? teacher : t);
    setTeachers(next);
    save(next, timetable, periodsPerDay);
  };

  const removeTeacher = (id: string) => {
    const next = teachers.filter(t => t.id !== id);
    setTeachers(next);
    const newTT = { ...timetable };
    for (const key of Object.keys(newTT)) {
      newTT[key] = newTT[key].map(day =>
        day.map(cell => (cell && cell.teacherId === id ? null : cell))
      );
    }
    setTimetableState(newTT);
    save(next, newTT, periodsPerDay);
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

  // Swap two cells in the same class & day, checking for teacher conflicts
  const swapCells = (classKey: string, day: number, periodA: number, periodB: number): boolean => {
    const newTT = { ...timetable };
    if (!newTT[classKey]) return false;
    const cellA = newTT[classKey][day][periodA];
    const cellB = newTT[classKey][day][periodB];

    // Check conflicts: if cellA's teacher is already in periodB elsewhere, or cellB's teacher in periodA
    const wouldConflict = (teacherId: string | undefined, period: number) => {
      if (!teacherId) return false;
      for (const [key, days] of Object.entries(newTT)) {
        if (key === classKey) continue;
        if (days[day]?.[period]?.teacherId === teacherId) return true;
      }
      return false;
    };

    if (wouldConflict(cellA?.teacherId, periodB) || wouldConflict(cellB?.teacherId, periodA)) {
      return false; // conflict
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

    const teacherUsage: Record<string, Set<number>[]> = {};
    teachers.forEach(t => {
      teacherUsage[t.id] = Array.from({ length: daysCount }, () => new Set<number>());
    });

    // Track 6th and 7th period counts per teacher for equal distribution
    const latePeriodCount: Record<string, { sixth: number; seventh: number }> = {};
    teachers.forEach(t => { latePeriodCount[t.id] = { sixth: 0, seventh: 0 }; });

    interface Assignment {
      teacherId: string;
      teacherName: string;
      subjectName: string;
      classKey: string;
      remaining: number;
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
          remaining: s.periodsPerWeek,
        });
      });
    });

    // Sort by most periods first for better distribution
    assignments.sort((a, b) => b.remaining - a.remaining);

    const sixthPeriodIdx = periodsPerDay - 2;
    const seventhPeriodIdx = periodsPerDay - 1;

    for (const assignment of assignments) {
      let placed = 0;
      const dayOrder = Array.from({ length: daysCount }, (_, i) => i);
      const teacher = teachers.find(t => t.id === assignment.teacherId)!;

      while (placed < assignment.remaining) {
        let didPlace = false;
        dayOrder.sort(() => Math.random() - 0.5);

        for (const day of dayOrder) {
          if (placed >= assignment.remaining) break;

          const alreadyThisClassThisDay = newTT[assignment.classKey][day].some(
            c => c && c.teacherId === assignment.teacherId && c.subjectName === assignment.subjectName
          );
          if (alreadyThisClassThisDay && placed < assignment.remaining - 1) continue;

          // Build period priority: early periods first, then late periods with fairness check
          const periodOrder: number[] = [];
          for (let p = 0; p < periodsPerDay; p++) {
            if (p !== sixthPeriodIdx && p !== seventhPeriodIdx) periodOrder.push(p);
          }
          // Shuffle early periods for variety
          periodOrder.sort(() => Math.random() - 0.5);

          // Add 6th and 7th with fairness - teacher with fewer late periods gets priority
          const allSixthCounts = Object.values(latePeriodCount).map(c => c.sixth);
          const allSeventhCounts = Object.values(latePeriodCount).map(c => c.seventh);
          const minSixth = Math.min(...allSixthCounts);
          const minSeventh = Math.min(...allSeventhCounts);

          // Only allow 6th if teacher isn't too far ahead
          if (latePeriodCount[assignment.teacherId].sixth <= minSixth + 1) {
            periodOrder.push(sixthPeriodIdx);
          }
          if (latePeriodCount[assignment.teacherId].seventh <= minSeventh + 1) {
            periodOrder.push(seventhPeriodIdx);
          }

          for (const period of periodOrder) {
            if (newTT[assignment.classKey][day][period] !== null) continue;
            if (teacherUsage[assignment.teacherId][day].has(period)) continue;
            if (isBlocked(teacher, day, period)) continue;

            newTT[assignment.classKey][day][period] = {
              teacherId: assignment.teacherId,
              teacherName: assignment.teacherName,
              subjectName: assignment.subjectName,
            };
            teacherUsage[assignment.teacherId][day].add(period);
            if (period === sixthPeriodIdx) latePeriodCount[assignment.teacherId].sixth++;
            if (period === seventhPeriodIdx) latePeriodCount[assignment.teacherId].seventh++;
            placed++;
            didPlace = true;
            break;
          }
        }

        if (!didPlace) {
          // Fallback: place anywhere possible including late periods
          for (let day = 0; day < daysCount && placed < assignment.remaining; day++) {
            for (let period = 0; period < periodsPerDay; period++) {
              if (newTT[assignment.classKey][day][period] !== null) continue;
              if (teacherUsage[assignment.teacherId][day].has(period)) continue;
              if (isBlocked(teacher, day, period)) continue;
              newTT[assignment.classKey][day][period] = {
                teacherId: assignment.teacherId,
                teacherName: assignment.teacherName,
                subjectName: assignment.subjectName,
              };
              teacherUsage[assignment.teacherId][day].add(period);
              if (period === sixthPeriodIdx) latePeriodCount[assignment.teacherId].sixth++;
              if (period === seventhPeriodIdx) latePeriodCount[assignment.teacherId].seventh++;
              placed++;
              break;
            }
          }
          break;
        }
      }
    }

    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);
  };

  // Generate daily schedule handling absent teachers
  const generateDailySchedule = (day: number, absentTeacherIds: string[]): ClassTimetable => {
    const dailyTT: ClassTimetable = {};
    
    // Deep copy original timetable for this day only
    for (const [classKey, days] of Object.entries(timetable)) {
      dailyTT[classKey] = [days[day].map(cell => cell ? { ...cell } : null)];
    }

    if (absentTeacherIds.length === 0) return dailyTT;

    // Remove absent teachers' periods
    for (const classKey of Object.keys(dailyTT)) {
      const periods = dailyTT[classKey][0];
      for (let p = 0; p < periods.length; p++) {
        if (periods[p] && absentTeacherIds.includes(periods[p]!.teacherId)) {
          periods[p] = null;
        }
      }
    }

    // Compact: move periods up to fill gaps, prioritize removing from end (7th, 6th...)
    for (const classKey of Object.keys(dailyTT)) {
      const periods = dailyTT[classKey][0];
      // Collect non-null periods
      const filled = periods.filter(p => p !== null);
      // Pad with nulls at the end
      const compacted = [...filled, ...Array(periodsPerDay - filled.length).fill(null)];
      dailyTT[classKey] = [compacted];
    }

    return dailyTT;
  };

  return (
    <TimetableContext.Provider value={{
      teachers, timetable, periodsPerDay, setPeriodsPerDay,
      addTeacher, updateTeacher, removeTeacher,
      setTimetable, updateCell, generateTimetable,
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
