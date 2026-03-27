export interface StudentInfo {
  id: string;
  name: string;
  className: string; // e.g. "الأول أ"
  parentPhone: string;
  parentName?: string;
}

export interface StudentAbsenceRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  date: string; // yyyy/MM/dd
  dayName: string;
  parentPhone: string;
  parentName?: string;
  notified: boolean; // هل تم إبلاغ ولي الأمر
  notes?: string;
}

export const STUDENT_STORAGE_KEY = "student_absence_data";
export const STUDENTS_LIST_KEY = "students_list_data";
