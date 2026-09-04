import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTimetable } from "@/context/TimetableContext";
import type { TimetableConstraints } from "@/context/TimetableContext";

const ITEMS: { key: keyof TimetableConstraints; title: string; desc: string }[] = [
  {
    key: "pairDoubleSubjects",
    title: "الحصص المزدوجة (المهارات الرقمية / التربية المهنية)",
    desc: "قيد إلزامي: حصتا المادة تكونان متتاليتين في نفس اليوم لنفس الصف، في أي يوم متاح.",
  },
  {
    key: "activityPeriods",
    title: "حصص النشاط (الثانية والثالثة)",
    desc: "الأول–الرابع الأحد، الخامس–السابع الاثنين، الثامن–العاشر الثلاثاء، وتكون الحصتان متتاليتين ومقفلتين.",
  },
  {
    key: "alignLateDays",
    title: "تركيز أيام تأخر المعلم",
    desc: "محاولة جمع الحصة السادسة مع السابعة في نفس اليوم ليغادر المعلم مبكراً باقي الأيام.",
  },
  {
    key: "preferArtLastPeriod",
    title: "التربية الفنية/الرياضية في الحصة الثامنة",
    desc: "للصفوف التي يزيد نصابها عن 35 حصة، يحاول النظام وضع الفنية أو الرياضة في الحصة الأخيرة.",
  },
  {
    key: "variablePeriodCap",
    title: "سقف الحصص المتغيّر (7 / 8)",
    desc: "الصف الذي مجموع حصصه أكثر من 35 يأخذ حصة ثامنة، وغيره يقف عند الحصة السابعة.",
  },
  {
    key: "oneSubjectPerDay",
    title: "عدم تكرار المادة في اليوم الواحد",
    desc: "المادة لا تتكرر أكثر من حصة في اليوم لنفس الصف، إلا المواد التي نصابها الأسبوعي أكثر من 5 حصص (حصتان كحد أقصى).",
  },
  {
    key: "lowerGradesFivePeriods",
    title: "الصفوف الأول والثاني والثالث: 5 حصص يومياً",
    desc: "هذه الصفوف تنتهي عند الحصة الخامسة كل يوم — لا أكثر ولا أقل (مع رصّ الحصص بلا فراغات).",
  },
  {
    key: "fillGaps",
    title: "إزالة الفراغات الداخلية",
    desc: "منع وجود حصة فارغة يليها حصص في نفس اليوم — تُسحب الحصص للأمام ويبقى الفراغ في آخر اليوم.",
  },

  {
    key: "balanceTeacherDaily",
    title: "توزيع نصاب المعلم بالتساوي على الأيام",
    desc: "محاولة جعل عدد حصص كل معلم متقارباً في جميع أيام الأسبوع بدل تكدسها في يوم واحد.",
  },
  {
    key: "autoSyncTeachers",
    title: "المزامنة التلقائية مع بيانات المعلمين",
    desc: "أي تعديل على اسم معلم أو عدد حصصه أو مواده ينعكس على الجدول الحالي فوراً دون إعادة توليد.",
  },
];

export default function ConstraintsPanel() {
  const { constraints, setConstraint } = useTimetable();

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="text-lg">قيود توليد الجدول</CardTitle>
        <p className="text-sm text-muted-foreground">
          فعّل ما تحتاجه فقط — القيود المعطلة لا تؤثر على التوليد.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {ITEMS.map(item => (
          <div
            key={item.key}
            className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
          >
            <div className="space-y-1">
              <Label htmlFor={`c-${item.key}`} className="cursor-pointer font-semibold">
                {item.title}
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
            <Switch
              id={`c-${item.key}`}
              checked={constraints[item.key]}
              onCheckedChange={v => setConstraint(item.key, v)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
