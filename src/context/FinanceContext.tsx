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

function loadState(userId: string): FinanceState {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${userId}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultState;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || "anonymous";
  const [state, setState] = useState<FinanceState>(() => loadState(userId));
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
  const loadFromLan = useCallback(async (uid: string) => {
    const lan = getElectronLan();
    if (!lan) return null;
    try {
      const result = await lan.getData(`${STORAGE_KEY_PREFIX}-${uid}`);
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
      await lan.setData(`${STORAGE_KEY_PREFIX}-${uid}`, data);
    } catch (err) {
      console.error('LAN save error:', err);
    }
  }, []);

  // Reload state when user changes
  useEffect(() => {
    if (user?.id) {
      const uid = user.id;
      // Try LAN first, then localStorage
      (async () => {
        if (await isLanMode()) {
          const lanData = await loadFromLan(uid);
          if (lanData) {
            setState(lanData);
            return;
          }
        }
        setState(loadState(uid));
      })();
    }
  }, [user?.id, isLanMode, loadFromLan]);

  // Save to localStorage + LAN
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}-${userId}`, JSON.stringify(state));

    // Also save to LAN if connected
    (async () => {
      if (await isLanMode()) {
        await saveToLan(userId, state);
      }
    })();
  }, [state, userId, isLanMode, saveToLan]);

  // Periodic sync from LAN server (every 5 seconds for clients)
  useEffect(() => {
    const startSync = async () => {
      const lan = getElectronLan();
      if (!lan) return;

      syncTimerRef.current = setInterval(async () => {
        try {
          const connResult = await lan.isConnected();
          if (connResult?.connected && connResult?.mode === 'client') {
            const lanData = await loadFromLan(userId);
            if (lanData) {
              // Only update if data actually changed
              const currentStr = JSON.stringify(state);
              const lanStr = JSON.stringify(lanData);
              if (currentStr !== lanStr) {
                setState(lanData);
              }
            }
          }
        } catch {}
      }, 5000);
    };

    startSync();
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
