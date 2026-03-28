import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root غير موجود");
}

const root = createRoot(rootElement);

const renderFatalError = (message: string) => {
  root.render(
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-lg w-full rounded-lg border bg-card p-6 space-y-4 text-center">
        <h1 className="text-xl font-bold">حدث خطأ أثناء تشغيل الواجهة</h1>
        <p className="text-sm text-muted-foreground break-words">{message}</p>
        <p className="text-xs text-muted-foreground">اضغط "رجوع" للعودة للبرنامج، أو أغلقه وشغّله من جديد.</p>
        <button
          onClick={() => { try { root.render(<App />); } catch { window.location.reload(); } }}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          ← رجوع
        </button>
      </div>
    </div>
  );
};

window.addEventListener("error", (event) => {
  renderFatalError(event.message || "خطأ غير معروف");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "خطأ غير معروف");
  renderFatalError(reason);
});

try {
  root.render(<App />);
} catch (error) {
  const message = error instanceof Error ? error.message : "خطأ غير معروف";
  renderFatalError(message);
}
