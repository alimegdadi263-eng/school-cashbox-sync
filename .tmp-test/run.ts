import { exportNewPeriodsFormExcel } from "@/lib/exportNewPeriodsForm";
import type { Teacher, ClassTimetable } from "@/types/timetable";

const t1 = { id: "t1", name: "أحمد", subjects: [{ subjectName: "رياضيات", periodsPerWeek: 5, assignments: [] }] } as any;
const t2 = { id: "t2", name: "سارة", subjects: [{ subjectName: "لغة عربية", periodsPerWeek: 4, assignments: [] }] } as any;
const timetable = {
  "السابع أ": Array.from({ length: 5 }, (_, d) => Array.from({ length: 7 }, (_, p) => (p % 2 === 0 ? { teacherId: d < 3 ? "t1" : "t2" } : null))),
} as any;

const origBlob = globalThis.Blob;
class BlobSpy extends origBlob {
  constructor(parts: any[], opts?: any) {
    super(parts, opts);
    Bun.write("/tmp/out_newperiods.xlsx", Buffer.from(parts[0]));
  }
}
(globalThis as any).Blob = BlobSpy;
await exportNewPeriodsFormExcel([t1, t2], timetable, 7, { schoolName: "مدرسة الاختبار", academicYear: "2026 /2027" });
console.log("done");
