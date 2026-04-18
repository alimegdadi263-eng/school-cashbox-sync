const { app, BrowserWindow, session, globalShortcut, dialog, ipcMain, BrowserView, shell } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { setupAutoUpdater, checkForUpdates, checkForUpdatesSilent, runUpdateAction } = require('./updater.cjs');
const { LanServer } = require('./lan-server.cjs');
const { LanClient } = require('./lan-client.cjs');

const isDev = !app.isPackaged;
const versionStatePath = path.join(app.getPath('userData'), 'app-version.json');

// Security: Disable hardware acceleration for security
app.disableHardwareAcceleration();

// ── LAN instances ────────────────────────────────────────────────────────────
const lanServer = new LanServer();
const lanClient = new LanClient();
let networkMode = 'standalone'; // 'standalone' | 'server' | 'client'

// ── Integrity Check ──────────────────────────────────────────────────────────
function verifyIntegrity() {
  if (isDev) return true;
  try {
    const distDir = path.join(__dirname, '../dist');
    const manifestPath = path.join(distDir, '.integrity.json');
    if (!fs.existsSync(manifestPath)) { console.error('Integrity manifest not found'); return false; }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const expectedSig = crypto.createHash('sha256').update(JSON.stringify(manifest.files) + manifest.generatedAt).digest('hex');
    if (expectedSig !== manifest.signature) { console.error('Integrity manifest signature mismatch'); return false; }
    for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
      const filePath = path.join(distDir, relativePath);
      if (!fs.existsSync(filePath)) { console.error(`Missing file: ${relativePath}`); return false; }
      const content = fs.readFileSync(filePath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      if (actualHash !== expectedHash) { console.error(`Tampered file detected: ${relativePath}`); return false; }
    }
    console.log('Integrity check passed ✓');
    return true;
  } catch (error) {
    console.error('Integrity check failed:', error.message);
    return false;
  }
}

// ── Main Window ──────────────────────────────────────────────────────────────
async function clearDesktopCacheOnVersionChange() {
  if (isDev) return;

  const currentVersion = app.getVersion();
  let previousVersion = null;

  try {
    if (fs.existsSync(versionStatePath)) {
      const saved = JSON.parse(fs.readFileSync(versionStatePath, 'utf8'));
      previousVersion = saved?.version || null;
    }
  } catch (error) {
    console.warn('Failed to read saved app version:', error.message);
  }

  if (previousVersion && previousVersion !== currentVersion) {
    try {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({
        storages: ['serviceworkers', 'cachestorage'],
      });
      console.log(`Cleared desktop cache after update (${previousVersion} -> ${currentVersion})`);
    } catch (error) {
      console.warn('Failed to clear desktop cache after update:', error.message);
    }
  }

  try {
    fs.writeFileSync(versionStatePath, JSON.stringify({ version: currentVersion }), 'utf8');
  } catch (error) {
    console.warn('Failed to persist current app version:', error.message);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700,
    title: 'الادارة المدرسية - Ali Megdadi',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false,
      devTools: isDev, javascript: true, webgl: false, enableWebSQL: false,
    },
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load:', { errorCode, errorDescription, validatedURL });
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'خطأ في تحميل الواجهة',
      message: `تعذر تحميل واجهة البرنامج.\n${errorDescription} (${errorCode})`,
      buttons: ['إعادة المحاولة', 'إغلاق'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        if (isDev) mainWindow.loadURL('http://localhost:8080');
        else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      }
    });
  });
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error('Renderer console:', { level, message, line, sourceId });
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process crashed:', details);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'تعطل الواجهة',
      message: 'حدث تعطل في واجهة البرنامج.',
      buttons: ['إعادة التحميل', 'إغلاق'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        if (isDev) mainWindow.loadURL('http://localhost:8080');
        else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      }
    });
  });

  if (!isDev) { mainWindow.setMenu(null); mainWindow.removeMenu(); }
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => { mainWindow.webContents.closeDevTools(); });
  }

  // CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith('file://')) { callback({ responseHeaders: { ...details.responseHeaders } }); return; }
    // Don't modify CSP for Ajyal window
    if (details.url.includes('ajyal.edu.jo')) { callback({ responseHeaders: { ...details.responseHeaders } }); return; }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: blob: https:; " +
          "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co http://localhost:* http://192.168.*:* http://10.*:* http://172.*:*; " +
          "frame-src 'none';",
        ],
      },
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === '' || url === 'about:blank') return { action: 'allow' };
    // Allow WhatsApp and other external links to open in default browser
    if (url.startsWith('https://wa.me/') || url.startsWith('https://api.whatsapp.com/') || url.startsWith('https://web.whatsapp.com/')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (isDev && parsedUrl.hostname === 'localhost') return;
    if (parsedUrl.protocol === 'file:') return;
    event.preventDefault();
  });

  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') { event.preventDefault(); return; }
      if (input.control && input.shift && ['I', 'J', 'C'].includes(input.key.toUpperCase())) { event.preventDefault(); return; }
      if (input.control && input.key.toUpperCase() === 'U') { event.preventDefault(); return; }
    });
  }

  if (isDev) { mainWindow.loadURL('http://localhost:8080'); }
  else { mainWindow.loadFile(path.join(__dirname, '../dist/index.html')); }

  return mainWindow;
}

// ── LAN IPC Handlers ─────────────────────────────────────────────────────────
function setupLanHandlers() {
  // Server controls
  ipcMain.handle('lan-start-server', async () => {
    try {
      const result = await lanServer.start();
      networkMode = 'server';
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('lan-stop-server', async () => {
    await lanServer.stop();
    networkMode = 'standalone';
    return { success: true };
  });

  ipcMain.handle('lan-get-server-info', () => {
    return lanServer.getInfo();
  });

  // Client controls
  ipcMain.handle('lan-connect', async (_event, ip, port) => {
    try {
      const result = await lanClient.connect(ip, port || 9753);
      networkMode = 'client';
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('lan-disconnect', () => {
    lanClient.disconnect();
    networkMode = 'standalone';
    return { success: true };
  });

  ipcMain.handle('lan-get-mode', () => {
    return { mode: networkMode };
  });

  ipcMain.handle('open-external-url', async (_event, url) => {
    try {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return { success: false, error: 'Invalid URL' };
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Data operations (route to server DB or remote server)
  ipcMain.handle('lan-get-data', async (_event, key) => {
    try {
      if (networkMode === 'server') {
        return { success: true, data: lanServer.db.getData(key) };
      } else if (networkMode === 'client') {
        const data = await lanClient.getData(key);
        return { success: true, data };
      }
      return { success: false, error: 'Not in network mode' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('lan-set-data', async (_event, key, data) => {
    try {
      if (networkMode === 'server') {
        lanServer.db.setData(key, data);
        return { success: true };
      } else if (networkMode === 'client') {
        await lanClient.setData(key, data);
        return { success: true };
      }
      return { success: false, error: 'Not in network mode' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('lan-ping', async () => {
    try {
      if (networkMode === 'server') {
        return { success: true, status: 'ok' };
      } else if (networkMode === 'client') {
        await lanClient.ping();
        return { success: true, status: 'ok' };
      }
      return { success: false, error: 'Not in network mode' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('lan-is-connected', () => {
    if (networkMode === 'server') return { connected: true, mode: 'server' };
    if (networkMode === 'client') return { connected: lanClient.isConnected(), mode: 'client' };
    return { connected: false, mode: 'standalone' };
  });
}

// ── Ajyal Integration IPC Handlers ───────────────────────────────────────────
let ajyalView = null;
let mainWindowRef = null;
let ajyalToolbarPollInterval = null;
let ajyalActionInProgress = false;
let ajyalDownloadDir = null;
let ajyalLastDownloadPath = null;

// ── Command #4: Navigation Map ──────────────────────────────────────────────
const AJYAL_NAV_MAP = {
  // مسار استيراد الطلبة الفعلي: شؤون الطلبة ← الطلبة ← تصدير Excel
  import: {
    steps: [
      { action: 'click', targets: ['شؤون الطلبة', 'شئون الطلبة'], message: '🔍 الخطوة 1/3: فتح شؤون الطلبة...', wait: 3500 },
      { action: 'click', targets: ['الطلبة', 'إدارة الطلبة', 'بيانات الطلبة', 'قائمة الطلبة'], message: '🔍 الخطوة 2/3: فتح صفحة الطلبة...', wait: 3500 },
    ],
    exportStep: { targets: ['تصدير', 'تصدير Excel', 'تصدير إلى Excel', 'Export', 'تنزيل', 'Download', 'تصدير ملف'], message: '📥 الخطوة 3/3: الضغط على تصدير...', wait: 4000 },
    gradeLabels: ['الصف', 'المرحلة', 'الفصل', 'grade', 'class', 'Grade'],
    sectionLabels: ['الشعبة', 'القسم', 'الفرع', 'section', 'Section'],
    searchButtons: ['بحث', 'عرض', 'Search', 'Show', 'إظهار', 'استعلام'],
    searchTag: 'button, input[type="submit"], input[type="button"], a.btn, .btn, a',
    tableWait: 3000,
  },
  // مسار إدخال الغياب: الانضباط المدرسي ← إدخال الانضباط والالتزام بالدوام ← الصف ← تحديد الغائبين أو تأكيد عدم وجود غياب ← الانضباط المدرسي ← تأكيد الانتهاء
  absence: {
    steps: [
      { action: 'click', targets: ['الانضباط المدرسي', 'الانضباط', 'الحضور والغياب'], message: '🔍 الخطوة 1/4: فتح الانضباط المدرسي...', wait: 3500 },
      { action: 'click', targets: ['إدخال الانضباط المدرسي والالتزام بالدوام المدرسي', 'إدخال الانضباط المدرسي', 'إدخال الانضباط', 'ادخال الانضباط المدرسي', 'ادخال الانضباط', 'تسجيل الغياب', 'رصد الغياب'], message: '🔍 الخطوة 2/4: فتح إدخال الانضباط المدرسي...', wait: 3500 },
    ],
    confirmNoAbsence: ['تأكيد عدم وجود غياب', 'لا يوجد غياب', 'عدم وجود غياب'],
    confirmSteps: [
      { action: 'click', targets: ['الانضباط المدرسي', 'الانضباط'], message: '🔄 الرجوع إلى الانضباط المدرسي...', wait: 3000 },
      { action: 'click', targets: ['تأكيد الإنتهاء من الغياب', 'تأكيد الانتهاء من الغياب', 'تأكيد الانتهاء', 'تأكيد الإنتهاء'], message: '✅ تأكيد الإنتهاء من الغياب...', wait: 3000 },
    ],
    absenceType: ['بدون عذر', 'غائب بدون عذر', 'غياب بدون عذر'],
    gradeLabels: ['الصف', 'المرحلة', 'الفصل', 'grade', 'class', 'Grade'],
    sectionLabels: ['الشعبة', 'القسم', 'الفرع', 'section', 'Section'],
    searchButtons: ['عرض الطلبة', 'عرض', 'بحث', 'Show', 'Search', 'إظهار'],
    searchTag: 'button, input[type="submit"], input[type="button"], a.btn, .btn, a',
    tableWait: 3000,
  },
};

function setupAjyalHandlers(mainWindow) {
  mainWindowRef = mainWindow;

  // ── Command #5: Send progress to renderer ──
  function sendProgress(msg) {
    try { mainWindow.webContents.send('ajyal-action', { type: 'progress', message: msg }); } catch {}
  }

  async function setToolbarButtonsDisabled(disabled) {
    try {
      await ajyalExec(
        '(function(){' +
        'var toolbar = document.getElementById("ajyal-toolbar");' +
        'if (toolbar) toolbar.dataset.busy = ' + JSON.stringify(disabled ? 'true' : 'false') + ';' +
        'var btns = toolbar ? toolbar.querySelectorAll("button") : [];' +
        'for (var i = 0; i < btns.length; i++) {' +
        '  btns[i].disabled = ' + (disabled ? 'true' : 'false') + ';' +
        '  btns[i].style.opacity = ' + (disabled ? '"0.5"' : '"1"') + ';' +
        '  btns[i].style.cursor = ' + (disabled ? '"not-allowed"' : '"pointer"') + ';' +
        '}' +
        '})()'
      );
    } catch {}
  }

  async function resetToolbarUi() {
    try {
      await ajyalExec(
        '(function(){' +
        'var importBtn = document.getElementById("btn-import-students");' +
        'var absenceBtn = document.getElementById("btn-submit-absence");' +
        'var closeBtn = document.getElementById("btn-close-ajyal");' +
        'if (importBtn) { importBtn.textContent = "📥 استيراد الطلاب"; delete importBtn.dataset.running; }' +
        'if (absenceBtn) { absenceBtn.textContent = "📋 تعبئة الغياب"; delete absenceBtn.dataset.running; }' +
        'if (closeBtn) { closeBtn.textContent = "← رجوع"; delete closeBtn.dataset.running; }' +
        '})()'
      );
      await setToolbarButtonsDisabled(false);
      await updateToolbarStatus('idle', 'متصل بأجيال ✓');
    } catch {}
  }

  function stopAjyalToolbarPolling() {
    if (ajyalToolbarPollInterval) {
      clearInterval(ajyalToolbarPollInterval);
      ajyalToolbarPollInterval = null;
    }
  }

  function startAjyalToolbarPolling() {
    stopAjyalToolbarPolling();
    ajyalToolbarPollInterval = setInterval(async () => {
      if (!ajyalView || ajyalView.webContents.isDestroyed()) {
        stopAjyalToolbarPolling();
        ajyalActionInProgress = false;
        return;
      }

      try {
        const action = await ajyalView.webContents.executeJavaScript(`
          (function() {
            const toolbar = document.getElementById('ajyal-toolbar');
            if (!toolbar) return null;

            if (!toolbar.dataset.handlersSet) {
              toolbar.dataset.handlersSet = 'true';
              var importBtn = document.getElementById('btn-import-students');
              var absenceBtn = document.getElementById('btn-submit-absence');
              var closeBtn = document.getElementById('btn-close-ajyal');
              if (importBtn) importBtn.addEventListener('click', function() {
                if (toolbar.dataset.busy === 'true' || this.dataset.running === 'true') return;
                toolbar.dataset.action = 'import-discover';
              });
              if (absenceBtn) absenceBtn.addEventListener('click', function() {
                if (toolbar.dataset.busy === 'true' || this.dataset.running === 'true') return;
                toolbar.dataset.action = 'absence-discover';
              });
              if (closeBtn) closeBtn.addEventListener('click', function() {
                if (toolbar.dataset.busy === 'true') return;
                toolbar.dataset.action = 'close';
              });
            }

            const action = toolbar.dataset.action;
            if (action) {
              delete toolbar.dataset.action;
              return action;
            }
            return null;
          })();
        `);

        if (!action || ajyalActionInProgress) return;

        if (action === 'import-discover') {
          ajyalActionInProgress = true;
          await setToolbarButtonsDisabled(true);
          try {
            await discoverAndShowGradePanel('import');
          } catch (e) {
            ajyalActionInProgress = false;
            await resetToolbarUi();
          }
        } else if (action === 'absence-discover') {
          ajyalActionInProgress = true;
          await setToolbarButtonsDisabled(true);
          try {
            await discoverAndShowGradePanel('absence');
          } catch (e) {
            ajyalActionInProgress = false;
            await resetToolbarUi();
          }
        } else if (action === 'import-execute') {
          try {
            var selectedJson = await ajyalExec('(function(){ var t = document.getElementById("ajyal-toolbar"); var v = t ? t.dataset.selectedGrades : ""; delete t.dataset.selectedGrades; return v || "[]"; })()');
            var selectedGrades = JSON.parse(selectedJson);
            await hideGradePanel();
            mainWindow.webContents.send('ajyal-action', { type: 'import-started' });
            var result = await runImportStudents(mainWindow, selectedGrades);
            mainWindow.webContents.send('ajyal-action', { type: 'import-result', ...result });
          } catch (e) {
            mainWindow.webContents.send('ajyal-action', { type: 'import-result', success: false, error: e.message });
          } finally {
            ajyalActionInProgress = false;
            await resetToolbarUi();
          }
        } else if (action === 'absence-execute') {
          try {
            var selectedJson2 = await ajyalExec('(function(){ var t = document.getElementById("ajyal-toolbar"); var v = t ? t.dataset.selectedGrades : ""; delete t.dataset.selectedGrades; return v || "[]"; })()');
            var selectedGrades2 = JSON.parse(selectedJson2);
            await hideGradePanel();
            mainWindow.webContents.send('ajyal-action', { type: 'absence-started' });
            var result2 = await runSubmitAbsence(mainWindow, null, selectedGrades2);
            mainWindow.webContents.send('ajyal-action', { type: 'absence-result', ...result2 });
          } catch (e) {
            mainWindow.webContents.send('ajyal-action', { type: 'absence-result', success: false, error: e.message });
          } finally {
            ajyalActionInProgress = false;
            await resetToolbarUi();
          }
        } else if (action === 'cancel-grade-select') {
          await hideGradePanel();
          ajyalActionInProgress = false;
          await resetToolbarUi();
        } else if (action === 'close') {
          ajyalActionInProgress = false;
          stopAjyalToolbarPolling();
          if (ajyalView && !ajyalView.webContents.isDestroyed()) {
            mainWindow.removeBrowserView(ajyalView);
          }
          mainWindow.webContents.send('ajyal-action', { type: 'closed' });
        }
      } catch {}
    }, 500);
  }

  ipcMain.handle('ajyal-open-embedded', async (_event, username, password, loginMethod = 'credentials') => {
    try {
      // Reuse existing view if session is alive
      if (ajyalView && !ajyalView.webContents.isDestroyed()) {
        mainWindow.addBrowserView(ajyalView);
        const bounds = mainWindow.getContentBounds();
        ajyalView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
        startAjyalToolbarPolling();
        setTimeout(() => { resetToolbarUi().catch(() => {}); }, 150);
        return { success: true, url: ajyalView.webContents.getURL(), reused: true };
      }

      const ajyalUrl = 'https://ajyal.moe.gov.jo';

      ajyalView = new BrowserView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          devTools: isDev,
        },
      });

      // ── Download capture: save Ajyal exports to a temp folder ──
      ajyalDownloadDir = path.join(app.getPath('temp'), 'ajyal-downloads');
      try { fs.mkdirSync(ajyalDownloadDir, { recursive: true }); } catch {}
      ajyalView.webContents.session.on('will-download', (event, item) => {
        try {
          const fname = item.getFilename() || ('ajyal-export-' + Date.now() + '.xlsx');
          const safe = fname.replace(/[^\w.\-]+/g, '_');
          const savePath = path.join(ajyalDownloadDir, Date.now() + '_' + safe);
          item.setSavePath(savePath);
          item.once('done', (_e, state) => {
            if (state === 'completed') {
              ajyalLastDownloadPath = savePath;
              try { mainWindow.webContents.send('ajyal-action', { type: 'progress', message: '📥 تم تنزيل الملف: ' + fname }); } catch {}
            }
          });
        } catch (e) { console.error('Download capture failed:', e.message); }
      });

      mainWindow.addBrowserView(ajyalView);
      const bounds = mainWindow.getContentBounds();
      ajyalView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
      ajyalView.setAutoResize({ width: true, height: true });

      ajyalView.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          ajyalView.webContents.loadURL(url);
        }
        return { action: 'deny' };
      });

      // ── Command #1 & #2: Redesigned toolbar injection (injects once, fixed top) ──
      const injectToolbar = async () => {
        if (!ajyalView || ajyalView.webContents.isDestroyed()) return;
        try {
          await ajyalView.webContents.executeJavaScript(
            `(function() {
              // Command #2: prevent duplicate injection
              if (document.getElementById('ajyal-toolbar')) return;

              // Command #1: Redesigned toolbar
              var toolbar = document.createElement('div');
              toolbar.id = 'ajyal-toolbar';
              toolbar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:56px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;display:flex;align-items:center;justify-content:space-between;padding:0 20px;z-index:999999;font-family:Segoe UI,Tahoma,Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.4);direction:rtl;';

              // Left side: title + status
              var leftDiv = document.createElement('div');
              leftDiv.style.cssText = 'display:flex;align-items:center;gap:14px;';
              leftDiv.innerHTML = '<span style="font-weight:bold;font-size:15px;letter-spacing:0.5px;">🏫 الإدارة المدرسية</span>'
                + '<span style="width:1px;height:24px;background:rgba(255,255,255,0.3);"></span>'
                + '<div id="toolbar-status-area" style="display:flex;align-items:center;gap:8px;">'
                + '<span id="toolbar-spinner" style="display:none;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top:2px solid white;border-radius:50%;animation:ajyal-spin 0.8s linear infinite;"></span>'
                + '<span id="toolbar-status" style="font-size:13px;opacity:0.9;">متصل بأجيال ✓</span>'
                + '</div>';

              // Right side: buttons
              var rightDiv = document.createElement('div');
              rightDiv.style.cssText = 'display:flex;gap:10px;';

              var btnStyle = 'color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;transition:all 0.2s ease;';

              rightDiv.innerHTML = '<button id="btn-import-students" style="background:#059669;' + btnStyle + '">📥 استيراد الطلاب</button>'
                + '<button id="btn-submit-absence" style="background:#d97706;' + btnStyle + '">📋 تعبئة الغياب</button>'
                + '<button id="btn-close-ajyal" style="background:#dc2626;' + btnStyle + '">← رجوع</button>';

              toolbar.appendChild(leftDiv);
              toolbar.appendChild(rightDiv);

              // Push page content down
              document.body.style.paddingTop = '56px';
              document.body.insertBefore(toolbar, document.body.firstChild);

              // Spinner animation
              var styleEl = document.createElement('style');
              styleEl.textContent = '@keyframes ajyal-spin { to { transform: rotate(360deg); } }'
                + ' #ajyal-toolbar button:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }'
                + ' #ajyal-toolbar button:active:not(:disabled) { filter: brightness(0.9); transform: translateY(0); }'
                + ' #ajyal-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }';
              document.head.appendChild(styleEl);

              // Grade selection panel
              var gradePanel = document.createElement('div');
              gradePanel.id = 'grade-selection-panel';
              gradePanel.style.cssText = 'display:none;position:fixed;top:56px;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);color:white;padding:20px;z-index:999998;direction:rtl;font-family:Segoe UI,Tahoma,Arial,sans-serif;overflow-y:auto;';
              document.body.appendChild(gradePanel);
            })();`
          );
        } catch (e) {
          console.error('Toolbar injection failed:', e.message);
        }
      };

      const autoFillCredentials = async () => {
        if (!ajyalView || ajyalView.webContents.isDestroyed()) return;
        const currentURL = ajyalView.webContents.getURL();
        if (loginMethod === 'credentials' && (currentURL.includes('/login') || currentURL.includes('ajyal.moe.gov.jo'))) {
          try {
            await ajyalView.webContents.executeJavaScript(
              '(function() {' +
              'var selectors = ["input[name=\\"username\\"]","input[name=\\"email\\"]","input[name=\\"user\\"]","input[id=\\"username\\"]","input[id=\\"email\\"]","input[type=\\"text\\"]"];' +
              'var passSelectors = ["input[name=\\"password\\"]","input[id=\\"password\\"]","input[type=\\"password\\"]"];' +
              'var userInput = null;' +
              'for (var i = 0; i < selectors.length; i++) { userInput = document.querySelector(selectors[i]); if (userInput) break; }' +
              'var passInput = null;' +
              'for (var i = 0; i < passSelectors.length; i++) { passInput = document.querySelector(passSelectors[i]); if (passInput) break; }' +
              'if (userInput) { userInput.focus(); userInput.value = ' + JSON.stringify(username) + '; userInput.dispatchEvent(new Event("input", { bubbles: true })); userInput.dispatchEvent(new Event("change", { bubbles: true })); }' +
              'if (passInput) { passInput.focus(); passInput.value = ' + JSON.stringify(password) + '; passInput.dispatchEvent(new Event("input", { bubbles: true })); passInput.dispatchEvent(new Event("change", { bubbles: true })); }' +
              '})();'
            );
          } catch (e) {
            console.error('Auto-fill failed:', e.message);
          }
        }
      };

      ajyalView.webContents.on('did-finish-load', async () => {
        if (!ajyalView) return;
        await autoFillCredentials();
        await injectToolbar();
      });

      ajyalView.webContents.on('did-navigate-in-page', async () => {
        await injectToolbar();
      });

      ajyalView.webContents.on('dom-ready', async () => {
        setTimeout(async () => { await injectToolbar(); }, 1500);
      });

      await ajyalView.webContents.loadURL(ajyalUrl);
      await injectToolbar();

      startAjyalToolbarPolling();

      return { success: true, url: ajyalUrl };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ajyal-open-window', async (_event, username, password, loginMethod = 'credentials') => {
    return ipcMain.emit('ajyal-open-embedded', null, username, password, loginMethod) || 
           { success: true, message: 'Redirected to embedded mode' };
  });

  ipcMain.handle('ajyal-check-login', async () => {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) {
      return { loggedIn: false, error: 'View not open' };
    }
    try {
      const url = ajyalView.webContents.getURL();
      const isOnLogin = url.includes('/login') || url.includes('/auth') || url === 'https://ajyal.moe.gov.jo/' || url === 'https://ajyal.moe.gov.jo';
      let hasLoggedInUI = false;
      try {
        hasLoggedInUI = await ajyalView.webContents.executeJavaScript(`
          !!(document.querySelector('[class*="dashboard"]') || 
             document.querySelector('[class*="sidebar"]') || 
             document.querySelector('[class*="navbar"]') ||
             document.querySelector('[class*="logout"]') ||
             document.querySelector('a[href*="logout"]') ||
             document.body.innerText.includes('تسجيل خروج') ||
             document.body.innerText.includes('لوحة'))
        `);
      } catch {}
      return { loggedIn: hasLoggedInUI || !isOnLogin, url };
    } catch (err) {
      return { loggedIn: false, error: err.message };
    }
  });

  // Helper: execute JS
  async function ajyalExec(js) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) throw new Error('View not open');
    return ajyalView.webContents.executeJavaScript(js);
  }

  async function ajyalWait(ms = 2000) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Command #1: Update toolbar status with color states ──
  async function updateToolbarStatus(state, text) {
    try {
      const colors = { idle: '#a3e635', loading: '#facc15', success: '#4ade80', error: '#f87171' };
      const color = colors[state] || '#a3e635';
      const showSpinner = state === 'loading';
      const safeText = String(text).replace(/'/g, "\\'");
      await ajyalExec(
        '(function(){' +
        'var s = document.getElementById("toolbar-status"); if(s) { s.textContent = \'' + safeText + '\'; s.style.color = \'' + color + '\'; }' +
        'var sp = document.getElementById("toolbar-spinner"); if(sp) sp.style.display = ' + (showSpinner ? '"inline-block"' : '"none"') + ';' +
        '})()'
      );
    } catch {}
  }

  // ── Command #3: Show feedback on button (checkmark/error) ──
  async function showButtonFeedback(btnId, success, errorMsg) {
    try {
      const originalLabels = {
        'btn-import-students': '📥 استيراد الطلاب',
        'btn-submit-absence': '📋 تعبئة الغياب',
      };
      const label = success ? '✓ تم بنجاح' : '✗ فشل';
      const bg = success ? '#059669' : '#dc2626';
      await ajyalExec(
        '(function(){' +
        'var btn = document.getElementById("' + btnId + '");' +
        'if (!btn) return;' +
        'btn.textContent = "' + label + '";' +
        'btn.style.background = "' + bg + '";' +
        'setTimeout(function(){' +
        '  btn.textContent = "' + (originalLabels[btnId] || '') + '";' +
        '  btn.style.background = "";' +
        '  delete btn.dataset.running;' +
        '}, 3000);' +
        '})()'
      );
      if (!success && errorMsg) {
        await updateToolbarStatus('error', '✗ ' + errorMsg);
      }
    } catch {}
  }

  // Grade selection panel helpers
  async function hideGradePanel() {
    try {
      await ajyalExec('(function(){ var p = document.getElementById("grade-selection-panel"); if(p) p.style.display = "none"; })()');
    } catch {}
  }

  async function discoverAndShowGradePanel(mode) {
    const nav = AJYAL_NAV_MAP[mode === 'absence' ? 'absence' : 'import'];
    await updateToolbarStatus('loading', 'جاري اكتشاف الصفوف...');
    sendProgress('جاري اكتشاف الصفوف المتاحة...');

    // Navigate using the nav map
    for (const step of AJYAL_NAV_MAP.import.steps) {
      sendProgress(step.message);
      await ajyalExec(clickByTextJS(step.targets));
      await ajyalWait(step.wait);
    }

    const gradeOptions = await ajyalExec(getSelectOptionsJS(nav.gradeLabels));
    const validGrades = gradeOptions.filter(function(g) {
      return g.text && g.text !== '--' && !g.text.includes('اختر') && g.value !== '' && g.value !== '0';
    });

    if (validGrades.length === 0) {
      await updateToolbarStatus('error', '⚠️ لم يُعثر على صفوف');
      sendProgress('⚠️ لم يُعثر على أي صفوف في الصفحة');
      ajyalActionInProgress = false;
      await resetToolbarUi();
      return;
    }

    sendProgress('تم العثور على ' + validGrades.length + ' صف ✓');
    const actionLabel = mode === 'import' ? 'استيراد الطلاب' : 'تعبئة الغياب';
    const executeAction = mode === 'import' ? 'import-execute' : 'absence-execute';
    const gradesJson = JSON.stringify(validGrades);

    await ajyalExec(
      '(function(){' +
      'var panel = document.getElementById("grade-selection-panel");' +
      'if (!panel) return;' +
      'var grades = ' + gradesJson + ';' +
      'var actionLabel = ' + JSON.stringify(actionLabel) + ';' +
      'var executeAction = ' + JSON.stringify(executeAction) + ';' +
      'var html = "<div style=\\"display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;\\">"' +
      '+ "<h3 style=\\"margin:0;font-size:18px;font-weight:bold;\\">📋 اختر الصفوف لـ " + actionLabel + "</h3>"' +
      '+ "<button id=\\"btn-cancel-grade\\" style=\\"background:#dc2626;color:white;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;\\">✕ إلغاء</button>"' +
      '+ "</div>";' +
      'html += "<div style=\\"display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;\\">";' +
      'html += "<label style=\\"display:flex;align-items:center;gap:8px;background:#1e40af;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;\\">"' +
      '+ "<input type=\\"checkbox\\" id=\\"chk-all-grades\\" checked style=\\"width:18px;height:18px;\\"> الكل</label>";' +
      'for (var i = 0; i < grades.length; i++) {' +
      '  var g = grades[i];' +
      '  html += "<label style=\\"display:flex;align-items:center;gap:8px;background:#334155;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;\\">"' +
      '  + "<input type=\\"checkbox\\" class=\\"grade-chk\\" value=\\"" + g.value + "\\" data-text=\\"" + g.text + "\\" checked style=\\"width:18px;height:18px;\\"> " + g.text + "</label>";' +
      '}' +
      'html += "</div>";' +
      'html += "<button id=\\"btn-execute-grades\\" style=\\"background:#059669;color:white;border:none;padding:12px 32px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:bold;width:100%\\">🚀 تنفيذ " + actionLabel + "</button>";' +
      'panel.innerHTML = html;' +
      'panel.style.display = "block";' +
      'var allChk = document.getElementById("chk-all-grades");' +
      'var gradeChks = document.querySelectorAll(".grade-chk");' +
      'allChk.addEventListener("change", function() {' +
      '  for (var j = 0; j < gradeChks.length; j++) gradeChks[j].checked = allChk.checked;' +
      '});' +
      'for (var k = 0; k < gradeChks.length; k++) {' +
      '  gradeChks[k].addEventListener("change", function() {' +
      '    var allChecked = true;' +
      '    for (var m = 0; m < gradeChks.length; m++) { if (!gradeChks[m].checked) { allChecked = false; break; } }' +
      '    allChk.checked = allChecked;' +
      '  });' +
      '}' +
      'document.getElementById("btn-execute-grades").addEventListener("click", function() {' +
      '  var selected = [];' +
      '  for (var n = 0; n < gradeChks.length; n++) {' +
      '    if (gradeChks[n].checked) selected.push({ value: gradeChks[n].value, text: gradeChks[n].getAttribute("data-text") });' +
      '  }' +
      '  var toolbar = document.getElementById("ajyal-toolbar");' +
      '  if (toolbar) {' +
      '    toolbar.dataset.selectedGrades = JSON.stringify(selected);' +
      '    toolbar.dataset.action = executeAction;' +
      '  }' +
      '});' +
      'document.getElementById("btn-cancel-grade").addEventListener("click", function() {' +
      '  var toolbar = document.getElementById("ajyal-toolbar");' +
      '  if (toolbar) toolbar.dataset.action = "cancel-grade-select";' +
      '});' +
      '})()'
    );

    await updateToolbarStatus('idle', 'حدد الصفوف المطلوبة ثم اضغط تنفيذ');
  }

  // Helper: normalize Arabic text + visual highlight + tooltip popup
  const normalizeArabicJS = `
    function normalizeArabic(text) {
      return (text || '').replace(/[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED]/g, '').replace(/\\s+/g, ' ').trim();
    }
    function showActionTooltip(el, message) {
      if (!el || !message) return;
      try {
        // Remove any existing tooltips first
        var oldTips = document.querySelectorAll('.ajyal-action-tooltip');
        for (var i = 0; i < oldTips.length; i++) oldTips[i].remove();

        var rect = el.getBoundingClientRect();
        var tip = document.createElement('div');
        tip.className = 'ajyal-action-tooltip';
        tip.textContent = '👉 ' + message;
        tip.style.cssText = [
          'position:fixed',
          'z-index:2147483647',
          'background:linear-gradient(135deg,#f59e0b,#d97706)',
          'color:white',
          'padding:12px 20px',
          'border-radius:12px',
          'font-size:17px',
          'font-weight:bold',
          'font-family:"Cairo","Tajawal",Arial,sans-serif',
          'direction:rtl',
          'box-shadow:0 8px 28px rgba(245,158,11,0.7),0 0 0 3px white',
          'pointer-events:none',
          'white-space:nowrap',
          'max-width:420px',
          'overflow:hidden',
          'text-overflow:ellipsis',
          'animation:ajyalTipPop 0.4s ease-out',
          'transition:opacity 0.5s ease'
        ].join(';');

        // Inject animation style once
        if (!document.getElementById('ajyal-tip-style')) {
          var st = document.createElement('style');
          st.id = 'ajyal-tip-style';
          st.textContent = '@keyframes ajyalTipPop{0%{transform:scale(0.5) translateY(10px);opacity:0}60%{transform:scale(1.1) translateY(-2px);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}';
          document.head.appendChild(st);
        }

        document.body.appendChild(tip);
        // Position above the element, centered
        var tipRect = tip.getBoundingClientRect();
        var top = rect.top - tipRect.height - 12;
        var left = rect.left + (rect.width / 2) - (tipRect.width / 2);
        // If above is off-screen, place below
        if (top < 8) top = rect.bottom + 12;
        // Keep within viewport horizontally
        if (left < 8) left = 8;
        if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
        tip.style.top = top + 'px';
        tip.style.left = left + 'px';

        // Add a small arrow pointer
        var arrow = document.createElement('div');
        var pointDown = (top < rect.top);
        arrow.style.cssText = [
          'position:absolute',
          'left:50%',
          'transform:translateX(-50%)',
          (pointDown ? 'bottom:-6px' : 'top:-6px'),
          'width:0;height:0',
          'border-left:7px solid transparent',
          'border-right:7px solid transparent',
          (pointDown ? 'border-top:8px solid #d97706' : 'border-bottom:8px solid #f59e0b')
        ].join(';');
        tip.appendChild(arrow);

        setTimeout(function() {
          tip.style.opacity = '0';
          setTimeout(function() { try { tip.remove(); } catch(e) {} }, 500);
        }, 3500);
      } catch(e) {}
    }
    function highlightElement(el, message) {
      if (!el) return;
      var prev = el.style.cssText;
      el.style.outline = '4px solid #f59e0b';
      el.style.outlineOffset = '3px';
      el.style.boxShadow = '0 0 30px rgba(245,158,11,0.85), 0 0 0 3px rgba(255,255,255,0.95)';
      el.style.transition = 'all 0.4s ease';
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
      // Show action tooltip popup with message
      if (message) {
        setTimeout(function() { showActionTooltip(el, message); }, 250);
      }
      // Hold the highlight longer so the user can clearly see what got clicked
      setTimeout(function() {
        el.style.outline = '4px solid #22c55e';
        el.style.boxShadow = '0 0 30px rgba(34,197,94,0.85), 0 0 0 3px rgba(255,255,255,0.95)';
        setTimeout(function() {
          el.style.cssText = prev;
        }, 1800);
      }, 1200);
    }
  `;

  const clickByTextJS = (texts, tag = 'a, button, span, li, div, label, [role="menuitem"], [role="button"], .nav-link, .menu-item, .sidebar-link') => `
    (function() {
      ${normalizeArabicJS}
      const targets = ${JSON.stringify(texts)}.map(t => normalizeArabic(t));
      const originalTargets = ${JSON.stringify(texts)};
      const els = document.querySelectorAll('${tag}');
      for (const el of els) {
        const t = normalizeArabic(el.textContent);
        for (let ti = 0; ti < targets.length; ti++) {
          const target = targets[ti];
          if (t === target || t.includes(target)) {
            highlightElement(el, 'الضغط على: ' + originalTargets[ti]);
            el.click();
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return { clicked: true, text: t };
          }
        }
      }
      for (const el of els) {
        const t = normalizeArabic(el.textContent);
        for (let ti = 0; ti < targets.length; ti++) {
          const target = targets[ti];
          if (target.length >= 3 && t.includes(target.substring(0, Math.min(target.length, 6)))) {
            highlightElement(el, 'الضغط على: ' + originalTargets[ti]);
            el.click();
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return { clicked: true, text: t, partial: true };
          }
        }
      }
      const hrefPatterns = { 'الطلبة': ['/students', '/student'], 'إدارة الطلبة': ['/students', '/student'], 'الحضور والغياب': ['/attendance', '/absence'], 'تسجيل الغياب': ['/absence', '/record-absence'], 'بيانات الطلبة': ['/students/list', '/student-data'] };
      const links = document.querySelectorAll('a[href]');
      for (const target of originalTargets) {
        const patterns = hrefPatterns[target] || [];
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          for (const pattern of patterns) {
            if (href.includes(pattern)) { highlightElement(link, 'الانتقال إلى: ' + target); link.click(); return { clicked: true, text: link.textContent.trim(), href: true }; }
          }
        }
      }
      return { clicked: false };
    })()
  `;

  const selectOptionJS = (selectTexts, optionText) => `
    (function() {
      const selectors = ${JSON.stringify(selectTexts)};
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        const label = sel.closest('div, label, .form-group')?.textContent || '';
        for (const s of selectors) {
          if (label.includes(s) || sel.name?.includes(s) || sel.id?.includes(s)) {
            for (const opt of sel.options) {
              if (opt.text.includes('${optionText}') || opt.value.includes('${optionText}')) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return { selected: true, value: opt.value };
              }
            }
          }
        }
      }
      return { selected: false };
    })()
  `;

  const getSelectOptionsJS = (selectTexts) => `
    (function() {
      const selectors = ${JSON.stringify(selectTexts)};
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        const label = sel.closest('div, label, .form-group')?.textContent || '';
        for (const s of selectors) {
          if (label.includes(s) || sel.name?.includes(s) || sel.id?.includes(s)) {
            return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.text && o.value);
          }
        }
      }
      return [];
    })()
  `;

  const setSelectValueJS = (selectTexts, value) => `
    (function() {
      ${normalizeArabicJS}
      const selectors = ${JSON.stringify(selectTexts)};
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        const label = sel.closest('div, label, .form-group')?.textContent || '';
        for (const s of selectors) {
          if (label.includes(s) || sel.name?.includes(s) || sel.id?.includes(s)) {
            sel.value = '${value}';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            highlightElement(sel, 'تم تحديد: ' + (sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '${value}'));
            return { selected: true };
          }
        }
      }
      return { selected: false };
    })()
  `;

  const scrapeStudentsJS = `
    (function () {
      try {
        const text = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const tables = document.querySelectorAll('table');
        if (tables.length === 0) return { success: false, error: 'No table found' };
        let bestTable = null;
        let maxRows = 0;
        for (const tbl of tables) {
          const rc = tbl.querySelectorAll('tbody tr, tr').length;
          if (rc > maxRows) { maxRows = rc; bestTable = tbl; }
        }
        if (!bestTable) return { success: false, error: 'No table found' };
        const headerRow = bestTable.querySelector('thead tr') || bestTable.querySelector('tr');
        const headerCells = Array.from(headerRow.querySelectorAll('th, td')).map(c => text(c.textContent));
        let nameColIdx = -1, classColIdx = -1, phoneColIdx = -1;
        for (let i = 0; i < headerCells.length; i++) {
          const h = headerCells[i];
          if (/اسم الطالب|الاسم|اسم|Student Name|Name/i.test(h) && nameColIdx === -1) nameColIdx = i;
          if (/الصف|الفصل|المرحلة|Class|Grade/i.test(h) && classColIdx === -1) classColIdx = i;
          if (/الهاتف|الجوال|رقم.*ولي|Phone|Mobile/i.test(h) && phoneColIdx === -1) phoneColIdx = i;
        }
        const dataRows = Array.from(bestTable.querySelectorAll('tbody tr'));
        if (dataRows.length === 0) {
          const allRows = Array.from(bestTable.querySelectorAll('tr'));
          if (allRows.length > 1) dataRows.push(...allRows.slice(1));
        }
        if (nameColIdx === -1 && dataRows.length > 0) {
          const sampleCells = Array.from(dataRows[0].querySelectorAll('td')).map(c => text(c.textContent));
          for (let i = 0; i < sampleCells.length; i++) {
            if (/[\\u0600-\\u06FF]{2,}/.test(sampleCells[i]) && sampleCells[i].length >= 4 && !/\\d{5,}/.test(sampleCells[i])) {
              nameColIdx = i; break;
            }
          }
        }
        if (nameColIdx === -1) return { success: false, error: 'Could not identify name column' };
        const students = dataRows.map((row) => {
          const cells = Array.from(row.querySelectorAll('td')).map((cell) => text(cell.textContent));
          if (cells.length <= nameColIdx) return null;
          const name = cells[nameColIdx] || '';
          const className = classColIdx >= 0 && cells[classColIdx] ? cells[classColIdx] : '';
          const parentPhone = phoneColIdx >= 0 && cells[phoneColIdx] ? cells[phoneColIdx] : (cells.find(c => /(07|962)\\d{7,}/.test(c.replace(/[\\s-]/g, ''))) || '');
          if (!name || name.length < 4) return null;
          return { name, className, parentPhone, parentName: '' };
        }).filter(Boolean);
        return { success: students.length > 0, students, count: students.length, nameColIdx, classColIdx };
      } catch (error) {
        return { success: false, error: error.message };
      }
    })()
  `;

  // ── Read students from a downloaded Ajyal Excel file ──
  async function readStudentsFromXlsx(filePath) {
    try {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);
      const ws = wb.worksheets[0];
      if (!ws) return { success: false, error: 'الملف لا يحتوي على ورقة عمل' };

      // Find header row by searching for "اسم"
      let headerRowIdx = 1;
      let nameCol = -1, classCol = -1, sectionCol = -1, phoneCol = -1, parentCol = -1;
      for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
        const row = ws.getRow(r);
        let foundAny = false;
        row.eachCell((cell, col) => {
          const v = String(cell.value || '').replace(/\s+/g, ' ').trim();
          if (/اسم.*طالب|الاسم|^اسم$|Student\s*Name|Name/i.test(v) && nameCol === -1) { nameCol = col; foundAny = true; }
          if (/^الصف$|المرحلة|Grade|Class/i.test(v) && classCol === -1) { classCol = col; foundAny = true; }
          if (/الشعبة|القسم|Section/i.test(v) && sectionCol === -1) { sectionCol = col; foundAny = true; }
          if (/الهاتف|الجوال|الموبايل|رقم.*ولي|Phone|Mobile/i.test(v) && phoneCol === -1) { phoneCol = col; foundAny = true; }
          if (/ولي.*أمر|اسم.*ولي|Parent|Guardian/i.test(v) && parentCol === -1) { parentCol = col; foundAny = true; }
        });
        if (foundAny && nameCol !== -1) { headerRowIdx = r; break; }
      }
      if (nameCol === -1) return { success: false, error: 'لم يُعثر على عمود الاسم في الملف' };

      const students = [];
      for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const name = String(row.getCell(nameCol).value || '').replace(/\s+/g, ' ').trim();
        if (!name || name.length < 3) continue;
        const grade = classCol > 0 ? String(row.getCell(classCol).value || '').trim() : '';
        const section = sectionCol > 0 ? String(row.getCell(sectionCol).value || '').trim() : '';
        const className = (grade && section) ? (grade + ' ' + section) : (grade || section);
        const parentPhone = phoneCol > 0 ? String(row.getCell(phoneCol).value || '').trim() : '';
        const parentName = parentCol > 0 ? String(row.getCell(parentCol).value || '').trim() : '';
        students.push({ name, className, parentPhone, parentName });
      }
      return { success: students.length > 0, students, count: students.length };
    } catch (err) {
      return { success: false, error: 'فشل قراءة ملف Excel: ' + err.message };
    }
  }

  // ── Import students: navigate → click Export → wait for download → parse ──
  async function runImportStudents(mainWindow, selectedGrades) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) {
      return { success: false, error: 'View not open' };
    }
    try {
      const nav = AJYAL_NAV_MAP.import;
      ajyalLastDownloadPath = null;
      await ajyalExec(`(function(){ var btn = document.getElementById('btn-import-students'); if(btn){ btn.textContent = '⏳ جاري الاستيراد...'; btn.dataset.running = 'true'; } })()`);
      await updateToolbarStatus('loading', 'جاري التنقل إلى قائمة الطلبة...');

      // Step 1-2: Navigate (شؤون الطلبة → الطلبة) with visible delays
      for (const step of nav.steps) {
        sendProgress(step.message);
        await updateToolbarStatus('loading', step.message);
        await ajyalExec(clickByTextJS(step.targets));
        await ajyalWait(step.wait);
      }
      sendProgress('✓ وصلت لصفحة الطلبة');
      await ajyalWait(1500);

      // Step 3: Click Export button to trigger Excel download
      sendProgress(nav.exportStep.message);
      await updateToolbarStatus('loading', nav.exportStep.message);
      const exportClick = await ajyalExec(clickByTextJS(nav.exportStep.targets));
      if (!exportClick || !exportClick.clicked) {
        sendProgress('⚠️ لم يُعثر على زر التصدير - جاري المحاولة عبر طريقة بديلة (قراءة الجدول مباشرة)...');
        // Fallback: try old scraping flow
        await ajyalExec(clickByTextJS(nav.searchButtons, nav.searchTag));
        await ajyalWait(nav.tableWait);
        const result = await ajyalExec(scrapeStudentsJS);
        if (result && result.success && result.students && result.students.length > 0) {
          await updateToolbarStatus('success', '✅ تم استيراد ' + result.students.length + ' طالب');
          await showButtonFeedback('btn-import-students', true);
          return { success: true, students: result.students, count: result.students.length, report: { processed: [{ className: 'الصفحة الحالية', count: result.students.length }], failed: [], totalImported: result.students.length, totalDuplicates: 0 } };
        }
        await showButtonFeedback('btn-import-students', false, 'لم يُعثر على زر التصدير');
        return { success: false, error: 'لم يُعثر على زر التصدير في صفحة الطلبة. تأكد من فتح الصفحة الصحيحة.' };
      }

      // Wait for download to complete (poll up to 20s)
      sendProgress('⏳ بانتظار اكتمال تنزيل ملف Excel...');
      await updateToolbarStatus('loading', '⏳ بانتظار تنزيل ملف Excel...');
      const startedAt = Date.now();
      while (!ajyalLastDownloadPath && (Date.now() - startedAt) < 20000) {
        await ajyalWait(500);
      }
      if (!ajyalLastDownloadPath) {
        await showButtonFeedback('btn-import-students', false, 'لم يكتمل التنزيل خلال 20 ثانية');
        return { success: false, error: 'لم يتم تنزيل ملف Excel من أجيال خلال المهلة المحددة (20 ثانية).' };
      }
      sendProgress('✓ اكتمل التنزيل، جاري قراءة الملف...');
      await updateToolbarStatus('loading', 'جاري قراءة ملف Excel...');

      const parsed = await readStudentsFromXlsx(ajyalLastDownloadPath);
      // Cleanup downloaded file
      try { fs.unlinkSync(ajyalLastDownloadPath); } catch {}
      const downloadedFile = ajyalLastDownloadPath;
      ajyalLastDownloadPath = null;

      if (!parsed.success) {
        await showButtonFeedback('btn-import-students', false, parsed.error);
        return { success: false, error: parsed.error, downloadedFile };
      }

      // Filter by selected grades (if any)
      let students = parsed.students;
      if (selectedGrades && selectedGrades.length > 0) {
        students = students.filter(s => selectedGrades.some(sg => (s.className || '').includes(sg.text) || sg.text.includes(s.className || '')));
      }

      // Deduplicate
      const seen = new Set();
      const beforeDedup = students.length;
      students = students.filter(s => { const k = s.name + '||' + s.className; if (seen.has(k)) return false; seen.add(k); return true; });

      // Build report grouped by className
      const groups = {};
      for (const s of students) { const c = s.className || 'بدون صف'; groups[c] = (groups[c] || 0) + 1; }
      const report = {
        processed: Object.entries(groups).map(([className, count]) => ({ className, count })),
        failed: [],
        totalImported: students.length,
        totalDuplicates: beforeDedup - students.length,
      };

      const successMsg = '✅ تم استيراد ' + students.length + ' طالب من ملف Excel بنجاح';
      await updateToolbarStatus('success', successMsg);
      sendProgress(successMsg);
      await showButtonFeedback('btn-import-students', students.length > 0);

      return { success: students.length > 0, students, count: students.length, report };
    } catch (err) {
      await showButtonFeedback('btn-import-students', false, err.message);
      return { success: false, error: err.message };
    }
  }


  // ── Submit absence with progress & report ──
  async function runSubmitAbsence(mainWindow, absenceData, selectedGrades) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) {
      return { success: false, error: 'View not open' };
    }
    try {
      let records = absenceData || null;

      if (!records || records.length === 0) {
        records = await mainWindow.webContents.executeJavaScript(
          '(function() {' +
          'try {' +
          'var keys = Object.keys(localStorage);' +
          'var absKey = keys.find(function(k) { return k.startsWith("student_absence_data_"); });' +
          'if (!absKey) return [];' +
          'var allRecords = JSON.parse(localStorage.getItem(absKey) || "[]");' +
          'var today = new Date();' +
          'var yyyy = today.getFullYear();' +
          'var mm = String(today.getMonth() + 1).padStart(2, "0");' +
          'var dd = String(today.getDate()).padStart(2, "0");' +
          'var todayStr = yyyy + "/" + mm + "/" + dd;' +
          'return allRecords.filter(function(r) { return r.date === todayStr; });' +
          '} catch(e) { return []; }' +
          '})()'
        );
      }

      if (!records || records.length === 0) {
        await updateToolbarStatus('error', '⚠️ لا يوجد غياب مسجل لهذا اليوم');
        sendProgress('⚠️ لا يوجد غياب مسجل لهذا اليوم');
        return { success: false, error: 'لا يوجد غياب مسجل لهذا اليوم. سجّل الغياب أولاً من الرصد اليومي.' };
      }

      const nav = AJYAL_NAV_MAP.absence;
      await ajyalExec(`(function(){ var btn = document.getElementById('btn-submit-absence'); if(btn){ btn.textContent = '⏳ جاري التعبئة...'; btn.dataset.running = 'true'; } })()`);
      await updateToolbarStatus('loading', 'جاري التنقل إلى صفحة تسجيل الغياب...');

      // Navigate using nav map
      for (const step of nav.steps) {
        sendProgress(step.message);
        await ajyalExec(clickByTextJS(step.targets));
        await ajyalWait(step.wait);
      }
      sendProgress('تم فتح صفحة تسجيل الغياب ✓');

      // Group by class
      const byClass = {};
      for (const r of records) {
        const key = r.className || 'unknown';
        if (!byClass[key]) byClass[key] = [];
        byClass[key].push(r);
      }

      let totalMarked = 0;
      const classKeys = Object.keys(byClass);
      const report = { processed: [], notFound: [], confirmedNoAbsence: [], totalMarked: 0 };

      // Build full work list: classes WITH absences + selected classes WITHOUT absences (for "تأكيد عدم وجود غياب")
      const workList = []; // { cls, hasAbsences }
      const matchedSelectedTexts = new Set();
      const filteredClassKeys = (selectedGrades && selectedGrades.length > 0)
        ? classKeys.filter(function(cls) {
            return selectedGrades.some(function(sg) {
              const m = cls.includes(sg.text) || sg.text.includes(cls);
              if (m) matchedSelectedTexts.add(sg.text);
              return m;
            });
          })
        : classKeys;
      for (const c of filteredClassKeys) workList.push({ cls: c, hasAbsences: true });
      if (selectedGrades && selectedGrades.length > 0) {
        for (const sg of selectedGrades) {
          if (!matchedSelectedTexts.has(sg.text)) workList.push({ cls: sg.text, hasAbsences: false });
        }
      }

      function parseClassName(cls) {
        const sectionMatch = cls.match(/([أبجدهو])\s*$/);
        let section = '';
        let grade = cls;
        if (sectionMatch) {
          section = sectionMatch[1];
          grade = cls.substring(0, cls.lastIndexOf(section)).trim();
        }
        if (!sectionMatch) {
          const inlineMatch = cls.match(/(\d+|[\u0600-\u06FF]+)\s*([أبجدهو])$/);
          if (inlineMatch) {
            section = inlineMatch[2];
            grade = inlineMatch[1].trim();
          }
        }
        if (!grade) grade = cls;
        return { grade, section };
      }

      for (let ci = 0; ci < workList.length; ci++) {
        const item = workList[ci];
        const cls = item.cls;
        const classRecords = byClass[cls] || [];
        const noAbsenceMode = !item.hasAbsences;

        const statusMsg = (noAbsenceMode ? '🟦 لا يوجد غياب في: ' : '📝 جاري تعبئة غياب: ') + cls + ' (' + (ci + 1) + '/' + workList.length + ')';
        await updateToolbarStatus('loading', statusMsg);
        sendProgress(statusMsg);

        const parsed = parseClassName(cls);
        const grade = parsed.grade;
        const section = parsed.section;

        // Set date
        const today = new Date();
        const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        await ajyalExec('(function() { var dateInputs = document.querySelectorAll("input[type=\\"date\\"]"); for (var i = 0; i < dateInputs.length; i++) { dateInputs[i].value = "' + dateStr + '"; dateInputs[i].dispatchEvent(new Event("change", { bubbles: true })); } })()');

        if (grade) {
          sendProgress('جاري اختيار الصف: ' + grade + '...');
          const gradeSelectResult = await ajyalExec(
            '(function() {' +
            'var grade = ' + JSON.stringify(grade) + ';' +
            'var selects = document.querySelectorAll("select");' +
            'for (var i = 0; i < selects.length; i++) {' +
            '  var sel = selects[i];' +
            '  var label = (sel.closest("div, label, .form-group") || {}).textContent || "";' +
            '  if (label.indexOf("الصف") !== -1 || label.indexOf("المرحلة") !== -1 || sel.name && sel.name.indexOf("grade") !== -1 || sel.name && sel.name.indexOf("class") !== -1) {' +
            '    for (var j = 0; j < sel.options.length; j++) {' +
            '      var opt = sel.options[j];' +
            '      if (opt.text.trim() === grade || opt.text.includes(grade) || grade.includes(opt.text.trim())) {' +
            '        sel.value = opt.value; sel.dispatchEvent(new Event("change", { bubbles: true })); return { selected: true };' +
            '      }' +
            '    }' +
            '  }' +
            '}' +
            'return { selected: false };' +
            '})()'
          );
          await ajyalWait(500);
        }
        if (section) {
          sendProgress('جاري اختيار الشعبة: ' + section + '...');
          await ajyalExec(setSelectValueJS(nav.sectionLabels, section));
          await ajyalWait(500);
        }

        sendProgress('جاري الضغط على عرض الطلبة...');
        await ajyalExec(clickByTextJS(nav.searchButtons, nav.searchTag));
        await ajyalWait(nav.tableWait);

        // If this class has no absences, click "تأكيد عدم وجود غياب" and move on
        if (noAbsenceMode) {
          sendProgress('🟦 الضغط على "تأكيد عدم وجود غياب" للصف: ' + cls);
          const confirmRes = await ajyalExec(clickByTextJS(nav.confirmNoAbsence));
          await ajyalWait(2000);
          if (confirmRes && confirmRes.clicked) {
            report.confirmedNoAbsence.push({ className: cls });
            sendProgress('✓ تم تأكيد عدم وجود غياب في: ' + cls);
          } else {
            sendProgress('⚠️ لم يُعثر على زر "تأكيد عدم وجود غياب" في: ' + cls);
          }
          continue;
        }

        let classMarked = 0;
        let classNotFound = [];
        for (const record of classRecords) {
          try {
            const studentNameJson = JSON.stringify(record.studentName);
            const classNameJson = JSON.stringify(record.className || '');
            const marked = await ajyalExec(
              '(function() {' +
              'var studentName = ' + studentNameJson + ';' +
              'var expectedClass = ' + classNameJson + ';' +
              'var rows = document.querySelectorAll("table tr, table tbody tr");' +
              'var matchedRows = [];' +
              'for (var i = 0; i < rows.length; i++) {' +
              '  var row = rows[i];' +
              '  var cells = Array.from(row.querySelectorAll("td"));' +
              '  var rowText = cells.map(function(c) { return c.textContent.trim(); }).join(" ");' +
              '  if (rowText.indexOf(studentName) !== -1) { matchedRows.push(row); }' +
              '}' +
              'var targetRow = matchedRows[0];' +
              'if (matchedRows.length > 1 && expectedClass) {' +
              '  for (var m = 0; m < matchedRows.length; m++) {' +
              '    if (matchedRows[m].textContent.indexOf(expectedClass) !== -1) { targetRow = matchedRows[m]; break; }' +
              '  }' +
              '}' +
               'if (!targetRow) return false;' +
               'targetRow.style.outline = "3px solid #f59e0b";' +
               'targetRow.style.outlineOffset = "2px";' +
               'targetRow.style.boxShadow = "0 0 15px rgba(245,158,11,0.4)";' +
               'targetRow.scrollIntoView({ behavior: "smooth", block: "center" });' +
               'setTimeout(function(){ targetRow.style.outline=""; targetRow.style.boxShadow=""; targetRow.style.outlineOffset=""; }, 2000);' +
               'var cb = targetRow.querySelector("input[type=\\"checkbox\\"]");' +
               'if (cb && !cb.checked) { cb.click(); }' +
              // Look for absence type select and set "بدون عذر"
              'var cells = targetRow.querySelectorAll("td");' +
              'for (var j = 0; j < cells.length; j++) {' +
              '  var cell = cells[j];' +
              '  var sel = cell.querySelector("select");' +
              '  if (sel) {' +
              '    for (var k = 0; k < sel.options.length; k++) {' +
              '      var opt = sel.options[k];' +
              '      if (opt.text.indexOf("بدون عذر") !== -1 || opt.text.indexOf("غائب بدون عذر") !== -1 || opt.text.indexOf("غياب بدون عذر") !== -1) {' +
              '        sel.value = opt.value; sel.dispatchEvent(new Event("change", { bubbles: true })); return true;' +
              '      }' +
              '    }' +
              // Fallback: any absence option
              '    for (var k2 = 0; k2 < sel.options.length; k2++) {' +
              '      var opt2 = sel.options[k2];' +
              '      if (opt2.text.indexOf("غائب") !== -1 || opt2.text.indexOf("غ") !== -1 || opt2.value === "absent" || opt2.value === "A") {' +
              '        sel.value = opt2.value; sel.dispatchEvent(new Event("change", { bubbles: true })); return true;' +
              '      }' +
              '    }' +
              '  }' +
              '}' +
              'if (cb && cb.checked) return true;' +
              'return false;' +
              '})()'
            );
            if (marked) {
              classMarked++;
              totalMarked++;
              sendProgress('✓ تم تسجيل غياب: ' + record.studentName + ' (' + totalMarked + ' إجمالي)');
              await ajyalWait(600); // Wait so user can see each student being marked
            } else {
              classNotFound.push(record.studentName);
              sendProgress('⚠️ لم يُعثر على: ' + record.studentName);
            }
          } catch {}
        }
        report.processed.push({ className: cls, marked: classMarked, total: classRecords.length });
        if (classNotFound.length > 0) {
          report.notFound.push({ className: cls, students: classNotFound });
        }
      }

      // Confirmation step: navigate back and confirm absence completion
      if (totalMarked > 0 && nav.confirmSteps) {
        sendProgress('جاري تأكيد الانتهاء من الغياب...');
        await updateToolbarStatus('loading', 'جاري تأكيد الانتهاء من الغياب...');
        for (const step of nav.confirmSteps) {
          sendProgress(step.message);
          await ajyalExec(clickByTextJS(step.targets));
          await ajyalWait(step.wait);
        }
        sendProgress('تم تأكيد الانتهاء من الغياب ✓');
      }

      report.totalMarked = totalMarked;
      const successMsg = '✅ تم تعبئة ' + totalMarked + ' غياب وتأكيد الانتهاء';
      await updateToolbarStatus('success', successMsg);
      sendProgress(successMsg);
      await showButtonFeedback('btn-submit-absence', totalMarked > 0);

      return { success: true, marked: totalMarked, total: records.length, report };
    } catch (err) {
      await showButtonFeedback('btn-submit-absence', false, err.message);
      return { success: false, error: err.message };
    }
  }

  ipcMain.handle('ajyal-import-students', async () => {
    return runImportStudents(mainWindow, null);
  });

  ipcMain.handle('ajyal-submit-absence', async (_event, data) => {
    return runSubmitAbsence(mainWindow, data);
  });

  ipcMain.handle('ajyal-close-window', async () => {
    if (ajyalView && !ajyalView.webContents.isDestroyed()) {
      stopAjyalToolbarPolling();
      ajyalActionInProgress = false;
      mainWindow.removeBrowserView(ajyalView);
    }
    return { success: true };
  });

  ipcMain.handle('ajyal-is-open', () => {
    return { isOpen: !!ajyalView && !ajyalView.webContents.isDestroyed() };
  });
}
app.whenReady().then(() => {
  if (!isDev && !verifyIntegrity()) {
    dialog.showErrorBox('خطأ أمني', 'تم اكتشاف تعديل غير مصرح به على ملفات البرنامج.\nيرجى إعادة تثبيت البرنامج من المصدر الرسمي.');
    app.quit();
    return;
  }

  if (!isDev) {
    globalShortcut.register('F12', () => {});
    globalShortcut.register('CommandOrControl+Shift+I', () => {});
    globalShortcut.register('CommandOrControl+Shift+J', () => {});
    globalShortcut.register('CommandOrControl+Shift+C', () => {});
    globalShortcut.register('CommandOrControl+U', () => {});
  }

  clearDesktopCacheOnVersionChange().finally(() => {
    const mainWindow = createWindow();
    setupLanHandlers();
    setupAjyalHandlers(mainWindow);

    if (!isDev) {
      setupAutoUpdater(mainWindow);
      setTimeout(() => checkForUpdatesSilent(), 5000);
    }

    ipcMain.handle('get-app-version', () => app.getVersion());
    ipcMain.on('check-for-updates', () => {
      if (isDev) { dialog.showMessageBox(mainWindow, { type: 'info', title: 'التحديث', message: 'التحديث التلقائي غير متوفر في وضع التطوير.', buttons: ['حسناً'] }); return; }
      checkForUpdates();
    });
    ipcMain.on('run-update-action', () => {
      if (isDev) { dialog.showMessageBox(mainWindow, { type: 'info', title: 'التحديث', message: 'التحديث التلقائي غير متوفر في وضع التطوير.', buttons: ['حسناً'] }); return; }
      runUpdateAction();
    });

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
});

app.on('window-all-closed', () => {
  // Cleanup LAN server on exit
  lanServer.stop().catch(() => {});
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  lanServer.stop().catch(() => {});
});
