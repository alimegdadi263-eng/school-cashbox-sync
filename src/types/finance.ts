// الحسابات التي تستخدم (منه/له) بدلاً من (من/إلى)
export const ASSET_ACCOUNTS: readonly string[] = ["cashBox", "bank", "advances"] as const;

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

export function isAssetAccount(id: string): boolean {
  return ASSET_ACCOUNTS.includes(id);
}

export type AccountColumnId = typeof ACCOUNT_COLUMNS[number]["id"];

export type TransactionType = "receipt" | "payment" | "journal" | "advance_withdrawal" | "advance_payment";

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
  checkNumber?: string; // رقم الشيك لمستندات الصرف
  sourceAccount?: AccountColumnId; // الحساب المصدر
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
  advance_withdrawal: "سحب سلفة يد",
  advance_payment: "صرف السلفة",
};

// الحسابات المتاحة للصرف (من هذه الحسابات الى البنك)
export const PAYMENT_SOURCE_ACCOUNTS: AccountColumnId[] = [
  "donations", "redCrescent", "gardens", "mySchool", "deposits", "sdi"
];

// الحسابات المتاحة للقيد (من الصندوق الى هذه الحسابات)
export const JOURNAL_TARGET_ACCOUNTS: AccountColumnId[] = [
  "donations", "gardens", "redCrescent", "deposits", "mySchool", "sdi"
];

export function createEmptyAmounts(): Record<AccountColumnId, ColumnAmount> {
  return Object.fromEntries(
    ACCOUNT_COLUMNS.map((col) => [col.id, { debit: 0, credit: 0 }])
  ) as Record<AccountColumnId, ColumnAmount>;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getAccountLabel(id: AccountColumnId): string {
  return ACCOUNT_COLUMNS.find((col) => col.id === id)?.label || id;
}
