import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceProvider, useFinance } from "./FinanceContext";
import { createEmptyAmounts, type FinanceState } from "@/types/finance";

const authState = {
  user: null as { id: string } | null,
  loading: true,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

function FinanceProbe() {
  const { state } = useFinance();

  return (
    <div data-testid="finance-state">
      {`${state.schoolName}|${state.transactions.length}|${state.currentMonth}|${state.currentYear}`}
    </div>
  );
}

describe("FinanceProvider persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    authState.user = null;
    authState.loading = true;
  });

  it("loads the authenticated user's saved month without overwriting it during auth initialization", async () => {
    const savedState: FinanceState = {
      schoolName: "مدرسة الاختبار",
      directorateName: "المديرية",
      directorName: "المدير",
      member1Name: "عضو 1",
      member2Name: "عضو 2",
      transactions: [
        {
          id: "tx-1",
          date: "2025-04-10",
          description: "حركة محفوظة",
          type: "receipt",
          status: "active",
          referenceNumber: "123",
          amounts: createEmptyAmounts(),
        },
      ],
      openingBalances: [],
      currentMonth: "نيسان",
      currentYear: "2025",
    };

    const storageKey = "school-finance-data-user-1-نيسان-2025";
    const periodKey = "school-finance-last-period-user-1";

    localStorage.setItem(storageKey, JSON.stringify(savedState));
    localStorage.setItem(periodKey, JSON.stringify({ month: "نيسان", year: "2025" }));

    const view = render(
      <FinanceProvider>
        <FinanceProbe />
      </FinanceProvider>
    );

    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify(savedState));

    authState.user = { id: "user-1" };
    authState.loading = false;

    view.rerender(
      <FinanceProvider>
        <FinanceProbe />
      </FinanceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("finance-state").textContent).toBe("مدرسة الاختبار|1|نيسان|2025");
    });

    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify(savedState));
    expect(localStorage.getItem(periodKey)).toBe(JSON.stringify({ month: "نيسان", year: "2025" }));
  });
});