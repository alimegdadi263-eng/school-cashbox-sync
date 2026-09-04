import { describe, it, expect, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { TimetableProvider, useTimetable } from "./TimetableContext";
import { DAYS, Teacher } from "@/types/timetable";

const STORAGE_KEY = "school_timetable_data";

/**
 * صف "الأول-أ" مجموعه 30 حصة (≤35) → يجب ألا تتجاوز الحصص السابعة (فهرس 6).
 * صف "الثاني-أ" مجموعه 40 حصة (>35) → مسموح له بالحصة الثامنة (فهرس 7).
 */
function buildTeachers(): Teacher[] {
  const teachers: Teacher[] = [];
  const light = [6, 6, 6, 6, 6];
  const heavy = [6, 6, 6, 6, 6, 6, 2, 2];
  const names = ["لغة عربية", "رياضيات", "علوم", "لغة إنجليزية", "تربية إسلامية", "تاريخ", "تربية فنية", "تربية رياضية"];
  light.forEach((p, i) => {
    teachers.push({ id: `L${i}`, name: `معلم أ${i}`, subjects: [{ subjectName: names[i], className: "الرابع", section: "أ", periodsPerWeek: p }] });
  });
  heavy.forEach((p, i) => {
    teachers.push({ id: `H${i}`, name: `معلم ب${i}`, subjects: [{ subjectName: names[i], className: "السابع", section: "أ", periodsPerWeek: p }] });
  });
  return teachers;
}

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useTimetable>) => void }) {
  const api = useTimetable();
  onReady(api);
  return null;
}

describe("سقف الحصص اليومية حسب مجموع حصص الصف", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ teachers: buildTeachers(), timetable: {}, periodsPerDay: 8 }));
    localStorage.setItem("school_timetable_activity_periods", "0");
    localStorage.setItem("school_timetable_pair_double", "1");
  });

  it("الصف ≤35 حصة لا يتجاوز الحصة السابعة، و>35 يستخدم الثامنة للفنية/الرياضية", async () => {
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
    let lightEighth = 0;
    let heavyEighth = 0;
    let heavyEighthPreferred = 0;
    for (let d = 0; d < DAYS.length; d++) {
      if (tt["الرابع-أ"][d][7]) lightEighth++;
      const c = tt["السابع-أ"][d][7];
      if (c) {
        heavyEighth++;
        if (["تربية فنية", "تربية رياضية"].includes(c.subjectName)) heavyEighthPreferred++;
      }
    }
    expect(lightEighth).toBe(0);
    expect(heavyEighth).toBeGreaterThan(0);
    expect(heavyEighthPreferred).toBeGreaterThanOrEqual(Math.min(4, heavyEighth));
  }, 60000);
});
