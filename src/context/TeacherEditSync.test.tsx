import { describe, it, expect } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { TimetableProvider, useTimetable } from "@/context/TimetableContext";
import { DAYS, ACTIVITY_PERIODS, ACTIVITY_SUBJECT, getActivityDay, parseClassKey, isActivityCell, Teacher } from "@/types/timetable";

const STORAGE_KEY = "school_timetable_data";

function buildTeachers(): Teacher[] {
  const classes = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];
  const sections = ["أ", "ب"];
  const subjects = [
    { name: "لغة عربية", periods: 6 },
    { name: "رياضيات", periods: 5 },
    { name: "علوم", periods: 4 },
    { name: "لغة إنجليزية", periods: 4 },
    { name: "تربية إسلامية", periods: 3 },
  ];
  const teachers: Teacher[] = [];
  subjects.forEach((s, si) => {
    for (let g = 0; g < 3; g++) {
      const assigned: any[] = [];
      classes.forEach((cn, ci) => sections.forEach((sec, sei) => {
        const idx = ci * sections.length + sei;
        if (idx % 3 !== g) return;
        assigned.push({ subjectName: s.name, className: cn, section: sec, periodsPerWeek: s.periods });
      }));
      if (assigned.length) teachers.push({ id: `t${si}-${g}`, name: `معلم ${s.name} ${g + 1}`, subjects: assigned });
    }
  });
  classes.forEach((cn, ci) => sections.forEach((sec, sei) => {
    teachers.push({
      id: `act-${ci}-${sei}`,
      name: `معلم نشاط ${cn} ${sec}`,
      subjects: [{ subjectName: ACTIVITY_SUBJECT, className: cn, section: sec, periodsPerWeek: 2 }],
    });
  }));
  return teachers;
}

function Harness({ onReady }: any) { const api = useTimetable(); onReady(api); return null; }

/** عدد التعارضات: نفس المعلم في صفّين بنفس اليوم والحصة */
function countConflicts(tt: any, ppd: number) {
  let n = 0;
  for (let d = 0; d < DAYS.length; d++) {
    for (let p = 0; p < ppd; p++) {
      const seen = new Set<string>();
      for (const ck of Object.keys(tt)) {
        const c = tt[ck][d]?.[p];
        if (!c) continue;
        if (seen.has(c.teacherName)) n++;
        seen.add(c.teacherName);
      }
    }
  }
  return n;
}

function countFor(tt: any, teacherName: string, subject: string, ck: string) {
  let n = 0;
  for (let d = 0; d < DAYS.length; d++) {
    for (let p = 0; p < (tt[ck]?.[d]?.length || 0); p++) {
      const c = tt[ck][d][p];
      if (c && c.teacherName === teacherName && c.subjectName === subject) n++;
    }
  }
  return n;
}

function activityOk(tt: any, ppd: number) {
  let ok = 0, total = 0;
  for (const ck of Object.keys(tt)) {
    const { className } = parseClassKey(ck);
    const day = getActivityDay(className);
    if (day === undefined) continue;
    total++;
    const [pA, pB] = ACTIVITY_PERIODS;
    const a = tt[ck][day][pA], b = tt[ck][day][pB];
    if (isActivityCell(a) && isActivityCell(b) && !!a.teacherName && a.teacherName === b.teacherName) ok++;
  }
  return { ok, total };
}

describe("تعديل المعلمين والأنصبة بعد التوليد", () => {
  it("إضافة معلمين وتعديل نصاب: الجدول يتحدّث فوراً بلا تعارضات ومع بقاء النشاط", async () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ teachers: buildTeachers(), timetable: {}, periodsPerDay: 7 }));
    localStorage.setItem("school_timetable_activity_periods", "1");
    let api: any = null;
    render(<TimetableProvider><Harness onReady={(a: any) => { api = a; }} /></TimetableProvider>);
    await waitFor(() => expect(api.teachers.length).toBeGreaterThan(0));
    await act(async () => { api.generateTimetable(); });
    await waitFor(() => expect(Object.keys(api.timetable).length).toBeGreaterThan(0));

    // 1) إضافة معلمين جدد دفعة واحدة
    const newTeachers: Teacher[] = [
      { id: "new-1", name: "معلم جديد فنية", subjects: [{ subjectName: "تربية فنية", className: "الأول", section: "أ", periodsPerWeek: 2 }] },
      { id: "new-2", name: "معلم جديد رياضية", subjects: [{ subjectName: "تربية رياضية", className: "الأول", section: "ب", periodsPerWeek: 2 }] },
    ];
    await act(async () => { api.addTeachers(newTeachers); });
    await waitFor(() => expect(api.teachers.length).toBeGreaterThan(0));

    expect(countFor(api.timetable, "معلم جديد فنية", "تربية فنية", "الأول-أ")).toBe(2);
    expect(countFor(api.timetable, "معلم جديد رياضية", "تربية رياضية", "الأول-ب")).toBe(2);
    expect(countConflicts(api.timetable, 7)).toBe(0);

    // 2) تعديل نصاب معلم موجود (زيادة ثم نقصان)
    const target = api.teachers.find((t: Teacher) => t.id === "t0-0");
    const ck = `${target.subjects[0].className}-${target.subjects[0].section}`;
    await act(async () => {
      api.updateTeacher({
        ...target,
        subjects: target.subjects.map((s: any, i: number) => (i === 0 ? { ...s, periodsPerWeek: 7 } : s)),
      });
    });
    await waitFor(() => expect(countFor(api.timetable, target.name, target.subjects[0].subjectName, ck)).toBe(7));

    await act(async () => {
      const t = api.teachers.find((x: Teacher) => x.id === "t0-0");
      api.updateTeacher({ ...t, subjects: t.subjects.map((s: any, i: number) => (i === 0 ? { ...s, periodsPerWeek: 3 } : s)) });
    });
    await waitFor(() => expect(countFor(api.timetable, target.name, target.subjects[0].subjectName, ck)).toBe(3));

    expect(countConflicts(api.timetable, 7)).toBe(0);
    const act1 = activityOk(api.timetable, 7);
    expect(act1.ok).toBe(act1.total);
  }, 60000);

  it("استيراد جدول المباحث يعيد بناء الملحفة من البيانات المستوردة", async () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ teachers: [], timetable: {}, periodsPerDay: 7 }));
    localStorage.setItem("school_timetable_activity_periods", "1");
    let api: any = null;
    render(<TimetableProvider><Harness onReady={(a: any) => { api = a; }} /></TimetableProvider>);
    await waitFor(() => expect(api).toBeTruthy());

    const imported = buildTeachers();
    await act(async () => { api.importTeachersAndGenerate(imported); });
    await waitFor(() => expect(Object.keys(api.timetable).length).toBeGreaterThan(0));

    expect(api.teachers.length).toBe(imported.length);
    expect(countConflicts(api.timetable, 7)).toBe(0);
    const a = activityOk(api.timetable, 7);
    expect(a.ok).toBe(a.total);
  }, 60000);
});
