export type AbsenceType = "عرضية" | "مرضية" | "غير ذلك";

export interface TeacherAbsenceRecord {
  id: string;
  teacherName: string;
  date: string; // yyyy/MM/dd
  dayName: string; // اسم اليوم
  absenceType: AbsenceType;
  notes?: string;
}

export const ABSENCE_TYPES: AbsenceType[] = ["عرضية", "مرضية", "غير ذلك"];

export const ABSENCE_STORAGE_KEY = "teacher_absence_records";
