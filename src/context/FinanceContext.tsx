import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import {
  FinanceState,
  Transaction,
  OpeningBalance,
  ACCOUNT_COLUMNS,
  AccountColumnId,
  ColumnAmount,
} from "@/types/finance";
import { useAuth } from "@/hooks/useAuth";

interface FinanceContextType {
  state: FinanceState;
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setOpeningBalances: (balances: OpeningBalance[]) => void;
  updateSettings: (settings: { schoolName: string; directorateName: string; directorName: string; member1Name: string; member2Name: string; month: string; year: string }) => void;
  getColumnBalance: (colId: AccountColumnId) => { debit: number; credit: number; net: number };
  getTotalBalance: () => { debit: number; credit: number; net: number };
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = "school-finance-data";

const defaultState: FinanceState = {
  schoolName: "المدرسة",
  directorateName: "",
  directorName: "",
  member1Name: "",
  member2Name: "",
  transactions: [],
  openingBalances: ACCOUNT_COLUMNS.map((col) => ({
    column: col.id,
    debit: 0,
    credit: 0,
  })),
  currentMonth: new Date().toLocaleString("ar", { month: "long" }),
  currentYear: new Date().getFullYear().toString(),
};

function getElectronLan() {
  return (window as any)?.electronAPI?.lan;
}

function getStorageKey(userId: string, month: string, year: string): string {
  return `${STORAGE_KEY_PREFIX}-${userId}-${month}-${year}`;
}

function loadState(userId: string, month?: string, year?: string): FinanceState {
  // Try loading with month/year key first
  if (month && year) {
    try {
      const saved = localStorage.getItem(getStorageKey(userId, month, year));
      if (saved) return JSON.parse(saved);
    } catch {}
  }
  // Fallback: try old key (migrate existing data)
  try {
    const oldKey = `${STORAGE_KEY_PREFIX}-${userId}`;
    const saved = localStorage.getItem(oldKey);
    if (saved) {
      const parsed = JSON.parse(saved) as FinanceState;
      // Save under new month-specific key and keep old data
      if (parsed.currentMonth && parsed.currentYear) {
        const newKey = getStorageKey(userId, parsed.currentMonth, parsed.currentYear);
        localStorage.setItem(newKey, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {}
  return defaultState;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || "anonymous";
  const [state, setState] = useState<FinanceState>(() => loadState(userId, defaultState.currentMonth, defaultState.currentYear));
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if in LAN network mode
  const isLanMode = useCallback(async () => {
    const lan = getElectronLan();
    if (!lan) return false;
    try {
      const result = await lan.isConnected();
      return result?.connected === true;
    } catch {
      return false;
    }
  }, []);

  // Load from LAN server
  const loadFromLan = useCallback(async (uid: string, month: string, year: string) => {
    const lan = getElectronLan();
    if (!lan) return null;
    try {
      const result = await lan.getData(getStorageKey(uid, month, year));
      if (result?.success && result.data) {
        return result.data as FinanceState;
      }
    } catch (err) {
      console.error('LAN load error:', err);
    }
    return null;
  }, []);

  // Save to LAN server
  const saveToLan = useCallback(async (uid: string, data: FinanceState) => {
    const lan = getElectronLan();
    if (!lan) return;
    try {
      await lan.setData(getStorageKey(uid, data.currentMonth, data.currentYear), data);
    } catch (err) {
      console.error('LAN save error:', err);
    }
  }, []);

  // Reload state when user changes or month/year changes
  useEffect(() => {
    if (user?.id) {
      const uid = user.id;
      const month = state.currentMonth;
      const year = state.currentYear;
      (async () => {
        if (await isLanMode()) {
          const lanData = await loadFromLan(uid, month, year);
          if (lanData) {
            setState(lanData);
            return;
          }
        }
        setState(loadState(uid, month, year));
      })();
    }
  }, [user?.id]);

  // Save to localStorage + LAN whenever state changes
  useEffect(() => {
    const key = getStorageKey(userId, state.currentMonth, state.currentYear);
    localStorage.setItem(key, JSON.stringify(state));

    // Also save to LAN if connected
    (async () => {
      if (await isLanMode()) {
        await saveToLan(userId, state);
      }
    })();
  }, [state, userId, isLanMode, saveToLan]);

  // Periodic sync: clients pull from server, server pulls from LAN DB (for client changes)
  useEffect(() => {
    const lan = getElectronLan();
    if (!lan) return;

    syncTimerRef.current = setInterval(async () => {
      try {
        const connResult = await lan.isConnected();
        if (!connResult?.connected) return;

        // Both server and client modes should sync from LAN storage
        const lanData = await loadFromLan(userId);
        if (lanData) {
          const currentStr = JSON.stringify(state);
          const lanStr = JSON.stringify(lanData);
          if (currentStr !== lanStr) {
            setState(lanData);
          }
        }
      } catch {}
    }, 5000);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [userId, loadFromLan]);

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

  const updateSettings = useCallback((settings: { schoolName: string; directorateName: string; directorName: string; member1Name: string; member2Name: string; month: string; year: string }) => {
    setState((s) => ({
      ...s,
      schoolName: settings.schoolName,
      directorateName: settings.directorateName,
      directorName: settings.directorName,
      member1Name: settings.member1Name,
      member2Name: settings.member2Name,
      currentMonth: settings.month,
      currentYear: settings.year,
    }));
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
        state, addTransaction, updateTransaction, deleteTransaction,
        setOpeningBalances, updateSettings, getColumnBalance, getTotalBalance,
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
