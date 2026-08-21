import { describe, it, expect, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { TimetableProvider, useTimetable } from "./TimetableContext";
import { DAYS, ACTIVITY_PERIODS, DOUBLE_PERIOD_SUBJECTS, getActivityDay, getClassKey, parseClassKey, Teacher } from "@/types/timetable";

const STORAGE_KEY = "school_timetable_data";

function buildTeachers(): Teacher[] {
  const classes = ["الأول", "الثاني", "الخامس", "السادس", "الثامن", "التاسع"];
  const sections = ["أ", "ب"];
  const subjects: { name: string; periods: number }[] = [
    { name: "لغة عربية", periods: 6 },
    { name: "رياضيات", periods: 5 },
    { name: "علوم", periods: 4 },
    { name: "لغة إنجليزية", periods: 5 },
    { name: "تربية إسلامية", periods: 3 },
    { name: "المهارات الرقمية", periods: 2 },
    { name: "تربية مهنية", periods: 2 },
    { name: "تربية رياضية", periods: 2 },
    { name: "تربية فنية", periods: 2 },
  ];
  // معلم لكل مادة موزّع على عدة معلمين لتفادي التعارض
  const teachers: Teacher[] = [];
  subjects.forEach((s, si) => {
    // نوزّع الصفوف على معلمين اثنين لكل مادة
    for (let g = 0; g < 3; g++) {
      const assigned: any[] = [];
      classes.forEach((cn, ci) => {
        sections.forEach((sec, sei) => {
          const idx = ci * sections.length + sei;
          if (idx % 3 !== g) return;
          assigned.push({ subjectName: s.name, className: cn, section: sec, periodsPerWeek: s.periods });
        });
      });
      if (assigned.length) teachers.push({ id: `t${si}-${g}`, name: `معلم ${s.name} ${g + 1}`, subjects: assigned });
    }
  });
  return teachers;
}

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useTimetable>) => void }) {
  const api = useTimetable();
  onReady(api);
  return null;
}

describe("توليد الجدول: حصص النشاط والحصص المزدوجة", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ teachers: buildTeachers(), timetable: {}, periodsPerDay: 7 }));
    localStorage.setItem("school_timetable_activity_periods", "1");
    localStorage.setItem("school_timetable_pair_double", "1");
  });

  it("النشاط: الثانية والثالثة متتاليتان لنفس المعلم/المادة في يوم الصف، والمزدوجة متتالية", async () => {
    let api: any = null;
    render(
      <TimetableProvider>
        <Harness onReady={a => { api = a; }} />
      </TimetableProvider>
    );
    await waitFor(() => expect(api.teachers.length).toBeGreaterThan(0));
    await act(async () => { api.generateTimetable(); });
    await waitFor(() => expect(Object.keys(api.timetable).length).toBeGreaterThan(0));

    const tt = api.timetable;
    const [pA, pB] = ACTIVITY_PERIODS;

    let activityOk = 0, activityTotal = 0;
    for (const ck of Object.keys(tt)) {
      const { className } = parseClassKey(ck);
      const day = getActivityDay(className);
      if (day === undefined) continue;
      activityTotal++;
      const a = tt[ck][day][pA];
      const b = tt[ck][day][pB];
      if (a && b && a.teacherId === b.teacherId && a.subjectName === b.subjectName) activityOk++;
      else console.log("فشل النشاط:", ck, DAYS[day], a?.subjectName, b?.subjectName);
    }
    console.log(`النشاط: ${activityOk}/${activityTotal}`);

    // فحص التعارضات: معلم في صفّين بنفس الوقت
    let conflicts = 0;
    for (let d = 0; d < DAYS.length; d++) {
      for (let p = 0; p < 7; p++) {
        const seen = new Set<string>();
        for (const ck of Object.keys(tt)) {
          const c = tt[ck][d][p];
          if (!c) continue;
          if (seen.has(c.teacherId)) conflicts++;
          seen.add(c.teacherId);
        }
      }
    }

    // الحصص المزدوجة
    let dblOk = 0, dblTotal = 0;
    for (const ck of Object.keys(tt)) {
      for (const subj of DOUBLE_PERIOD_SUBJECTS) {
        const spots: { d: number; p: number }[] = [];
        for (let d = 0; d < DAYS.length; d++) for (let p = 0; p < 7; p++) if (tt[ck][d][p]?.subjectName === subj) spots.push({ d, p });
        if (spots.length < 2) continue;
        dblTotal++;
        const paired = spots.some(s => tt[ck][s.d][s.p + 1]?.subjectName === subj);
        if (paired) dblOk++; else console.log("فشل الإقران:", ck, subj, JSON.stringify(spots));
      }
    }
    console.log(`المزدوجة: ${dblOk}/${dblTotal}, تعارضات: ${conflicts}, غير موزّع: ${api.unplacedPeriods.reduce((s: number, u: any) => s + u.count, 0)}`);

    expect(conflicts).toBe(0);
    expect(activityOk).toBe(activityTotal);
    expect(dblOk).toBe(dblTotal);
  }, 60000);
});
