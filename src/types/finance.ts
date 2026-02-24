export const ACCOUNT_COLUMNS = [
  { id: "cashBox", label: "الصندوق" },
  { id: "bank", label: "البنك" },
  { id: "donations", label: "التبرعات" },
  { id: "advances", label: "السلفة" },
  { id: "gardens", label: "الحدائق" },
  { id: "redCrescent", label: "الهلال الأحمر" },
  { id: "sdi", label: "SDI" },
  { id: "deposits", label: "الأمانات" },
  { id: "mySchool", label: "مدرستي أنتمي" },
] as const;

export type AccountColumnId = typeof ACCOUNT_COLUMNS[number]["id"];

export type TransactionType = "receipt" | "payment" | "journal";

export interface ColumnAmount {
  debit: number; // من
  credit: number; // الى
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  status: "active" | "cancelled";
  referenceNumber: string;
  amounts: Record<AccountColumnId, ColumnAmount>;
}

export interface OpeningBalance {
  column: AccountColumnId;
  debit: number;
  credit: number;
}

export interface FinanceState {
  schoolName: string;
  transactions: Transaction[];
  openingBalances: OpeningBalance[];
  currentMonth: string;
  currentYear: string;
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  receipt: "سند قبض",
  payment: "مستند صرف",
  journal: "سند قيد",
};

export function createEmptyAmounts(): Record<AccountColumnId, ColumnAmount> {
  return Object.fromEntries(
    ACCOUNT_COLUMNS.map((col) => [col.id, { debit: 0, credit: 0 }])
  ) as Record<AccountColumnId, ColumnAmount>;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
