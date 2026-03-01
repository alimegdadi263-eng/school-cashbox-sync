import { ACCOUNT_COLUMNS, AccountColumnId, FinanceState } from "@/types/finance";

export const ARABIC_MONTHS = [
  "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
  "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول",
];

export const SUMMARY_ROWS: { id: string; label: string }[] = [
  { id: "cashBox", label: "الصندوق" },
  { id: "bank", label: "البنك" },
  { id: "donations", label: "التبرعات" },
  { id: "redCrescent", label: "الهلال الأحمر" },
  { id: "advances", label: "السلفات" },
  { id: "gardens", label: "الحدائق المدرسية" },
  { id: "deposits", label: "أمانات كتب مدرسية" },
  { id: "mySchool", label: "مدرستي انتمي" },
  { id: "sdi", label: "منحة SDI" },
  { id: "furniture", label: "أمانات أثاث تالف" },
];

export interface AccountMonthData {
  openDebit: number;
  openCredit: number;
  duringDebit: number;
  duringCredit: number;
  endDebit: number;
  endCredit: number;
}

/**
 * Computes monthly account data with rolling balances.
 * Opening balance for the selected month = user's opening balance + all transactions BEFORE that month.
 * During = transactions in the selected month only.
 * Closing = opening + during (net-based: positive = debit, negative = credit).
 */
export function getAccountMonthData(
  state: FinanceState,
  colId: string,
  selectedMonthIndex: number
): AccountMonthData {
  const exists = ACCOUNT_COLUMNS.some(c => c.id === colId);
  if (!exists) {
    return { openDebit: 0, openCredit: 0, duringDebit: 0, duringCredit: 0, endDebit: 0, endCredit: 0 };
  }

  // User-entered opening balances
  const ob = state.openingBalances.find(b => b.column === colId as AccountColumnId);
  const baseDebit = ob?.debit || 0;
  const baseCredit = ob?.credit || 0;

  // Sum transactions BEFORE selected month to get rolling opening balance
  let priorDebit = 0;
  let priorCredit = 0;
  let duringDebit = 0;
  let duringCredit = 0;

  state.transactions
    .filter(t => t.status === "active")
    .forEach(t => {
      const txMonth = new Date(t.date).getMonth();
      const d = t.amounts[colId as AccountColumnId]?.debit || 0;
      const c = t.amounts[colId as AccountColumnId]?.credit || 0;

      if (txMonth < selectedMonthIndex) {
        priorDebit += d;
        priorCredit += c;
      } else if (txMonth === selectedMonthIndex) {
        duringDebit += d;
        duringCredit += c;
      }
    });

  // Opening = base + prior transactions (as net)
  const openNet = (baseDebit - baseCredit) + (priorDebit - priorCredit);
  const openDebit = openNet > 0 ? openNet : 0;
  const openCredit = openNet < 0 ? Math.abs(openNet) : 0;

  // Closing = opening net + during net
  const endNet = openNet + (duringDebit - duringCredit);
  const endDebit = endNet > 0 ? endNet : 0;
  const endCredit = endNet < 0 ? Math.abs(endNet) : 0;

  return { openDebit, openCredit, duringDebit, duringCredit, endDebit, endCredit };
}

/** Split a number into دينار and فلس */
export function splitDinarFils(value: number): [string, string] {
  if (value === 0) return ["-", "-"];
  const abs = Math.abs(value);
  const dinar = Math.floor(abs);
  const fils = Math.round((abs - dinar) * 1000);
  return [dinar.toLocaleString("ar-JO"), fils.toString().padStart(3, "0")];
}

/** Split for numeric (Excel) usage */
export function splitDinarFilsNumeric(value: number): [number | string, number | string] {
  if (value === 0) return ["", ""];
  const abs = Math.abs(value);
  const dinar = Math.floor(abs);
  const fils = Math.round((abs - dinar) * 1000);
  return [dinar, fils];
}
