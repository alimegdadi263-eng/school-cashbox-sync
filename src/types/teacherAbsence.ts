export type AbsenceType = "عرضية" | "مرضية" | "عدم صرف" | "غير ذلك";

export interface TeacherAbsenceRecord {
  id: string;
  teacherName: string;
  date: string; // yyyy/MM/dd
  dayName: string; // اسم اليوم
  absenceType: AbsenceType;
  notes?: string;
  source?: "manual" | "interrogation"; // مصدر السجل
}

export const ABSENCE_TYPES: AbsenceType[] = ["عرضية", "مرضية", "عدم صرف", "غير ذلك"];

export const ABSENCE_STORAGE_KEY = "teacher_absence_records";

export const ABSENCE_STORAGE_KEY = "teacher_absence_records";
