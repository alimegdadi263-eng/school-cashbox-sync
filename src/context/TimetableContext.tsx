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
  generateTimetable: () => void;
  getTeacherSchedule: (teacherId: string) => { classKey: string; day: number; period: number; subjectName: string }[];
  getAllClassKeys: () => string[];
  clearTimetable: () => void;
  generateDailySchedule: (day: number, absentTeacherIds: string[]) => ClassTimetable;
}

const TimetableContext = createContext<TimetableContextType | null>(null);

const STORAGE_KEY = "school_timetable_data";

export function TimetableProvider({ children }: { children: React.ReactNode }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetable, setTimetableState] = useState<ClassTimetable>({});
  const [periodsPerDay, setPeriodsPerDayState] = useState(7);

  useEffect(() => {
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
  }, []);

  const save = useCallback((t: Teacher[], tt: ClassTimetable, ppd: number) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ teachers: t, timetable: tt, periodsPerDay: ppd }));
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

    // Track how many last-period (7th) assignments each teacher gets
    const lastPeriodCount: Record<string, number> = {};
    teachers.forEach(t => { lastPeriodCount[t.id] = 0; });

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

    assignments.sort((a, b) => b.remaining - a.remaining);

    const lastPeriodIdx = periodsPerDay - 1;

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

          // Try non-last periods first, then last period with equal distribution
          const periodOrder: number[] = [];
          for (let p = 0; p < periodsPerDay; p++) {
            if (p !== lastPeriodIdx) periodOrder.push(p);
          }
          // Add last period at end - but check equal distribution
          periodOrder.push(lastPeriodIdx);

          for (const period of periodOrder) {
            if (newTT[assignment.classKey][day][period] !== null) continue;
            if (teacherUsage[assignment.teacherId][day].has(period)) continue;
            if (isBlocked(teacher, day, period)) continue;

            // For last period, check if this teacher already has more than average
            if (period === lastPeriodIdx) {
              const counts = Object.values(lastPeriodCount);
              const minCount = Math.min(...counts);
              if (lastPeriodCount[assignment.teacherId] > minCount + 1) continue;
            }

            newTT[assignment.classKey][day][period] = {
              teacherId: assignment.teacherId,
              teacherName: assignment.teacherName,
              subjectName: assignment.subjectName,
            };
            teacherUsage[assignment.teacherId][day].add(period);
            if (period === lastPeriodIdx) lastPeriodCount[assignment.teacherId]++;
            placed++;
            didPlace = true;
            break;
          }
        }

        if (!didPlace) {
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
              if (period === lastPeriodIdx) lastPeriodCount[assignment.teacherId]++;
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
