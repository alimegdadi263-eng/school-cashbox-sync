import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon, Save, MessageSquare, Phone, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentInfo, StudentAbsenceRecord } from "@/types/studentAbsence";
import { STUDENTS_LIST_KEY, STUDENT_STORAGE_KEY } from "@/types/studentAbsence";

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

interface Props {
  userId: string;
  schoolName: string;
}

export default function DailyAbsenceTracker({ userId, schoolName }: Props) {
  const { toast } = useToast();

  const studentsKey = `${STUDENTS_LIST_KEY}_${userId}`;
  const absenceKey = `${STUDENT_STORAGE_KEY}_${userId}`;

  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [records, setRecords] = useState<StudentAbsenceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterClass, setFilterClass] = useState("");
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const s = localStorage.getItem(studentsKey);
      if (s) setStudents(JSON.parse(s));
      const r = localStorage.getItem(absenceKey);
      if (r) setRecords(JSON.parse(r));
    } catch {}
  }, [studentsKey, absenceKey]);

  // Listen for student list changes
  useEffect(() => {
    const poll = setInterval(() => {
      try {
        const s = localStorage.getItem(studentsKey);
        if (s) {
          const parsed = JSON.parse(s);
          if (parsed.length !== students.length) setStudents(parsed);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, [studentsKey, students.length]);

  const dateStr = format(selectedDate, "yyyy/MM/dd");
  const dayName = DAYS_AR[selectedDate.getDay()];

  // Load today's absent students from records
  useEffect(() => {
    const todayRecords = records.filter(r => r.date === dateStr);
    setAbsentIds(new Set(todayRecords.map(r => r.studentId)));
  }, [dateStr, records]);

  const classes = useMemo(() => [...new Set(students.map(s => s.className))], [students]);
  const filteredStudents = filterClass ? students.filter(s => s.className === filterClass) : students;

  const toggleAbsent = (studentId: string) => {
    setAbsentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const saveAbsence = () => {
    // Remove old records for this date, add new ones
    const otherRecords = records.filter(r => r.date !== dateStr);
    const newRecords: StudentAbsenceRecord[] = [];

    absentIds.forEach(sid => {
      const student = students.find(s => s.id === sid);
      if (!student) return;
      newRecords.push({
        id: generateId(),
        studentId: sid,
        studentName: student.name,
        className: student.className,
        date: dateStr,
        dayName,
        parentPhone: student.parentPhone,
        parentName: student.parentName,
        notified: false,
      });
    });

    const all = [...otherRecords, ...newRecords];
    setRecords(all);
    localStorage.setItem(absenceKey, JSON.stringify(all));
    toast({ title: `تم حفظ غياب ${newRecords.length} طالب ليوم ${dateStr}` });
  };

  const todayAbsentRecords = records.filter(r => r.date === dateStr);

  const buildMessage = (rec: StudentAbsenceRecord) => {
    return `السلام عليكم ${rec.parentName ? `(${rec.parentName})` : "ولي أمر الطالب"}\nنعلمكم بتغيب ابنكم/ابنتكم: ${rec.studentName}\nالصف: ${rec.className}\nالتاريخ: ${rec.date} (${rec.dayName})\nالرجاء متابعة الأمر.\n${schoolName}`;
  };

  const sendSMS = (phone: string, message: string) => {
    const encoded = encodeURIComponent(message);
    window.open(`sms:${phone}?body=${encoded}`, "_blank");
  };

  const sendWhatsApp = (phone: string, message: string) => {
    // Convert 07xxx to 9627xxx for WhatsApp
    let intlPhone = phone;
    if (phone.startsWith("07")) intlPhone = "962" + phone.slice(1);
    else if (phone.startsWith("00")) intlPhone = phone.slice(2);
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${intlPhone}?text=${encoded}`, "_blank");
  };

  const sendAllSMS = () => {
    if (todayAbsentRecords.length === 0) {
      toast({ title: "لا يوجد طلبة غائبين", variant: "destructive" });
      return;
    }
    // Build combined message with all absent students grouped by class
    const byClass: Record<string, StudentAbsenceRecord[]> = {};
    todayAbsentRecords.forEach(r => {
      if (!byClass[r.className]) byClass[r.className] = [];
      byClass[r.className].push(r);
    });

    // Open SMS for each parent
    todayAbsentRecords.forEach((rec, i) => {
      setTimeout(() => {
        sendSMS(rec.parentPhone, buildMessage(rec));
      }, i * 500); // slight delay between each
    });

    toast({ title: `تم فتح ${todayAbsentRecords.length} رسالة SMS` });
  };

  const sendAllWhatsApp = () => {
    if (todayAbsentRecords.length === 0) {
      toast({ title: "لا يوجد طلبة غائبين", variant: "destructive" });
      return;
    }
    todayAbsentRecords.forEach((rec, i) => {
      setTimeout(() => {
        sendWhatsApp(rec.parentPhone, buildMessage(rec));
      }, i * 800);
    });
    toast({ title: `تم فتح ${todayAbsentRecords.length} رسالة واتساب` });
  };

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-lg mb-2">لا يوجد طلبة مسجلين</p>
          <p className="text-sm">اذهب إلى تبويب "إدارة الطلبة" لإضافة الطلبة والصفوف أولاً</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date & Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📅 رصد الغياب اليومي</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>التاريخ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-48 justify-start text-right h-9")}>
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {dateStr} ({dayName})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={d => d && setSelectedDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>الصف</Label>
              <Select value={filterClass || "__all__"} onValueChange={v => setFilterClass(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">جميع الصفوف</SelectItem>
                  {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveAbsence} className="gap-1">
              <Save className="w-4 h-4" /> حفظ الغياب
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Checkboxes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            ✅ حدد الطلبة الغائبين ({absentIds.size} غائب من {filteredStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center w-12">غائب</TableHead>
                  <TableHead className="text-center w-10">م</TableHead>
                  <TableHead className="text-center">اسم الطالب</TableHead>
                  <TableHead className="text-center">الصف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s, idx) => (
                  <TableRow key={s.id} className={absentIds.has(s.id) ? "bg-destructive/10" : ""}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={absentIds.has(s.id)}
                        onCheckedChange={() => toggleAbsent(s.id)}
                      />
                    </TableCell>
                    <TableCell className="text-center">{idx + 1}</TableCell>
                    <TableCell className="text-center font-medium">{s.name}</TableCell>
                    <TableCell className="text-center">{s.className}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Today's Absent List with Send Buttons */}
      {todayAbsentRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>📨 الطلبة الغائبون اليوم ({todayAbsentRecords.length})</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={sendAllSMS} className="gap-1">
                  <Send className="w-4 h-4" /> إرسال SMS للجميع
                </Button>
                <Button size="sm" variant="secondary" onClick={sendAllWhatsApp} className="gap-1">
                  <MessageSquare className="w-4 h-4" /> واتساب للجميع
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">م</TableHead>
                    <TableHead className="text-center">الطالب</TableHead>
                    <TableHead className="text-center">الصف</TableHead>
                    <TableHead className="text-center">ولي الأمر</TableHead>
                    <TableHead className="text-center">الرقم</TableHead>
                    <TableHead className="text-center">إرسال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAbsentRecords.map((rec, idx) => (
                    <TableRow key={rec.id}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center font-medium">{rec.studentName}</TableCell>
                      <TableCell className="text-center">{rec.className}</TableCell>
                      <TableCell className="text-center">{rec.parentName || "-"}</TableCell>
                      <TableCell className="text-center" dir="ltr">{rec.parentPhone}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="icon" variant="outline" title="SMS" onClick={() => sendSMS(rec.parentPhone, buildMessage(rec))}>
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="outline" title="واتساب" onClick={() => sendWhatsApp(rec.parentPhone, buildMessage(rec))}>
                            <MessageSquare className="w-4 h-4 text-primary" />
                          </Button>
                        </div>
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
