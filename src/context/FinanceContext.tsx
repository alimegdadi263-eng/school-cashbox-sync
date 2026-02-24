import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  FinanceState,
  Transaction,
  OpeningBalance,
  ACCOUNT_COLUMNS,
  AccountColumnId,
  ColumnAmount,
} from "@/types/finance";

interface FinanceContextType {
  state: FinanceState;
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setOpeningBalances: (balances: OpeningBalance[]) => void;
  updateSettings: (schoolName: string, month: string, year: string) => void;
  getColumnBalance: (colId: AccountColumnId) => { debit: number; credit: number; net: number };
  getTotalBalance: () => { debit: number; credit: number; net: number };
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEY = "school-finance-data";

const defaultState: FinanceState = {
  schoolName: "المدرسة الثانوية الشاملة",
  transactions: [],
  openingBalances: ACCOUNT_COLUMNS.map((col) => ({
    column: col.id,
    debit: 0,
    credit: 0,
  })),
  currentMonth: new Date().toLocaleString("ar", { month: "long" }),
  currentYear: new Date().getFullYear().toString(),
};

function loadState(): FinanceState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultState;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addTransaction = useCallback((tx: Transaction) => {
    setState((s) => ({ ...s, transactions: [...s.transactions, tx] }));
  }, []);

  const updateTransaction = useCallback((tx: Transaction) => {
    setState((s) => ({
      ...s,
      transactions: s.transactions.map((t) => (t.id === tx.id ? tx : t)),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      transactions: s.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  const setOpeningBalances = useCallback((balances: OpeningBalance[]) => {
    setState((s) => ({ ...s, openingBalances: balances }));
  }, []);

  const updateSettings = useCallback((schoolName: string, month: string, year: string) => {
    setState((s) => ({ ...s, schoolName, currentMonth: month, currentYear: year }));
  }, []);

  const getColumnBalance = useCallback(
    (colId: AccountColumnId) => {
      const opening = state.openingBalances.find((b) => b.column === colId);
      let debit = opening?.debit || 0;
      let credit = opening?.credit || 0;

      state.transactions
        .filter((t) => t.status === "active")
        .forEach((t) => {
          debit += t.amounts[colId]?.debit || 0;
          credit += t.amounts[colId]?.credit || 0;
        });

      return { debit, credit, net: debit - credit };
    },
    [state]
  );

  const getTotalBalance = useCallback(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    ACCOUNT_COLUMNS.forEach((col) => {
      const b = getColumnBalance(col.id);
      totalDebit += b.debit;
      totalCredit += b.credit;
    });
    return { debit: totalDebit, credit: totalCredit, net: totalDebit - totalCredit };
  }, [getColumnBalance]);

  return (
    <FinanceContext.Provider
      value={{
        state,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        setOpeningBalances,
        updateSettings,
        getColumnBalance,
        getTotalBalance,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
