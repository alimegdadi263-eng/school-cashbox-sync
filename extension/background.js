// Background service worker — bridges web app <-> content script
// Tracks downloads to confirm export completion before triggering import

const state = {
  webPort: null,        // Port from web app (via externally_connectable)
  ajyalTabId: null,     // The Ajyal tab we are automating
  pendingDownloadId: null,
  pendingDownloadPath: null,
  onDownloadDone: null, // resolver
};

// ---------- Utility: log to web app ----------
function sendLog(entry) {
  // entry: { level: 'pending'|'done'|'error'|'info', message: string, taskId?: string }
  try {
    if (state.webPort) state.webPort.postMessage({ type: "log", entry });
  } catch (e) { /* port closed */ }
}

function sendStatus(status) {
  try {
    if (state.webPort) state.webPort.postMessage({ type: "status", status });
  } catch (e) {}
}

// ---------- External connection from the web app ----------
chrome.runtime.onConnectExternal.addListener((port) => {
  state.webPort = port;
  sendStatus({ connected: true });
  port.onMessage.addListener(async (msg) => {
    try {
      await handleWebCommand(msg);
    } catch (err) {
      sendLog({ level: "error", message: `خطأ: ${err?.message || err}` });
    }
  });
  port.onDisconnect.addListener(() => {
    if (state.webPort === port) state.webPort = null;
  });
});

// Also accept one-shot messages
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  handleWebCommand(msg).then(
    (r) => sendResponse({ ok: true, result: r }),
    (e) => sendResponse({ ok: false, error: String(e?.message || e) })
  );
  return true;
});

// ---------- Web app -> background commands ----------
async function handleWebCommand(msg) {
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case "ping":
      return { pong: true, version: chrome.runtime.getManifest().version };
    case "ensureAjyalTab":
      return await ensureAjyalTab(msg.url);
    case "runTask":
      return await runTask(msg.task, msg.payload || {});
    case "submitAttendance":
      return await sendToContent({ type: "submitAttendance" });
  }
}

async function ensureAjyalTab(url) {
  const target = url || "https://emis.moe.gov.jo/";
  if (state.ajyalTabId) {
    try {
      const tab = await chrome.tabs.get(state.ajyalTabId);
      if (tab) {
        await chrome.tabs.update(state.ajyalTabId, { active: true });
        return { tabId: state.ajyalTabId };
      }
    } catch {}
  }
  const tab = await chrome.tabs.create({ url: target, active: true });
  state.ajyalTabId = tab.id;
  return { tabId: tab.id };
}

async function sendToContent(msg) {
  if (!state.ajyalTabId) await ensureAjyalTab();
  return await chrome.tabs.sendMessage(state.ajyalTabId, msg);
}

// ---------- Tasks orchestration ----------
async function runTask(task, payload) {
  sendLog({ level: "info", message: `▶️ بدء المهمة: ${task}` });
  await ensureAjyalTab(payload.url);

  if (task === "exportImportStudents") {
    sendLog({ level: "pending", message: "فتح شؤون الطلبة..." });
    await sendToContent({ type: "click", text: "شؤون الطلبة" });
    sendLog({ level: "done", message: "تم النقر على شؤون الطلبة" });

    sendLog({ level: "pending", message: "فتح تبويب الطلبة..." });
    await sendToContent({ type: "click", text: "طلبة" });
    sendLog({ level: "done", message: "تم فتح قائمة الطلبة" });

    sendLog({ level: "pending", message: "تصدير الملف..." });
    const downloadPromise = waitForNextDownload(60000);
    await sendToContent({ type: "click", text: "تصدير" });
    const dl = await downloadPromise;
    sendLog({ level: "done", message: `تم التنزيل: ${dl.filename}` });

    sendLog({ level: "pending", message: "بدء الاستيراد بنفس الملف..." });
    await sendToContent({ type: "click", text: "استيراد" });
    await sendToContent({ type: "uploadFile", filePath: dl.filename });
    sendLog({ level: "done", message: "اكتمل الاستيراد ✅" });
    return { ok: true };
  }

  if (task === "fillAttendance") {
    sendLog({ level: "pending", message: "فتح صفحة الغياب..." });
    await sendToContent({ type: "openAttendance" });
    sendLog({ level: "done", message: "تم فتح صفحة الغياب" });
    sendLog({ level: "pending", message: "بانتظار تعبئة الغياب يدوياً ثم اضغط 'إرسال الغياب'..." });
    return { ok: true, waiting: true };
  }
}

// ---------- Downloads tracking ----------
chrome.downloads.onCreated.addListener((item) => {
  state.pendingDownloadId = item.id;
});
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === "complete" && state.onDownloadDone) {
    chrome.downloads.search({ id: delta.id }, (items) => {
      const it = items && items[0];
      if (it && state.onDownloadDone) {
        const r = state.onDownloadDone;
        state.onDownloadDone = null;
        r({ id: it.id, filename: it.filename });
      }
    });
  }
});

function waitForNextDownload(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    state.onDownloadDone = resolve;
    setTimeout(() => {
      if (state.onDownloadDone === resolve) {
        state.onDownloadDone = null;
        reject(new Error("انتهى وقت انتظار التنزيل"));
      }
    }, timeoutMs);
  });
}

// ---------- Logs from content script ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "log") sendLog(msg.entry);
  if (msg?.type === "attendanceSubmitted") {
    sendLog({ level: "done", message: "تم إرسال الغياب ✅" });
  }
  sendResponse({ ok: true });
  return true;
});
