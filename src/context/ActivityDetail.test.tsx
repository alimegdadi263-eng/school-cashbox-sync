import { describe, it, expect } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { TimetableProvider, useTimetable } from "@/context/TimetableContext";
import { DAYS, ACTIVITY_PERIODS, ACTIVITY_SUBJECT, getActivityDay, parseClassKey, isActivityCell, DOUBLE_PERIOD_SUBJECTS, Teacher } from "@/types/timetable";

const STORAGE_KEY = "school_timetable_data";
function buildTeachers(): Teacher[] {
  const classes = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر"];
  const sections = ["أ","ب"];
  const subjects = [
    { name: "لغة عربية", periods: 6 },{ name: "رياضيات", periods: 5 },{ name: "علوم", periods: 4 },
    { name: "لغة إنجليزية", periods: 5 },{ name: "تربية إسلامية", periods: 3 },{ name: "المهارات الرقمية", periods: 2 },
    { name: "تربية مهنية", periods: 2 },{ name: "تربية رياضية", periods: 2 },{ name: "تربية فنية", periods: 2 },
  ];
  const teachers: Teacher[] = [];
  subjects.forEach((s, si) => {
    for (let g = 0; g < 4; g++) {
      const assigned: any[] = [];
      classes.forEach((cn, ci) => sections.forEach((sec, sei) => {
        const idx = ci * sections.length + sei;
        if (idx % 4 !== g) return;
        assigned.push({ subjectName: s.name, className: cn, section: sec, periodsPerWeek: s.periods });
      }));
      if (assigned.length) teachers.push({ id: `t${si}-${g}`, name: `معلم ${s.name} ${g+1}`, subjects: assigned });
    }
  });
  return teachers;
}
function Harness({ onReady }: any) { const api = useTimetable(); onReady(api); return null; }

describe("تفصيل النشاط", () => {
  it("النشاط الثانية والثالثة متتاليتان لكل صف في يومه + ملحفة افتراضية", async () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ teachers: buildTeachers(), timetable: {}, periodsPerDay: 7 }));
    localStorage.setItem("school_timetable_activity_periods", "1");
    localStorage.setItem("school_timetable_pair_double", "1");
    let api: any = null;
    render(<TimetableProvider><Harness onReady={(a:any)=>{api=a;}} /></TimetableProvider>);
    await waitFor(() => expect(api.teachers.length).toBeGreaterThan(0));
    await act(async () => { api.generateTimetable(); });
    await waitFor(() => expect(Object.keys(api.timetable).length).toBeGreaterThan(0));
    const tt = api.timetable; const [pA,pB] = ACTIVITY_PERIODS;

    let ok=0, tot=0;
    for (const ck of Object.keys(tt)) {
      const { className } = parseClassKey(ck);
      const day = getActivityDay(className); if (day === undefined) continue;
      tot++;
      const a = tt[ck][day][pA], b = tt[ck][day][pB];
      const good = isActivityCell(a) && isActivityCell(b) && a.subjectName===ACTIVITY_SUBJECT && b.subjectName===ACTIVITY_SUBJECT && !!a.teacherName && a.teacherName===b.teacherName;
      if (good) ok++;
      console.log(`${good?"✔":"✘"} ${ck} | ${DAYS[day]} | ح2: ${a?.subjectName}-${a?.teacherName} | ح3: ${b?.subjectName}-${b?.teacherName}`);
    }

    // فحص المهارات الرقمية / المهني متتالية
    let dblOk=0, dblTot=0;
    for (const ck of Object.keys(tt)) for (const sub of DOUBLE_PERIOD_SUBJECTS) {
      const spots:{d:number;p:number}[]=[];
      for (let d=0;d<DAYS.length;d++) for(let p=0;p<7;p++) if (tt[ck][d][p]?.subjectName===sub) spots.push({d,p});
      if (spots.length<2) continue;
      dblTot++;
      if (spots.every(s => tt[ck][s.d][s.p-1]?.subjectName===sub || tt[ck][s.d][s.p+1]?.subjectName===sub)) dblOk++;
    }

    let conflicts=0;
    for (let d=0;d<DAYS.length;d++) for(let p=0;p<7;p++){const seen=new Set();for(const ck of Object.keys(tt)){const c=tt[ck][d][p];if(!c||isActivityCell(c))continue;if(seen.has(c.teacherId))conflicts++;seen.add(c.teacherId);}}
    const unplaced = api.unplacedPeriods.reduce((s:number,u:any)=>s+u.count,0);
    console.log(`النشاط: ${ok}/${tot} | المزدوجة: ${dblOk}/${dblTot} | تعارضات: ${conflicts} | غير موزّع: ${unplaced}`);

    // ملحفة افتراضية: صف عيّنة لكل يوم نشاط
    const sample = ["الأول-أ","الخامس-أ","الثامن-أ"];
    for (const ck of sample) {
      if (!tt[ck]) continue;
      console.log(`\n===== ملحفة الصف ${ck} =====`);
      for (let d=0; d<DAYS.length; d++) {
        const row = tt[ck][d].map((c:any,i:number)=> `ح${i+1}: ${c ? `${c.subjectName}/${c.teacherName||"—"}` : "فارغ"}`).join(" | ");
        console.log(`${DAYS[d]}: ${row}`);
      }
    }

    expect(ok).toBe(tot); expect(conflicts).toBe(0);
  }, 60000);
});
