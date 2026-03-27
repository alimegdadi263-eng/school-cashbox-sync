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
import { CalendarIcon, Save, MessageSquare, Phone, Send, Copy, Smartphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentInfo, StudentAbsenceRecord } from "@/types/studentAbsence";
import { STUDENTS_LIST_KEY, STUDENT_STORAGE_KEY } from "@/types/studentAbsence";
import { loadGatewayConfig, sendBulkSmsViaGateway, sendSmsViaGateway } from "@/lib/smsGateway";

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
  const [whatsAppQueueIndex, setWhatsAppQueueIndex] = useState<number | null>(null);
  const [sendingGateway, setSendingGateway] = useState(false);
  const [gatewayProgress, setGatewayProgress] = useState({ sent: 0, total: 0 });

  useEffect(() => {
    try {
      const s = localStorage.getItem(studentsKey);
      if (s) setStudents(JSON.parse(s));
      const r = localStorage.getItem(absenceKey);
      if (r) setRecords(JSON.parse(r));
    } catch {}
  }, [studentsKey, absenceKey]);

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

  useEffect(() => {
    const todayRecords = records.filter(r => r.date === dateStr);
    setAbsentIds(new Set(todayRecords.map(r => r.studentId)));
  }, [dateStr, records]);

  const classes = useMemo(() => [...new Set(students.map(s => s.className))], [students]);
  const filteredStudents = filterClass ? students.filter(s => s.className === filterClass) : students;
  const todayAbsentRecords = records.filter(r => r.date === dateStr);
  const activeQueueRecord = whatsAppQueueIndex !== null ? todayAbsentRecords[whatsAppQueueIndex] : null;

  const toggleAbsent = (studentId: string) => {
    setAbsentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const saveAbsence = () => {
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
    setWhatsAppQueueIndex(null);
    toast({ title: `تم حفظ غياب ${newRecords.length} طالب ليوم ${dateStr}` });
  };

  const buildMessage = (rec: StudentAbsenceRecord) => {
    return `السلام عليكم ${rec.parentName ? `(${rec.parentName})` : "ولي أمر الطالب"}\nنعلمكم بتغيب ابنكم/ابنتكم: ${rec.studentName}\nالصف: ${rec.className}\nالتاريخ: ${rec.date} (${rec.dayName})\nالرجاء متابعة الأمر.\n${schoolName}`;
  };

  const sendSMS = (phone: string, message: string) => {
    const encoded = encodeURIComponent(message);
    window.open(`sms:${phone}?body=${encoded}`, "_blank");
  };

  const sendWhatsApp = (phone: string, message: string) => {
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

    todayAbsentRecords.forEach((rec, i) => {
      setTimeout(() => {
        sendSMS(rec.parentPhone, buildMessage(rec));
      }, i * 500);
    });

    toast({ title: `تم فتح ${todayAbsentRecords.length} رسالة SMS` });
  };

  const startWhatsAppQueue = () => {
    if (todayAbsentRecords.length === 0) {
      toast({ title: "لا يوجد طلبة غائبين", variant: "destructive" });
      return;
    }

    setWhatsAppQueueIndex(0);
    sendWhatsApp(todayAbsentRecords[0].parentPhone, buildMessage(todayAbsentRecords[0]));
    toast({ title: "تم بدء وضع واتساب الآمن" });
  };

  const openCurrentWhatsApp = () => {
    if (!activeQueueRecord) return;
    sendWhatsApp(activeQueueRecord.parentPhone, buildMessage(activeQueueRecord));
  };

  const goToNextWhatsApp = () => {
    if (whatsAppQueueIndex === null) return;

    const nextIndex = whatsAppQueueIndex + 1;
    if (nextIndex >= todayAbsentRecords.length) {
      setWhatsAppQueueIndex(null);
      toast({ title: "تم إنهاء قائمة واتساب" });
      return;
    }

    setWhatsAppQueueIndex(nextIndex);
    const nextRecord = todayAbsentRecords[nextIndex];
    sendWhatsApp(nextRecord.parentPhone, buildMessage(nextRecord));
  };

  const copyAllMessages = () => {
    if (todayAbsentRecords.length === 0) {
      toast({ title: "لا يوجد طلبة غائبين", variant: "destructive" });
      return;
    }
    const text = todayAbsentRecords.map((rec, i) => {
      return `${i + 1}. ${rec.parentPhone} — ${rec.studentName} (${rec.className})\n${buildMessage(rec)}`;
    }).join("\n\n─────────────\n\n");
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `تم نسخ ${todayAbsentRecords.length} رسالة إلى الحافظة` });
    });
  };

  const sendViaGateway = async () => {
    const config = loadGatewayConfig();
    if (!config || !config.login || !config.password) {
      toast({ title: "يرجى إعداد بوابة SMS أولاً من تبويب 'إعدادات SMS'", variant: "destructive" });
      return;
    }
    if (todayAbsentRecords.length === 0) {
      toast({ title: "لا يوجد طلبة غائبين", variant: "destructive" });
      return;
    }

    setSendingGateway(true);
    setGatewayProgress({ sent: 0, total: todayAbsentRecords.length });

    const messages = todayAbsentRecords.map(rec => ({
      phone: rec.parentPhone,
      text: buildMessage(rec),
    }));

    const result = await sendBulkSmsViaGateway(config, messages, (sent, total) => {
      setGatewayProgress({ sent, total });
    });

    setSendingGateway(false);

    if (result.failed.length === 0) {
      toast({ title: `✅ تم إرسال ${result.sent} رسالة بنجاح من هاتفك` });
    } else {
      toast({
        title: `تم إرسال ${result.sent} رسالة، فشل ${result.failed.length}`,
        description: result.failed.map(f => f.phone).join(", "),
        variant: "destructive",
      });
    }
  };

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="mb-2 text-lg">لا يوجد طلبة مسجلين</p>
          <p className="text-sm">اذهب إلى تبويب "إدارة الطلبة" لإضافة الطلبة والصفوف أولاً</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📅 رصد الغياب اليومي</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>التاريخ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-9 w-48 justify-start text-right")}>
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
              <Save className="h-4 w-4" /> حفظ الغياب
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            ✅ حدد الطلبة الغائبين ({absentIds.size} غائب من {filteredStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">غائب</TableHead>
                  <TableHead className="w-10 text-center">م</TableHead>
                  <TableHead className="text-center">اسم الطالب</TableHead>
                  <TableHead className="text-center">الصف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s, idx) => (
                  <TableRow key={s.id} className={absentIds.has(s.id) ? "bg-destructive/10" : ""}>
                    <TableCell className="text-center">
                      <Checkbox checked={absentIds.has(s.id)} onCheckedChange={() => toggleAbsent(s.id)} />
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

      {todayAbsentRecords.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-lg">
                <span>📨 الطلبة الغائبون اليوم ({todayAbsentRecords.length})</span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={sendViaGateway} disabled={sendingGateway} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    {sendingGateway ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> إرسال {gatewayProgress.sent}/{gatewayProgress.total}</>
                    ) : (
                      <><Smartphone className="h-4 w-4" /> إرسال SMS من هاتفك</>
                    )}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={startWhatsAppQueue} className="gap-1">
                    <MessageSquare className="h-4 w-4" /> واتساب آمن للجميع
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyAllMessages} className="gap-1">
                    <Copy className="h-4 w-4" /> نسخ جميع الرسائل
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">م</TableHead>
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
                          <div className="flex justify-center gap-1">
                            <Button size="icon" variant="outline" title="SMS" onClick={() => sendSMS(rec.parentPhone, buildMessage(rec))}>
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" title="واتساب" onClick={() => sendWhatsApp(rec.parentPhone, buildMessage(rec))}>
                              <MessageSquare className="h-4 w-4 text-primary" />
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

          {activeQueueRecord && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🟢 وضع واتساب الآمن</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                  <p>الرسالة الحالية: <span className="font-medium">{whatsAppQueueIndex! + 1}</span> من <span className="font-medium">{todayAbsentRecords.length}</span></p>
                  <p>الطالب: <span className="font-medium">{activeQueueRecord.studentName}</span></p>
                  <p>الصف: <span className="font-medium">{activeQueueRecord.className}</span></p>
                  <p dir="ltr">الرقم: <span className="font-medium">{activeQueueRecord.parentPhone}</span></p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={openCurrentWhatsApp} className="gap-1">
                    <MessageSquare className="h-4 w-4" /> فتح الرسالة الحالية
                  </Button>
                  <Button variant="secondary" onClick={goToNextWhatsApp} className="gap-1">
                    <Send className="h-4 w-4" /> التالي
                  </Button>
                  <Button variant="outline" onClick={() => setWhatsAppQueueIndex(null)}>
                    إنهاء
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  بعد إرسال الرسالة في واتساب اضغط <span className="font-medium">التالي</span> لفتح المحادثة التالية بدون فتح جماعي يسبب block.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
