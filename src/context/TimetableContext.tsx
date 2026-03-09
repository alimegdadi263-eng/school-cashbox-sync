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
}

const TimetableContext = createContext<TimetableContextType | null>(null);

const STORAGE_KEY = "school_timetable_data";

export function TimetableProvider({ children }: { children: React.ReactNode }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetable, setTimetableState] = useState<ClassTimetable>({});
  const [periodsPerDay, setPeriodsPerDayState] = useState(7);

  // Load from localStorage
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

  // Save to localStorage
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
    // Remove from timetable
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

  const generateTimetable = () => {
    const classKeys = getAllClassKeys();
    const newTT: ClassTimetable = {};
    const daysCount = DAYS.length;

    // Initialize empty timetable
    classKeys.forEach(key => {
      newTT[key] = Array.from({ length: daysCount }, () => Array(periodsPerDay).fill(null));
    });

    // Track teacher usage: teacherId -> day -> Set<period>
    const teacherUsage: Record<string, Set<number>[]> = {};
    teachers.forEach(t => {
      teacherUsage[t.id] = Array.from({ length: daysCount }, () => new Set<number>());
    });

    // Collect all assignments that need to be placed
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

    // Sort: subjects with more periods first (harder to place)
    assignments.sort((a, b) => b.remaining - a.remaining);

    // Distribute periods
    for (const assignment of assignments) {
      let placed = 0;
      // Try to spread across days evenly
      const dayOrder = Array.from({ length: daysCount }, (_, i) => i);

      while (placed < assignment.remaining) {
        let didPlace = false;
        // Shuffle day order for variety
        dayOrder.sort(() => Math.random() - 0.5);

        for (const day of dayOrder) {
          if (placed >= assignment.remaining) break;

          // Check if teacher already assigned to this day for same class (limit 1 per day if possible)
          const alreadyThisClassThisDay = newTT[assignment.classKey][day].some(
            c => c && c.teacherId === assignment.teacherId && c.subjectName === assignment.subjectName
          );
          if (alreadyThisClassThisDay && placed < assignment.remaining - 1) continue;

          // Find available period
          for (let period = 0; period < periodsPerDay; period++) {
            if (newTT[assignment.classKey][day][period] !== null) continue;
            if (teacherUsage[assignment.teacherId][day].has(period)) continue;

            // Place it
            newTT[assignment.classKey][day][period] = {
              teacherId: assignment.teacherId,
              teacherName: assignment.teacherName,
              subjectName: assignment.subjectName,
            };
            teacherUsage[assignment.teacherId][day].add(period);
            placed++;
            didPlace = true;
            break;
          }
        }

        if (!didPlace) {
          // Force place in any available slot
          for (let day = 0; day < daysCount && placed < assignment.remaining; day++) {
            for (let period = 0; period < periodsPerDay; period++) {
              if (newTT[assignment.classKey][day][period] !== null) continue;
              if (teacherUsage[assignment.teacherId][day].has(period)) continue;
              newTT[assignment.classKey][day][period] = {
                teacherId: assignment.teacherId,
                teacherName: assignment.teacherName,
                subjectName: assignment.subjectName,
              };
              teacherUsage[assignment.teacherId][day].add(period);
              placed++;
              break;
            }
          }
          break; // Could not place all, avoid infinite loop
        }
      }
    }

    setTimetableState(newTT);
    save(teachers, newTT, periodsPerDay);
  };

  return (
    <TimetableContext.Provider value={{
      teachers, timetable, periodsPerDay, setPeriodsPerDay,
      addTeacher, updateTeacher, removeTeacher,
      setTimetable, updateCell, generateTimetable,
      getTeacherSchedule, getAllClassKeys, clearTimetable,
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
