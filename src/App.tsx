import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { FinanceProvider } from "@/context/FinanceContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import CashBook from "./pages/CashBook";
import TransactionPage from "./pages/TransactionPage";
import MonthlySummary from "./pages/MonthlySummary";
import SettingsPage from "./pages/SettingsPage";
import AdminUsers from "./pages/AdminUsers";
import FinancialForms from "./pages/FinancialForms";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SubscriptionExpired from "./components/SubscriptionExpired";
import InstructionsPage from "./pages/InstructionsPage";
import CodeDocumentation from "./pages/CodeDocumentation";
import PresentationExport from "./pages/PresentationExport";
import TimetablePage from "./pages/TimetablePage";
import SecretaryPage from "./pages/SecretaryPage";
import SdiAnalysis from "./pages/SdiAnalysis";
import ExamSchedulePage from "./pages/ExamSchedulePage";
import { TimetableProvider } from "@/context/TimetableContext";
import UpdateNotification from "@/components/UpdateNotification";

const queryClient = new QueryClient();
const isDesktopApp =
  typeof window !== "undefined" &&
  (((window as Window & { electronAPI?: unknown }).electronAPI !== undefined) || window.location.protocol === "file:");
const Router = isDesktopApp ? HashRouter : BrowserRouter;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isActive, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin && !isActive) return <SubscriptionExpired />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <NetworkProvider>
        <FinanceProvider>
          <TimetableProvider>
          <Toaster />
          <Sonner />
          <UpdateNotification />
          <Router>
            <Routes>
              <Route path="/login" element={<AuthRoute><Auth /></AuthRoute>} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/cashbook" element={<ProtectedRoute><CashBook /></ProtectedRoute>} />
              <Route path="/transaction" element={<ProtectedRoute><TransactionPage /></ProtectedRoute>} />
              <Route path="/summary" element={<ProtectedRoute><MonthlySummary /></ProtectedRoute>} />
              <Route path="/forms" element={<ProtectedRoute><FinancialForms /></ProtectedRoute>} />
              <Route path="/instructions" element={<ProtectedRoute><InstructionsPage /></ProtectedRoute>} />
              <Route path="/timetable" element={<ProtectedRoute><TimetablePage /></ProtectedRoute>} />
              <Route path="/exams" element={<ProtectedRoute><ExamSchedulePage /></ProtectedRoute>} />
              <Route path="/secretary" element={<ProtectedRoute><SecretaryPage /></ProtectedRoute>} />
              <Route path="/sdi-analysis" element={<ProtectedRoute><SdiAnalysis /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
              <Route path="/code-docs" element={<AdminRoute><CodeDocumentation /></AdminRoute>} />
              <Route path="/presentation" element={<AdminRoute><PresentationExport /></AdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
          </TimetableProvider>
        </FinanceProvider>
        </NetworkProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
