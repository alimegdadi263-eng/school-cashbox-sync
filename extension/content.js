// Content script — runs inside Ajyal pages (and iframes)
// Receives commands from background, performs DOM actions, reports logs

(function () {
  if (window.__ajyalAutomationInjected) return;
  window.__ajyalAutomationInjected = true;

  function log(level, message) {
    try { chrome.runtime.sendMessage({ type: "log", entry: { level, message } }); } catch {}
  }

  function collectDocs() {
    const docs = [document];
    document.querySelectorAll("iframe").forEach((f) => {
      try { if (f.contentDocument) docs.push(f.contentDocument); } catch {}
    });
    return docs;
  }

  function findByText(text) {
    const target = String(text).trim();
    for (const doc of collectDocs()) {
      const candidates = doc.querySelectorAll("a, button, [role=button], [role=tab], li, span, div");
      for (const el of candidates) {
        const t = (el.innerText || el.textContent || "").trim();
        if (!t) continue;
        if (t === target || t.includes(target)) {
          // Prefer clickable
          const clickable = el.closest("a,button,[role=button],[role=tab],li") || el;
          return clickable;
        }
      }
    }
    return null;
  }

  function highlight(el) {
    if (!el) return;
    const prev = el.style.outline;
    el.style.outline = "3px solid #d4a93c";
    el.style.outlineOffset = "2px";
    setTimeout(() => { el.style.outline = prev || ""; }, 800);
  }

  async function clickByText(text) {
    const el = findByText(text);
    if (!el) {
      log("error", `لم يتم العثور على: ${text}`);
      throw new Error(`Element not found: ${text}`);
    }
    highlight(el);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((r) => setTimeout(r, 250));
    el.click();
    await new Promise((r) => setTimeout(r, 600));
    return true;
  }

  async function uploadFile(filePath) {
    // Search for a file input across docs
    for (const doc of collectDocs()) {
      const input = doc.querySelector('input[type="file"]');
      if (input) {
        log("info", `تم العثور على حقل الرفع — يُرجى اختيار الملف يدوياً: ${filePath}`);
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        highlight(input);
        // Browsers do not allow JS to set file input value for security reasons.
        // Open a native picker:
        input.click();
        return true;
      }
    }
    throw new Error("لم يتم العثور على حقل رفع الملفات");
  }

  async function openAttendance() {
    // Try common labels
    const labels = ["الحضور والغياب", "الغياب", "حضور وغياب", "الدوام"];
    for (const l of labels) {
      const el = findByText(l);
      if (el) { highlight(el); el.click(); await new Promise(r => setTimeout(r, 800)); return true; }
    }
    throw new Error("تعذر فتح صفحة الغياب");
  }

  async function submitAttendance() {
    const labels = ["حفظ", "إرسال", "تأكيد", "Save"];
    for (const l of labels) {
      const el = findByText(l);
      if (el) {
        highlight(el); el.click();
        await new Promise(r => setTimeout(r, 600));
        chrome.runtime.sendMessage({ type: "attendanceSubmitted" });
        return true;
      }
    }
    throw new Error("لم يتم العثور على زر الحفظ");
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      try {
        if (msg.type === "click") return sendResponse({ ok: await clickByText(msg.text) });
        if (msg.type === "uploadFile") return sendResponse({ ok: await uploadFile(msg.filePath) });
        if (msg.type === "openAttendance") return sendResponse({ ok: await openAttendance() });
        if (msg.type === "submitAttendance") return sendResponse({ ok: await submitAttendance() });
        sendResponse({ ok: false, error: "unknown command" });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  });

  log("info", "تم تحميل سكربت أجيال على هذه الصفحة");
})();
