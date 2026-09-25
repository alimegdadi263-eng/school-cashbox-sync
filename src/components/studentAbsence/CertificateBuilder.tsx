import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Award, Building2, CalendarIcon, FileDown, GraduationCap, Handshake, School, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { exportAppreciationCertificate } from "@/lib/exportAppreciationCertificate";
import { STUDENTS_LIST_KEY, type StudentInfo } from "@/types/studentAbsence";

type RecipientType = "student" | "teacher" | "organization" | "community";
type TemplateType = "formal" | "academic" | "celebration" | "community";

const RECIPIENTS = [
  { id: "student", label: "طالب/ة", icon: GraduationCap },
  { id: "teacher", label: "معلم/ة", icon: UserRound },
  { id: "organization", label: "جهة خارجية", icon: Building2 },
  { id: "community", label: "مجتمع محلي", icon: Handshake },
] as const;

const TEMPLATES = [
  { id: "formal", label: "رسمي ذهبي", description: "إطار ذهبي رسمي وترويسة كلاسيكية", accent: "border-primary bg-primary/5" },
  { id: "academic", label: "أكاديمي هادئ", description: "إطار أزرق رصين وتعبير أكاديمي", accent: "border-secondary bg-secondary/10" },
  { id: "celebration", label: "احتفالي حديث", description: "إطار مميز وعبارات إنجاز واحتفاء", accent: "border-destructive bg-destructive/5" },
  { id: "community", label: "شراكة مجتمعية", description: "صياغة شكر وامتنان للجهات والداعمين", accent: "border-accent bg-accent/20" },
] as const;

interface Props {
  userId: string;
  schoolName: string;
  directorateName: string;
  principalName: string;
}

export default function CertificateBuilder({ userId, schoolName, directorateName, principalName }: Props) {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [recipientType, setRecipientType] = useState<RecipientType>("student");
  const [template, setTemplate] = useState<TemplateType>("formal");
  const [selectedStudentId, setSelectedStudentId] = useState("__manual__");
  const [recipientName, setRecipientName] = useState("");
  const [recipientDetail, setRecipientDetail] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [reason, setReason] = useState("");
  const [certificateDate, setCertificateDate] = useState(new Date());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STUDENTS_LIST_KEY}_${userId}`);
      setStudents(stored ? JSON.parse(stored) : []);
    } catch {
      setStudents([]);
    }
  }, [userId]);

  const detailLabel = useMemo(() => ({
    student: "الصف",
    teacher: "المسمى أو التخصص",
    organization: "اسم الجهة أو صفتها",
    community: "الصفة أو المؤسسة",
  })[recipientType], [recipientType]);

  const changeRecipientType = (value: RecipientType) => {
    setRecipientType(value);
    setSelectedStudentId("__manual__");
    setRecipientName("");
    setRecipientDetail("");
    setRepresentativeName("");
  };

  const selectStudent = (id: string) => {
    setSelectedStudentId(id);
    if (id === "__manual__") {
      setRecipientName("");
      setRecipientDetail("");
      return;
    }
    const student = students.find((item) => item.id === id);
    if (!student) return;
    setRecipientName(student.name);
    setRecipientDetail(student.className || student.grade || "");
  };

  const handleExport = async () => {
    if (!recipientName.trim() || !reason.trim()) {
      toast({ title: "أدخل اسم المستلم وسبب التكريم", variant: "destructive" });
      return;
    }
    setExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      await exportAppreciationCertificate({
        recipientName,
        recipientType,
        recipientDetail,
        representativeName: recipientType === "organization" ? representativeName : undefined,
        template,
        reason,
        date: format(certificateDate, "yyyy/MM/dd"),
        schoolName,
        directorateName,
        principalName,
      });
      toast({ title: "تم تصدير شهادة التقدير" });
    } catch {
      toast({ title: "تعذر تصدير شهادة التقدير", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]" dir="rtl">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> بيانات الشهادة</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>نوع المستلم</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RECIPIENTS.map(({ id, label, icon: Icon }) => (
                <Button key={id} type="button" variant={recipientType === id ? "default" : "outline"} className="h-auto flex-col gap-1 py-3" onClick={() => changeRecipientType(id)}>
                  <Icon className="h-5 w-5" /><span>{label}</span>
                </Button>
              ))}
            </div>
          </div>

          {recipientType === "student" && students.length > 0 && (
            <div className="space-y-2">
              <Label>اختيار طالب من القائمة</Label>
              <Select value={selectedStudentId} onValueChange={selectStudent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">إدخال الاسم يدوياً</SelectItem>
                  {students.map((student) => <SelectItem key={student.id} value={student.id}>{student.name} — {student.className || "دون صف"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="certificate-recipient-name">اسم المستلم</Label><Input id="certificate-recipient-name" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder={recipientType === "organization" ? "اسم الجهة" : "الاسم الكامل"} /></div>
            <div className="space-y-2"><Label htmlFor="certificate-recipient-detail">{detailLabel}</Label><Input id="certificate-recipient-detail" value={recipientDetail} onChange={(event) => setRecipientDetail(event.target.value)} /></div>
          </div>
          {recipientType === "organization" && <div className="space-y-2"><Label htmlFor="certificate-representative">اسم ممثل الجهة (اختياري)</Label><Input id="certificate-representative" value={representativeName} onChange={(event) => setRepresentativeName(event.target.value)} /></div>}
          <div className="space-y-2"><Label htmlFor="certificate-reason">سبب التكريم أو الشكر</Label><Textarea id="certificate-reason" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="مثال: التعاون المثمر ودعم أنشطة المدرسة" /></div>
          <div className="space-y-2">
            <Label>تاريخ الشهادة</Label>
            <Popover>
              <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start gap-2 font-normal"><CalendarIcon className="h-4 w-4" />{format(certificateDate, "PPP", { locale: ar })}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={certificateDate} onSelect={(date) => date && setCertificateDate(date)} initialFocus /></PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><School className="h-5 w-5" /> اختر تصميم الشهادة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((item) => (
              <Button key={item.id} type="button" variant="outline" onClick={() => setTemplate(item.id)} className={cn("min-h-28 h-auto items-start whitespace-normal border-2 p-4 text-right", template === item.id ? item.accent : "border-border bg-card hover:bg-muted")}>
                <span className="block w-full">
                <span className="mb-2 block text-lg font-bold">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.description}</span>
                </span>
              </Button>
            ))}
          </div>
          <div className="rounded-md border bg-muted/30 p-5 text-center">
            <Award className="mx-auto mb-2 h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">التصميم المختار</p>
            <p className="text-xl font-bold">{TEMPLATES.find((item) => item.id === template)?.label}</p>
            <p className="mt-3 font-semibold">{recipientName || "اسم المستلم"}</p>
          </div>
          <Button className="w-full" size="lg" onClick={handleExport} disabled={exporting}>
            <FileDown className="ml-2 h-5 w-5" />{exporting ? "جارٍ التصدير..." : "تصدير شهادة Word"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}