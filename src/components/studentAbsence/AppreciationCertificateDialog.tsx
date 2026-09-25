import { useState } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Award, CalendarIcon, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { exportAppreciationCertificate } from "@/lib/exportAppreciationCertificate";
import type { StudentInfo } from "@/types/studentAbsence";

interface Props {
  student: StudentInfo | null;
  onClose: () => void;
  schoolName: string;
  directorateName: string;
  principalName: string;
}

export default function AppreciationCertificateDialog({ student, onClose, schoolName, directorateName, principalName }: Props) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [certificateDate, setCertificateDate] = useState<Date>(new Date());
  const [exporting, setExporting] = useState(false);

  const close = () => {
    setReason("");
    setCertificateDate(new Date());
    onClose();
  };

  const exportCertificate = async () => {
    if (!student || !reason.trim()) {
      toast({ title: "أدخل سبب منح شهادة التقدير", variant: "destructive" });
      return;
    }
    setExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      await exportAppreciationCertificate({
        student,
        reason,
        date: format(certificateDate, "yyyy/MM/dd"),
        schoolName,
        directorateName,
        principalName,
      });
      toast({ title: "تم تصدير شهادة التقدير" });
      close();
    } catch {
      toast({ title: "تعذر تصدير شهادة التقدير", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={Boolean(student)} onOpenChange={(open) => !open && close()}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> شهادة تقدير</DialogTitle>
          <DialogDescription>{student ? `${student.name} — ${student.className || "الصف غير محدد"}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>سبب منح الشهادة</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="مثال: التفوق الدراسي وحسن السلوك" rows={4} />
          </div>
          <div className="space-y-2">
            <Label>تاريخ الشهادة</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start gap-2 font-normal")}>
                  <CalendarIcon className="h-4 w-4" />
                  {format(certificateDate, "PPP", { locale: ar })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={certificateDate} onSelect={(date) => date && setCertificateDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button onClick={exportCertificate} disabled={exporting}>
            <FileDown className="h-4 w-4 ml-1" /> {exporting ? "جارٍ التصدير..." : "تصدير الشهادة"}
          </Button>
          <Button variant="outline" onClick={close}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}