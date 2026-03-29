export interface StudentInfo {
  id: string;
  name: string; // الاسم الكامل
  className: string; // e.g. "الأول أ"
  parentPhone: string;
  parentName?: string;
  // All Ajyal platform fields (optional)
  nationalId?: string; // الرقم الوطني / الشخصي
  firstName?: string; // الاسم الأول
  fatherName?: string; // اسم الأب
  grandFatherName?: string; // اسم الجد
  familyName?: string; // اسم العائلة
  firstNameEn?: string; // الاسم الأول بالإنجليزية
  fatherNameEn?: string; // اسم الأب بالإنجليزية
  grandFatherNameEn?: string; // اسم الجد بالإنجليزية
  familyNameEn?: string; // العائلة بالإنجليزية
  fullNameEn?: string; // الاسم الكامل بالإنجليزية
  username?: string; // اسم المستخدم
  authority?: string; // السلطة المشرفة
  directorate?: string; // المديرية
  school?: string; // المدرسة
  grade?: string; // الصف (raw)
  branch?: string; // المرحلة / القسم / المسار
  section?: string; // الشعبة (raw)
  userType?: string; // نوع المستخدم
  studySystem?: string; // النظام الدراسي
  studentPhone?: string; // رقم الهاتف
  studentStatus?: string; // حالة الطالب
  fileStatus?: string; // حالة الملف
  email?: string; // البريد الإلكتروني
  schoolNationalId?: string; // الرقم الوطني للمدرسة
  nationality?: string; // الجنسية
  birthDate?: string; // تاريخ الميلاد
  gender?: string; // الجنس
  mainPhone?: string; // الهاتف الأساسي
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
