import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, FileText, FileDown, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { StudentInfo } from "@/types/studentAbsence";
import { CLASS_NAMES, SECONDARY_CLASSES } from "@/types/timetable";
import { STUDENTS_LIST_KEY } from "@/types/studentAbsence";
import { exportStudentListDocx, exportStudentListExcel } from "@/lib/exportStudentList";

const AJYAL_GRADE_MAP: Record<string, string> = {
  "الأول": "الأول", "الاول": "الأول",
  "الثاني": "الثاني", "الثالث": "الثالث",
  "الرابع": "الرابع", "الخامس": "الخامس",
  "السادس": "السادس", "السابع": "السابع",
  "الثامن": "الثامن", "التاسع": "التاسع",
  "العاشر": "العاشر", "الحادي عشر": "الحادي عشر",
  "الثاني عشر": "الثاني عشر",
};

function mapAjyalGrade(raw: string): string {
  const trimmed = raw.trim();
  return AJYAL_GRADE_MAP[trimmed] || trimmed;
}

// All Ajyal column names mapped to StudentInfo keys
const AJYAL_COL_MAP: Record<string, keyof StudentInfo> = {
  "الرقم الوطني / الشخصي": "nationalId",
  "الرقم الوطني": "nationalId",
  "الاسم الأول": "firstName",
  "اسم الأب": "fatherName",
  "اسم الجد": "grandFatherName",
  "اسم العائلة": "familyName",
  "الاسم الكامل": "name",
  "الاسم الأول بالإنجليزية": "firstNameEn",
  "اسم الأب بالإنجليزية": "fatherNameEn",
  "اسم الجد بالإنجليزية": "grandFatherNameEn",
  "العائلة بالإنجليزية": "familyNameEn",
  "الاسم الكامل بالإنجليزية": "fullNameEn",
  "اسم المستخدم": "username",
  "السلطة المشرفة": "authority",
  "المديرية": "directorate",
  "المدرسة": "school",
  "الصف": "grade",
  "المرحلة / القسم / المسار": "branch",
  "الشعبة": "section",
  "نوع المستخدم": "userType",
  "النظام الدراسي": "studySystem",
  "رقم الهاتف": "studentPhone",
  "حالة الطالب": "studentStatus",
  "حالة الملف": "fileStatus",
  "البريد الإلكتروني": "email",
  "الرقم الوطني للمدرسة": "schoolNationalId",
  "الجنسية": "nationality",
  "تاريخ الميلاد": "birthDate",
  "الجنس": "gender",
  "الهاتف الأساسي": "mainPhone",
  "هاتف ولي الأمر": "parentPhone",
};

interface Props {
  userId: string;
  schoolName?: string;
  directorateName?: string;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const GRADES = CLASS_NAMES;
const SECTIONS = ["أ", "ب", "ج", "د", "هـ", "و"];
const BRANCHES_STORAGE_KEY = "custom_branches";

export default function StudentManager({ userId, schoolName, directorateName }: Props) {
  const { toast } = useToast();
  const storageKey = `${STUDENTS_LIST_KEY}_${userId}`;

  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [name, setName] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [mainPhone, setMainPhone] = useState("");
  const [gender, setGender] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [showAllFields, setShowAllFields] = useState(false);

  // Extra optional fields
  const [firstName, setFirstName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [grandFatherName, setGrandFatherName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [firstNameEn, setFirstNameEn] = useState("");
  const [fatherNameEn, setFatherNameEn] = useState("");
  const [grandFatherNameEn, setGrandFatherNameEn] = useState("");
  const [familyNameEn, setFamilyNameEn] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const isSecondary = SECONDARY_CLASSES.includes(selectedGrade);
  const [savedBranches, setSavedBranches] = useState<string[]>(() => JSON.parse(localStorage.getItem(BRANCHES_STORAGE_KEY) || '[]'));

  const className = selectedGrade && selectedSection
    ? (isSecondary && selectedBranch ? `${selectedGrade} ${selectedBranch} ${selectedSection}` : `${selectedGrade} ${selectedSection}`)
    : "";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setStudents(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  const saveStudents = (list: StudentInfo[]) => {
    setStudents(list);
    localStorage.setItem(storageKey, JSON.stringify(list));
  };

  const resetForm = () => {
    setName(""); setParentPhone(""); setParentName(""); setSelectedBranch("");
    setNationalId(""); setStudentPhone(""); setMainPhone(""); setGender("");
    setFirstName(""); setFatherName(""); setGrandFatherName(""); setFamilyName("");
    setFirstNameEn(""); setFatherNameEn(""); setGrandFatherNameEn(""); setFamilyNameEn("");
    setFullNameEn(""); setEmail(""); setNationality(""); setBirthDate("");
  };

  const addStudent = () => {
    if (!name.trim()) { toast({ title: "أدخل اسم الطالب", variant: "destructive" }); return; }

    if (isSecondary && selectedBranch.trim() && !savedBranches.includes(selectedBranch.trim())) {
      const updated = [...savedBranches, selectedBranch.trim()];
      setSavedBranches(updated);
      localStorage.setItem(BRANCHES_STORAGE_KEY, JSON.stringify(updated));
    }

    const student: StudentInfo = {
      id: generateId(),
      name: name.trim(),
      className: className || "",
      parentPhone: parentPhone.trim(),
      parentName: parentName.trim() || undefined,
      nationalId: nationalId.trim() || undefined,
      firstName: firstName.trim() || undefined,
      fatherName: fatherName.trim() || undefined,
      grandFatherName: grandFatherName.trim() || undefined,
      familyName: familyName.trim() || undefined,
      firstNameEn: firstNameEn.trim() || undefined,
      fatherNameEn: fatherNameEn.trim() || undefined,
      grandFatherNameEn: grandFatherNameEn.trim() || undefined,
      familyNameEn: familyNameEn.trim() || undefined,
      fullNameEn: fullNameEn.trim() || undefined,
      studentPhone: studentPhone.trim() || undefined,
      mainPhone: mainPhone.trim() || undefined,
      gender: gender || undefined,
      email: email.trim() || undefined,
      nationality: nationality.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      grade: selectedGrade || undefined,
      section: selectedSection || undefined,
      branch: selectedBranch.trim() || undefined,
    };
    saveStudents([...students, student]);
    resetForm();
    toast({ title: "تم إضافة الطالب" });
  };

  const deleteStudent = (id: string) => {
    saveStudents(students.filter(s => s.id !== id));
    toast({ title: "تم حذف الطالب" });
  };

  const deleteAllStudents = () => {
    saveStudents([]);
    setFilterClass("");
    toast({ title: "تم حذف جميع الطلبة" });
  };

  const deleteByClass = (cls: string) => {
    const remaining = students.filter(s => s.className !== cls);
    saveStudents(remaining);
    if (filterClass === cls) setFilterClass("");
    toast({ title: `تم حذف طلبة ${cls}` });
  };

  const uniqueClasses = [...new Set(students.map(s => s.className))].filter(Boolean).sort();
  const filtered = filterClass ? students.filter(s => s.className === filterClass) : students;

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      const newStudents: StudentInfo[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts.length >= 1 && parts[0].trim()) {
          newStudents.push({
            id: generateId(),
            name: parts[0].trim(),
            className: parts[1]?.trim() || "",
            parentPhone: parts[2]?.trim() || "",
            parentName: parts[3]?.trim() || undefined,
          });
        }
      }
      if (newStudents.length > 0) {
        saveStudents([...students, ...newStudents]);
        toast({ title: `تم استيراد ${newStudents.length} طالب` });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const html = ev.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const rows = doc.querySelectorAll("table tr");
        if (rows.length < 2) {
          toast({ title: "الملف فارغ أو غير صالح", variant: "destructive" });
          return;
        }

        const headers = Array.from(rows[0].querySelectorAll("th, td")).map(th => th.textContent?.trim() || "");
        
        // Build dynamic column index map
        const colIndices: Record<string, number> = {};
        headers.forEach((h, idx) => {
          if (AJYAL_COL_MAP[h]) {
            colIndices[AJYAL_COL_MAP[h]] = idx;
          }
        });

        if (colIndices["name"] === undefined) {
          // Fallback: try الاسم الكامل
          const nameIdx = headers.findIndex(h => h.includes("الاسم الكامل"));
          if (nameIdx === -1) {
            toast({ title: "لم يتم العثور على عمود 'الاسم الكامل'", variant: "destructive" });
            return;
          }
          colIndices["name"] = nameIdx;
        }

        const newStudents: StudentInfo[] = [];
        const existingNames = new Set(students.map(s => `${s.name}_${s.className}`));

        for (let i = 1; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll("td"));
          if (cells.length < 3) continue;

          const getVal = (key: string) => {
            const idx = colIndices[key];
            return idx !== undefined ? (cells[idx]?.textContent?.trim() || "") : "";
          };

          const fullName = getVal("name");
          if (!fullName) continue;

          const gradeRaw = getVal("grade");
          const grade = mapAjyalGrade(gradeRaw);
          const sectionRaw = getVal("section");
          const branchRaw = getVal("branch");

          const isSecGrade = SECONDARY_CLASSES.includes(grade);
          let builtClassName = "";
          if (grade && sectionRaw) {
            builtClassName = isSecGrade && branchRaw ? `${grade} ${branchRaw} ${sectionRaw}` : `${grade} ${sectionRaw}`;
          }

          const phone = getVal("parentPhone") || getVal("mainPhone") || getVal("studentPhone") || "";

          const key = `${fullName}_${builtClassName}`;
          if (existingNames.has(key)) continue;
          existingNames.add(key);

          newStudents.push({
            id: generateId(),
            name: fullName,
            className: builtClassName,
            parentPhone: phone,
            nationalId: getVal("nationalId") || undefined,
            firstName: getVal("firstName") || undefined,
            fatherName: getVal("fatherName") || undefined,
            grandFatherName: getVal("grandFatherName") || undefined,
            familyName: getVal("familyName") || undefined,
            firstNameEn: getVal("firstNameEn") || undefined,
            fatherNameEn: getVal("fatherNameEn") || undefined,
            grandFatherNameEn: getVal("grandFatherNameEn") || undefined,
            familyNameEn: getVal("familyNameEn") || undefined,
            fullNameEn: getVal("fullNameEn") || undefined,
            username: getVal("username") || undefined,
            authority: getVal("authority") || undefined,
            directorate: getVal("directorate") || undefined,
            school: getVal("school") || undefined,
            grade: grade || undefined,
            branch: branchRaw || undefined,
            section: sectionRaw || undefined,
            userType: getVal("userType") || undefined,
            studySystem: getVal("studySystem") || undefined,
            studentPhone: getVal("studentPhone") || undefined,
            studentStatus: getVal("studentStatus") || undefined,
            fileStatus: getVal("fileStatus") || undefined,
            email: getVal("email") || undefined,
            schoolNationalId: getVal("schoolNationalId") || undefined,
            nationality: getVal("nationality") || undefined,
            birthDate: getVal("birthDate") || undefined,
            gender: getVal("gender") || undefined,
            mainPhone: getVal("mainPhone") || undefined,
          });
        }

        if (newStudents.length > 0) {
          saveStudents([...students, ...newStudents]);
          toast({ title: `تم استيراد ${newStudents.length} طالب من ملف أجيال` });
        } else {
          toast({ title: "لم يتم العثور على طلاب جدد (قد يكونون مسجلين مسبقاً)", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "خطأ في قراءة الملف", variant: "destructive" });
      }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Add Student */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">➕ إضافة طالب</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAllFields(!showAllFields)}>
              {showAllFields ? "إخفاء الحقول الإضافية" : "عرض جميع الحقول"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Primary fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>الاسم الكامل <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الطالب الرباعي" />
            </div>
            <div className="space-y-1">
              <Label>الرقم الوطني</Label>
              <Input value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="الرقم الوطني" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>الصف</Label>
              <Select value={selectedGrade || "__none__"} onValueChange={v => setSelectedGrade(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>اختر الصف</SelectItem>
                  {GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>الشعبة</Label>
              <Select value={selectedSection || "__none__"} onValueChange={v => setSelectedSection(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="اختر الشعبة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>اختر الشعبة</SelectItem>
                  {SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isSecondary && (
              <div className="space-y-1">
                <Label>المرحلة / القسم / المسار</Label>
                <Input value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} placeholder="اكتب اسم الحقل" list="branches-list" />
                {savedBranches.length > 0 && (
                  <datalist id="branches-list">
                    {savedBranches.map(b => <option key={b} value={b} />)}
                  </datalist>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label>هاتف ولي الأمر</Label>
              <Input value={parentPhone} onChange={e => setParentPhone(e.target.value)} placeholder="07XXXXXXXX" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>الهاتف الأساسي</Label>
              <Input value={mainPhone} onChange={e => setMainPhone(e.target.value)} placeholder="اختياري" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>رقم هاتف الطالب</Label>
              <Input value={studentPhone} onChange={e => setStudentPhone(e.target.value)} placeholder="اختياري" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>الجنس</Label>
              <Select value={gender || "__none__"} onValueChange={v => setGender(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>اختر</SelectItem>
                  <SelectItem value="ذكر">ذكر</SelectItem>
                  <SelectItem value="أنثى">أنثى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Extended fields */}
          {showAllFields && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border">
              <div className="space-y-1">
                <Label>الاسم الأول</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="اختياري" />
              </div>
              <div className="space-y-1">
                <Label>اسم الأب</Label>
                <Input value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="اختياري" />
              </div>
              <div className="space-y-1">
                <Label>اسم الجد</Label>
                <Input value={grandFatherName} onChange={e => setGrandFatherName(e.target.value)} placeholder="اختياري" />
              </div>
              <div className="space-y-1">
                <Label>اسم العائلة</Label>
                <Input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="اختياري" />
              </div>
              <div className="space-y-1">
                <Label>الاسم الأول بالإنجليزية</Label>
                <Input value={firstNameEn} onChange={e => setFirstNameEn(e.target.value)} placeholder="Optional" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>اسم الأب بالإنجليزية</Label>
                <Input value={fatherNameEn} onChange={e => setFatherNameEn(e.target.value)} placeholder="Optional" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>اسم الجد بالإنجليزية</Label>
                <Input value={grandFatherNameEn} onChange={e => setGrandFatherNameEn(e.target.value)} placeholder="Optional" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>العائلة بالإنجليزية</Label>
                <Input value={familyNameEn} onChange={e => setFamilyNameEn(e.target.value)} placeholder="Optional" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>الاسم الكامل بالإنجليزية</Label>
                <Input value={fullNameEn} onChange={e => setFullNameEn(e.target.value)} placeholder="Optional" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>اسم ولي الأمر</Label>
                <Input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="اختياري" />
              </div>
              <div className="space-y-1">
                <Label>البريد الإلكتروني</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="اختياري" dir="ltr" type="email" />
              </div>
              <div className="space-y-1">
                <Label>الجنسية</Label>
                <Input value={nationality} onChange={e => setNationality(e.target.value)} placeholder="اختياري" />
              </div>
              <div className="space-y-1">
                <Label>تاريخ الميلاد</Label>
                <Input value={birthDate} onChange={e => setBirthDate(e.target.value)} placeholder="اختياري" dir="ltr" />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={addStudent}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
            <Button variant="outline" size="sm" onClick={() => exportStudentListDocx(students, schoolName || "", directorateName || "", filterClass || undefined)}>
              <FileText className="w-4 h-4 ml-1" /> تصدير Word
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportStudentListExcel(students, schoolName || "", filterClass || undefined)}>
              <FileDown className="w-4 h-4 ml-1" /> تصدير Excel
            </Button>
            <label>
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 ml-1" /> استيراد CSV</span></Button>
              <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
            </label>
            <label>
              <Button variant="outline" size="sm" asChild><span><FileSpreadsheet className="w-4 h-4 ml-1" /> استيراد Excel (أجيال)</span></Button>
              <input type="file" accept=".xls,.xlsx" className="hidden" onChange={importExcel} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      {students.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">📋 قائمة الطلبة ({filtered.length})</CardTitle>
              <div className="flex gap-2 flex-wrap">
                {/* Delete by section */}
                {filterClass && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="w-4 h-4 ml-1" /> حذف شعبة {filterClass}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-destructive" /> تأكيد حذف الشعبة
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتم حذف جميع طلبة <strong>{filterClass}</strong> ({students.filter(s => s.className === filterClass).length} طالب). هذا الإجراء لا يمكن التراجع عنه.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteByClass(filterClass)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          حذف الشعبة
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {/* Delete all */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 ml-1" /> حذف الكل
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" /> تأكيد حذف جميع الطلبة
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف جميع الطلبة ({students.length} طالب). هذا الإجراء لا يمكن التراجع عنه.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteAllStudents} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        حذف الكل
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Select value={filterClass || "__all__"} onValueChange={v => setFilterClass(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-52"><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">جميع الصفوف</SelectItem>
                  {uniqueClasses.map(c => (
                    <SelectItem key={c} value={c}>{c} ({students.filter(s => s.className === c).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">م</TableHead>
                    <TableHead className="text-center">الرقم الوطني</TableHead>
                    <TableHead className="text-center">اسم الطالب</TableHead>
                    <TableHead className="text-center">الصف</TableHead>
                    <TableHead className="text-center">الجنس</TableHead>
                    <TableHead className="text-center">هاتف ولي الأمر</TableHead>
                    <TableHead className="text-center">الهاتف الأساسي</TableHead>
                    <TableHead className="text-center">رقم الطالب</TableHead>
                    <TableHead className="text-center w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, idx) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center" dir="ltr">{s.nationalId || "-"}</TableCell>
                      <TableCell className="text-center font-medium">{s.name}</TableCell>
                      <TableCell className="text-center">{s.className}</TableCell>
                      <TableCell className="text-center">{s.gender || "-"}</TableCell>
                      <TableCell className="text-center" dir="ltr">{s.parentPhone || "-"}</TableCell>
                      <TableCell className="text-center" dir="ltr">{s.mainPhone || "-"}</TableCell>
                      <TableCell className="text-center" dir="ltr">{s.studentPhone || "-"}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => deleteStudent(s.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
