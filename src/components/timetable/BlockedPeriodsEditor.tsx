import type { BlockedPeriod } from "@/types/timetable";
import { DAYS } from "@/types/timetable";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Props {
  periodsPerDay: number;
  blockedPeriods: BlockedPeriod[];
  onChange: (blocked: BlockedPeriod[]) => void;
}

export default function BlockedPeriodsEditor({ periodsPerDay, blockedPeriods, onChange }: Props) {
  const isBlocked = (day: number, period: number) =>
    blockedPeriods.some(bp => bp.day === day && bp.period === period);

  const toggle = (day: number, period: number) => {
    if (isBlocked(day, period)) {
      onChange(blockedPeriods.filter(bp => !(bp.day === day && bp.period === period)));
    } else {
      onChange([...blockedPeriods, { day, period }]);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <Label className="text-base font-semibold">أوقات الفراغ (الحصص المحظورة)</Label>
      <p className="text-xs text-muted-foreground">حدد الحصص التي يجب أن يكون فيها المعلم فارغاً</p>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1 border border-border text-right">الحصة</th>
              {DAYS.map(d => (
                <th key={d} className="p-1 border border-border text-center min-w-[60px]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: periodsPerDay }, (_, pi) => (
              <tr key={pi}>
                <td className="p-1 border border-border text-center font-bold bg-muted/50">{pi + 1}</td>
                {DAYS.map((_, di) => (
                  <td key={di} className="p-1 border border-border text-center">
                    <Checkbox
                      checked={isBlocked(di, pi)}
                      onCheckedChange={() => toggle(di, pi)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
