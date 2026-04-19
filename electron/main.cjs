const { app, BrowserWindow, session, globalShortcut, dialog, ipcMain, BrowserView, shell } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { setupAutoUpdater, checkForUpdates, checkForUpdatesSilent, runUpdateAction } = require('./updater.cjs');
const { LanServer } = require('./lan-server.cjs');
const { LanClient } = require('./lan-client.cjs');

const isDev = !app.isPackaged;
const versionStatePath = path.join(app.getPath('userData'), 'app-version.json');

app.disableHardwareAcceleration();

const lanServer = new LanServer();
const lanClient = new LanClient();
let networkMode = 'standalone';

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
      await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
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
      type: 'error', title: 'خطأ في تحميل الواجهة',
      message: `تعذر تحميل واجهة البرنامج.\n${errorDescription} (${errorCode})`,
      buttons: ['إعادة المحاولة', 'إغلاق'], defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        if (isDev) mainWindow.loadURL('http://localhost:8080');
        else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      }
    });
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) console.error('Renderer console:', { level, message, line, sourceId });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process crashed:', details);
    dialog.showMessageBox(mainWindow, {
      type: 'error', title: 'تعطل الواجهة', message: 'حدث تعطل في واجهة البرنامج.',
      buttons: ['إعادة التحميل', 'إغلاق'], defaultId: 0,
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

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith('file://')) { callback({ responseHeaders: { ...details.responseHeaders } }); return; }
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
  ipcMain.handle('lan-start-server', async () => {
    try { const result = await lanServer.start(); networkMode = 'server'; return { success: true, ...result }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('lan-stop-server', async () => {
    await lanServer.stop(); networkMode = 'standalone'; return { success: true };
  });
  ipcMain.handle('lan-get-server-info', () => { return lanServer.getInfo(); });
  ipcMain.handle('lan-connect', async (_event, ip, port) => {
    try { const result = await lanClient.connect(ip, port || 9753); networkMode = 'client'; return { success: true, ...result }; }
    catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('lan-disconnect', () => {
    lanClient.disconnect(); networkMode = 'standalone'; return { success: true };
  });
  ipcMain.handle('lan-get-mode', () => { return { mode: networkMode }; });
  ipcMain.handle('open-external-url', async (_event, url) => {
    try {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { success: false, error: 'Invalid URL' };
      await shell.openExternal(url); return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('lan-get-data', async (_event, key) => {
    try {
      if (networkMode === 'server') return { success: true, data: lanServer.db.getData(key) };
      if (networkMode === 'client') { const data = await lanClient.getData(key); return { success: true, data }; }
      return { success: false, error: 'Not in network mode' };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('lan-set-data', async (_event, key, data) => {
    try {
      if (networkMode === 'server') { lanServer.db.setData(key, data); return { success: true }; }
      if (networkMode === 'client') { await lanClient.setData(key, data); return { success: true }; }
      return { success: false, error: 'Not in network mode' };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('lan-ping', async () => {
    try {
      if (networkMode === 'server') return { success: true, status: 'ok' };
      if (networkMode === 'client') { await lanClient.ping(); return { success: true, status: 'ok' }; }
      return { success: false, error: 'Not in network mode' };
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('lan-is-connected', () => {
    if (networkMode === 'server') return { connected: true, mode: 'server' };
    if (networkMode === 'client') return { connected: lanClient.isConnected(), mode: 'client' };
    return { connected: false, mode: 'standalone' };
  });
}

// ── Ajyal Integration ─────────────────────────────────────────────────────────
let ajyalView = null;
let mainWindowRef = null;
let ajyalToolbarPollInterval = null;
let ajyalActionInProgress = false;

// ── Try to load @nut-tree/nut-js for visible mouse movement ──
let nutMouse = null;
let nutPoint = null;
let nutStraightTo = null;
try {
  const nut = require('@nut-tree-fork/nut-js');
  nutMouse = nut.mouse;
  nutPoint = nut.Point;
  nutStraightTo = nut.straightTo;
  if (nutMouse && nutMouse.config) nutMouse.config.mouseSpeed = 500;
  console.log('✅ @nut-tree/nut-js loaded — visible mouse movement enabled');
} catch (e) {
  console.warn('⚠️ @nut-tree/nut-js not available — automation will run without visible mouse:', e.message);
}

// ── Navigation Map ──
const AJYAL_NAV_MAP = {
  import: {
    steps: [
      { action: 'click', targets: ['شؤون الطلبة', 'شئون الطلبة', 'إدارة الطلبة'], message: 'جاري فتح شؤون الطلبة...' },
      { action: 'click', targets: ['الطلبة', 'بيانات الطلبة', 'قائمة الطلبة'], message: 'جاري فتح قائمة الطلبة...' },
    ],
    exportButtons: ['تصدير', 'تصدير إلى Excel', 'تصدير Excel', 'Export', 'Export to Excel', 'تنزيل', 'Download'],
    importButtons: ['استيراد', 'استيراد من Excel', 'Import', 'Import from Excel', 'رفع', 'Upload'],
    confirmImport: ['موافق', 'تأكيد', 'استيراد', 'حفظ', 'OK', 'Save', 'Confirm'],
    gradeLabels: ['الصف', 'المرحلة', 'الفصل', 'grade', 'class', 'Grade'],
    sectionLabels: ['الشعبة', 'القسم', 'الفرع', 'section', 'Section'],
  },
  absence: {
    steps: [
      { action: 'click', targets: ['القوائم والخدمات', 'القوائم', 'الخدمات'], message: 'جاري فتح القوائم والخدمات...' },
      { action: 'click', targets: ['الانضباط المدرسي', 'الغياب', 'الحضور والغياب'], message: 'جاري الانتقال إلى الانضباط المدرسي...' },
      { action: 'click', targets: ['ادخال الانضباط المدرسي', 'إدخال الانضباط', 'تسجيل الغياب', 'رصد الغياب'], message: 'جاري فتح إدخال الانضباط المدرسي...' },
    ],
    confirmSteps: [
      { action: 'click', targets: ['الانضباط المدرسي', 'الغياب'], message: 'جاري العودة إلى الانضباط المدرسي...' },
      { action: 'click', targets: ['تأكيد الانتهاء من الغياب', 'تأكيد الانتهاء', 'تأكيد', 'حفظ'], message: 'جاري تأكيد الانتهاء من الغياب...' },
    ],
    absenceType: ['بدون عذر', 'غائب بدون عذر', 'غياب بدون عذر'],
    gradeLabels: ['الصف', 'المرحلة', 'الفصل', 'grade', 'class', 'Grade'],
    sectionLabels: ['الشعبة', 'القسم', 'الفرع', 'section', 'Section'],
    searchButtons: ['عرض الطلبة', 'عرض', 'بحث', 'Show', 'Search', 'إظهار'],
    searchTag: 'button, input[type="submit"], input[type="button"], a.btn, .btn, a',
  },
};

function setupAjyalHandlers(mainWindow) {
  mainWindowRef = mainWindow;

  // ── Send progress to renderer ──
  function sendProgress(msg) {
    try { mainWindow.webContents.send('ajyal-action', { type: 'progress', message: msg }); } catch {}
  }

  // ── Core exec helper ──
  async function ajyalExec(js) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) throw new Error('View not open');
    return ajyalView.webContents.executeJavaScript(js);
  }

  // ── Smart wait: waits until page URL changes OR timeout ──
  async function ajyalWaitForNavigation(maxMs = 8000) {
    const startUrl = ajyalView.webContents.getURL();
    const start = Date.now();
    let changed = false;
    while (Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, 300));
      try {
        const url = ajyalView.webContents.getURL();
        if (url !== startUrl) {
          sendProgress('🌐 انتقلت الصفحة إلى: ' + url.replace(/^https?:\/\/[^/]+/, ''));
          changed = true;
          break;
        }
      } catch { break; }
    }
    // Always give extra time for page to render and let the user see it
    await new Promise(r => setTimeout(r, 1500));
    return changed;
  }

  // ── Smart wait: waits until a table with rows appears ──
  async function ajyalWaitForTable(maxMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const count = await ajyalExec(`(function(){ return document.querySelectorAll('table tbody tr').length; })()`);
        if (count > 0) return true;
      } catch {}
    }
    return false;
  }

  // ── Simple fixed wait ──
  async function ajyalWait(ms = 1500) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Click with iframe fallback + verification ──
  async function ajyalSafeClick(targets) {
    const targetsJson = JSON.stringify(targets);
    const result = await ajyalExec(`
      (function() {
        function norm(s) { return (s||'').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g,'').replace(/\s+/g,' ').trim(); }
        function getLabel(el) {
          return norm(el.innerText || el.textContent || el.value || el.getAttribute('value') || el.getAttribute('title') || el.getAttribute('aria-label') || '');
        }
        function fireClick(el) {
          try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch {}
          // Visible highlight so the user can SEE which element gets clicked
          try {
            var prevOutline = el.style.outline;
            var prevBg = el.style.backgroundColor;
            var prevTrans = el.style.transition;
            el.style.transition = 'all 0.2s ease';
            el.style.outline = '4px solid #facc15';
            el.style.backgroundColor = 'rgba(250,204,21,0.35)';
            setTimeout(function(){
              try { el.style.outline = prevOutline; el.style.backgroundColor = prevBg; el.style.transition = prevTrans; } catch {}
            }, 700);
          } catch {}
          try { el.focus(); } catch {}
          try { el.click(); } catch {}
          try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch {}
          try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); } catch {}
          try { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch {}
        }
        function searchIn(doc, mode) {
          const tag = 'a, button, input[type="button"], input[type="submit"], span, li, div, label, [role="menuitem"], [role="button"], .nav-link, .menu-item, .sidebar-link';
          const els = doc.querySelectorAll(tag);
          for (const el of els) {
            const t = getLabel(el);
            if (!t) continue;
            for (const target of targets) {
              if (mode === 'exact' && t === target) { fireClick(el); return { clicked: true, text: t, method: mode }; }
              if (mode === 'includes' && t.includes(target)) { fireClick(el); return { clicked: true, text: t, method: mode }; }
              if (mode === 'partial' && target.length >= 3 && t.includes(target.substring(0, Math.min(target.length, 6)))) { fireClick(el); return { clicked: true, text: t, method: mode }; }
            }
          }
          return null;
        }
        const targets = ${targetsJson}.map(t => norm(t));
        const exact = searchIn(document, 'exact');
        if (exact) return exact;
        const includes = searchIn(document, 'includes');
        if (includes) return includes;
        const partial = searchIn(document, 'partial');
        if (partial) return partial;
        const frames = document.querySelectorAll('iframe');
        for (const frame of frames) {
          try {
            const doc = frame.contentDocument || frame.contentWindow?.document;
            if (!doc) continue;
            const result = searchIn(doc, 'includes') || searchIn(doc, 'exact') || searchIn(doc, 'partial');
            if (result) return { ...result, method: 'iframe-' + result.method };
          } catch {}
        }
        const hrefMap = {
          'الطلبة': ['/students','/student'],
          'إدارة الطلبة': ['/students','/student'],
          'الحضور والغياب': ['/attendance','/absence'],
          'تسجيل الغياب': ['/absence','/record-absence'],
          'بيانات الطلبة': ['/students/list','/student-data'],
          'الانضباط المدرسي': ['/discipline','/school-discipline'],
        };
        for (const target of ${targetsJson}) {
          const patterns = hrefMap[target] || [];
          for (const link of document.querySelectorAll('a[href]')) {
            const href = link.getAttribute('href') || '';
            for (const p of patterns) {
              if (href.includes(p)) { fireClick(link); return { clicked: true, text: getLabel(link), method: 'href' }; }
            }
          }
        }
        return { clicked: false };
      })()
    `);
    return result;
  }

  // ── Visible mouse click: moves cursor on screen then clicks ──
  async function ajyalVisibleClick(targets) {
    const targetsJson = JSON.stringify(targets);
    let rect = null;
    try {
      rect = await ajyalExec(`
        (function() {
          function norm(s) { return (s||'').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g,'').replace(/\s+/g,' ').trim(); }
          function getLabel(el) {
            return norm(el.innerText || el.textContent || el.value || el.getAttribute('value') || el.getAttribute('title') || el.getAttribute('aria-label') || '');
          }
          const targets = ${targetsJson}.map(t => norm(t));
          const tag = 'a, button, input[type="button"], input[type="submit"], span, li, div, label, [role="menuitem"], [role="button"], .nav-link, .menu-item, .sidebar-link';
          const els = document.querySelectorAll(tag);
          for (const el of els) {
            const t = getLabel(el);
            if (!t) continue;
            for (const target of targets) {
              if (t === target || t.includes(target) || (target.length >= 3 && t.includes(target.substring(0, Math.min(target.length, 6))))) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                  return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2), text: t };
                }
              }
            }
          }
          return null;
        })()
      `);
    } catch {}

    // If nut-js is available and we found the element, move the real mouse
    if (rect && nutMouse && nutPoint && nutStraightTo) {
      try {
        const viewBounds = ajyalView.getBounds();
        const winPos = mainWindow.getPosition();
        // +32 accounts for the window title bar height on Windows
        const screenX = winPos[0] + viewBounds.x + rect.x;
        const screenY = winPos[1] + viewBounds.y + rect.y + 32;
        await nutMouse.move(nutStraightTo(new nutPoint(screenX, screenY)));
        await new Promise(r => setTimeout(r, 350));
        await nutMouse.leftClick();
        sendProgress('🖱️ تم النقر على: ' + rect.text);
        return { clicked: true, text: rect.text };
      } catch (e) {
        console.warn('Mouse move failed, falling back to JS click:', e.message);
      }
    }

    // Fallback: JS click (silent but reliable)
    const result = await ajyalSafeClick(targets);
    if (result?.clicked) sendProgress('🖱️ تم النقر على: ' + (result.text || targets[0]));
    else sendProgress('❌ لم يتم العثور على الزر: ' + targets[0]);
    return result;
  }

  // ── Fixed setSelectValueJS using JSON.stringify (fixes Arabic text bug) ──
  const setSelectValueJS = (selectTexts, value) => `
    (function() {
      const selectors = ${JSON.stringify(selectTexts)};
      const targetValue = ${JSON.stringify(String(value))};
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        const label = (sel.closest('div, label, .form-group') || {}).textContent || '';
        for (const s of selectors) {
          if (label.includes(s) || (sel.name && sel.name.includes(s)) || (sel.id && sel.id.includes(s))) {
            for (const opt of sel.options) {
              if (opt.value === targetValue || opt.text.trim() === targetValue || opt.text.trim().includes(targetValue) || targetValue.includes(opt.text.trim())) {
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
        const label = (sel.closest('div, label, .form-group') || {}).textContent || '';
        for (const s of selectors) {
          if (label.includes(s) || (sel.name && sel.name.includes(s)) || (sel.id && sel.id.includes(s))) {
            return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.text && o.value);
          }
        }
      }
      return [];
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

  // ── Toolbar UI helpers ──
  async function updateToolbarStatus(state, text) {
    try {
      const colors = { idle: '#a3e635', loading: '#facc15', success: '#4ade80', error: '#f87171' };
      const color = colors[state] || '#a3e635';
      const showSpinner = state === 'loading';
      const safeText = JSON.stringify(String(text));
      await ajyalExec(
        `(function(){
          var s = document.getElementById('toolbar-status'); if(s) { s.textContent = ${safeText}; s.style.color = '${color}'; }
          var sp = document.getElementById('toolbar-spinner'); if(sp) sp.style.display = '${showSpinner ? 'inline-block' : 'none'}';
        })()`
      );
    } catch {}
  }

  async function showButtonFeedback(btnId, success, errorMsg) {
    try {
      const originalLabels = { 'btn-import-students': '📥 استيراد الطلاب', 'btn-submit-absence': '📋 تعبئة الغياب' };
      const label = success ? '✓ تم بنجاح' : '✗ فشل';
      const bg = success ? '#059669' : '#dc2626';
      const origLabel = JSON.stringify(originalLabels[btnId] || '');
      await ajyalExec(
        `(function(){
          var btn = document.getElementById('${btnId}');
          if (!btn) return;
          btn.textContent = '${label}';
          btn.style.background = '${bg}';
          setTimeout(function(){ btn.textContent = ${origLabel}; btn.style.background = ''; delete btn.dataset.running; }, 3000);
        })()`
      );
      if (!success && errorMsg) await updateToolbarStatus('error', '✗ ' + errorMsg);
    } catch {}
  }

  async function setToolbarButtonsDisabled(disabled) {
    try {
      await ajyalExec(
        `(function(){
          var toolbar = document.getElementById('ajyal-toolbar');
          if (toolbar) toolbar.dataset.busy = '${disabled ? 'true' : 'false'}';
          var btns = toolbar ? toolbar.querySelectorAll('button') : [];
          for (var i = 0; i < btns.length; i++) {
            btns[i].disabled = ${disabled ? 'true' : 'false'};
            btns[i].style.opacity = '${disabled ? '0.5' : '1'}';
            btns[i].style.cursor = '${disabled ? 'not-allowed' : 'pointer'}';
          }
        })()`
      );
    } catch {}
  }

  async function resetToolbarUi() {
    try {
      await ajyalExec(
        `(function(){
          var importBtn = document.getElementById('btn-import-students');
          var absenceBtn = document.getElementById('btn-submit-absence');
          var closeBtn = document.getElementById('btn-close-ajyal');
          if (importBtn) { importBtn.textContent = '📥 استيراد الطلاب'; delete importBtn.dataset.running; }
          if (absenceBtn) { absenceBtn.textContent = '📋 تعبئة الغياب'; delete absenceBtn.dataset.running; }
          if (closeBtn) { closeBtn.textContent = '← رجوع'; delete closeBtn.dataset.running; }
        })()`
      );
      await setToolbarButtonsDisabled(false);
      await updateToolbarStatus('idle', 'متصل بأجيال ✓');
    } catch {}
  }

  async function hideGradePanel() {
    try { await ajyalExec(`(function(){ var p = document.getElementById('grade-selection-panel'); if(p) p.style.display = 'none'; })()`); } catch {}
  }

  // ── Toolbar polling ──
  function stopAjyalToolbarPolling() {
    if (ajyalToolbarPollInterval) { clearInterval(ajyalToolbarPollInterval); ajyalToolbarPollInterval = null; }
  }

  function startAjyalToolbarPolling() {
    stopAjyalToolbarPolling();
    ajyalToolbarPollInterval = setInterval(async () => {
      if (!ajyalView || ajyalView.webContents.isDestroyed()) {
        stopAjyalToolbarPolling(); ajyalActionInProgress = false; return;
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
            if (action) { delete toolbar.dataset.action; return action; }
            return null;
          })();
        `);

        if (!action || ajyalActionInProgress) return;

        if (action === 'import-discover') {
          ajyalActionInProgress = true;
          await setToolbarButtonsDisabled(true);
          try { await discoverAndShowGradePanel('import'); }
          catch (e) { ajyalActionInProgress = false; await resetToolbarUi(); }
        } else if (action === 'absence-discover') {
          ajyalActionInProgress = true;
          await setToolbarButtonsDisabled(true);
          try { await discoverAndShowGradePanel('absence'); }
          catch (e) { ajyalActionInProgress = false; await resetToolbarUi(); }
        } else if (action === 'import-execute') {
          try {
            var selectedJson = await ajyalExec(`(function(){ var t = document.getElementById('ajyal-toolbar'); var v = t ? t.dataset.selectedGrades : ''; delete t.dataset.selectedGrades; return v || '[]'; })()`);
            var selectedGrades = JSON.parse(selectedJson);
            await hideGradePanel();
            mainWindow.webContents.send('ajyal-action', { type: 'import-started' });
            var result = await runImportStudents(mainWindow, selectedGrades);
            mainWindow.webContents.send('ajyal-action', { type: 'import-result', ...result });
          } catch (e) {
            mainWindow.webContents.send('ajyal-action', { type: 'import-result', success: false, error: e.message });
          } finally { ajyalActionInProgress = false; await resetToolbarUi(); }
        } else if (action === 'absence-execute') {
          try {
            var selectedJson2 = await ajyalExec(`(function(){ var t = document.getElementById('ajyal-toolbar'); var v = t ? t.dataset.selectedGrades : ''; delete t.dataset.selectedGrades; return v || '[]'; })()`);
            var selectedGrades2 = JSON.parse(selectedJson2);
            await hideGradePanel();
            mainWindow.webContents.send('ajyal-action', { type: 'absence-started' });
            var result2 = await runSubmitAbsence(mainWindow, null, selectedGrades2);
            mainWindow.webContents.send('ajyal-action', { type: 'absence-result', ...result2 });
          } catch (e) {
            mainWindow.webContents.send('ajyal-action', { type: 'absence-result', success: false, error: e.message });
          } finally { ajyalActionInProgress = false; await resetToolbarUi(); }
        } else if (action === 'cancel-grade-select') {
          await hideGradePanel(); ajyalActionInProgress = false; await resetToolbarUi();
        } else if (action === 'close') {
          ajyalActionInProgress = false; stopAjyalToolbarPolling();
          if (ajyalView && !ajyalView.webContents.isDestroyed()) mainWindow.removeBrowserView(ajyalView);
          mainWindow.webContents.send('ajyal-action', { type: 'closed' });
        }
      } catch {}
    }, 500);
  }

  // ── Grade discovery panel ──
  async function discoverAndShowGradePanel(mode) {
    const nav = AJYAL_NAV_MAP[mode === 'absence' ? 'absence' : 'import'];
    await updateToolbarStatus('loading', 'جاري اكتشاف الصفوف...');
    sendProgress('جاري اكتشاف الصفوف المتاحة...');

    for (const step of nav.steps) {
      sendProgress(step.message);
      const clickResult = await ajyalVisibleClick(step.targets);
      if (!clickResult?.clicked) throw new Error('تعذر العثور على: ' + step.targets[0]);
      await ajyalWaitForNavigation();
    }

    const gradeOptions = await ajyalExec(getSelectOptionsJS(nav.gradeLabels));
    const validGrades = gradeOptions.filter(g => g.text && g.text !== '--' && !g.text.includes('اختر') && g.value !== '' && g.value !== '0');

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
      `(function(){
        var panel = document.getElementById('grade-selection-panel');
        if (!panel) return;
        var grades = ${gradesJson};
        var actionLabel = ${JSON.stringify(actionLabel)};
        var executeAction = ${JSON.stringify(executeAction)};
        var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'
          + '<h3 style="margin:0;font-size:18px;font-weight:bold;">📋 اختر الصفوف لـ ' + actionLabel + '</h3>'
          + '<button id="btn-cancel-grade" style="background:#dc2626;color:white;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;">✕ إلغاء</button>'
          + '</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">';
        html += '<label style="display:flex;align-items:center;gap:8px;background:#1e40af;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;">'
          + '<input type="checkbox" id="chk-all-grades" checked style="width:18px;height:18px;"> الكل</label>';
        for (var i = 0; i < grades.length; i++) {
          var g = grades[i];
          html += '<label style="display:flex;align-items:center;gap:8px;background:#334155;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;">'
            + '<input type="checkbox" class="grade-chk" value="' + g.value + '" data-text="' + g.text + '" checked style="width:18px;height:18px;"> ' + g.text + '</label>';
        }
        html += '</div>';
        html += '<button id="btn-execute-grades" style="background:#059669;color:white;border:none;padding:12px 32px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:bold;width:100%">🚀 تنفيذ ' + actionLabel + '</button>';
        panel.innerHTML = html;
        panel.style.display = 'block';
        var allChk = document.getElementById('chk-all-grades');
        var gradeChks = document.querySelectorAll('.grade-chk');
        allChk.addEventListener('change', function() { for (var j = 0; j < gradeChks.length; j++) gradeChks[j].checked = allChk.checked; });
        for (var k = 0; k < gradeChks.length; k++) {
          gradeChks[k].addEventListener('change', function() {
            var allChecked = true;
            for (var m = 0; m < gradeChks.length; m++) { if (!gradeChks[m].checked) { allChecked = false; break; } }
            allChk.checked = allChecked;
          });
        }
        document.getElementById('btn-execute-grades').addEventListener('click', function() {
          var selected = [];
          for (var n = 0; n < gradeChks.length; n++) {
            if (gradeChks[n].checked) selected.push({ value: gradeChks[n].value, text: gradeChks[n].getAttribute('data-text') });
          }
          var toolbar = document.getElementById('ajyal-toolbar');
          if (toolbar) { toolbar.dataset.selectedGrades = JSON.stringify(selected); toolbar.dataset.action = executeAction; }
        });
        document.getElementById('btn-cancel-grade').addEventListener('click', function() {
          var toolbar = document.getElementById('ajyal-toolbar');
          if (toolbar) toolbar.dataset.action = 'cancel-grade-select';
        });
      })()`
    );
    await updateToolbarStatus('idle', 'حدد الصفوف المطلوبة ثم اضغط تنفيذ');
  }

  // ── TASK 1: Import students ──
  async function runImportStudents(mainWindow, selectedGrades) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) return { success: false, error: 'View not open' };
    try {
      const nav = AJYAL_NAV_MAP.import;
      await ajyalExec(`(function(){ var btn = document.getElementById('btn-import-students'); if(btn){ btn.textContent = '⏳ جاري الاستيراد...'; btn.dataset.running = 'true'; } })()`);
      await updateToolbarStatus('loading', 'جاري الانتقال: شؤون الطلبة ← الطلبة...');

      // Step 1: شؤون الطلبة → الطلبة
      for (const step of nav.steps) {
        sendProgress(step.message);
        const clickResult = await ajyalVisibleClick(step.targets);
        if (!clickResult?.clicked) throw new Error('تعذر العثور على: ' + step.targets[0]);
        await ajyalWaitForNavigation();
      }
      sendProgress('✓ تم فتح قائمة الطلبة');

      // Step 2: انتظار وتسجيل تنزيل ملف التصدير
      await updateToolbarStatus('loading', 'جاري تصدير ملف Excel من أجيال...');
      sendProgress('جاري الضغط على زر "تصدير"...');

      // Reset/track download
      let downloadedFilePath = null;
      const downloadPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('انتهت مهلة انتظار التنزيل (60 ثانية)')), 60000);
        const onWillDownload = (_e, item) => {
          try {
            const filename = item.getFilename();
            const savePath = path.join(app.getPath('downloads'), filename);
            item.setSavePath(savePath);
            item.once('done', (_evt, state) => {
              clearTimeout(timer);
              if (state === 'completed') { downloadedFilePath = savePath; resolve(savePath); }
              else reject(new Error('فشل التنزيل: ' + state));
            });
          } catch (err) { clearTimeout(timer); reject(err); }
        };
        ajyalView.webContents.session.once('will-download', onWillDownload);
      });

      const exportClick = await ajyalVisibleClick(nav.exportButtons);
      if (!exportClick?.clicked) throw new Error('تعذر العثور على زر "تصدير"');

      await downloadPromise;
      sendProgress('✓ تم تنزيل الملف: ' + path.basename(downloadedFilePath));

      // Step 3: الضغط على زر "استيراد" داخل أجيال
      await updateToolbarStatus('loading', 'جاري فتح نافذة الاستيراد في أجيال...');
      sendProgress('جاري الضغط على زر "استيراد"...');
      const importClick = await ajyalVisibleClick(nav.importButtons);
      if (!importClick?.clicked) throw new Error('تعذر العثور على زر "استيراد"');
      await ajyalWait(1500);

      // Step 4: حقن الملف في حقل input[type="file"]
      sendProgress('جاري رفع الملف المُصدَّر إلى أجيال...');
      const fileBuf = fs.readFileSync(downloadedFilePath);
      const base64 = fileBuf.toString('base64');
      const fileName = path.basename(downloadedFilePath);
      const mimeType = fileName.endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.ms-excel';

      const uploadResult = await ajyalExec(`
        (async function() {
          try {
            var inputs = document.querySelectorAll('input[type="file"]');
            if (!inputs || inputs.length === 0) return { ok: false, error: 'لا يوجد حقل رفع ملف' };
            var input = inputs[inputs.length - 1];
            var byteChars = atob(${JSON.stringify(base64)});
            var byteNums = new Array(byteChars.length);
            for (var i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
            var blob = new Blob([new Uint8Array(byteNums)], { type: ${JSON.stringify(mimeType)} });
            var file = new File([blob], ${JSON.stringify(fileName)}, { type: ${JSON.stringify(mimeType)} });
            var dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return { ok: true, name: file.name, size: file.size };
          } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
        })()
      `);

      if (!uploadResult || !uploadResult.ok) throw new Error('تعذر رفع الملف: ' + (uploadResult && uploadResult.error));
      sendProgress('✓ تم رفع الملف (' + uploadResult.name + ')');

      await ajyalWait(1500);

      // Step 5: تأكيد الاستيراد إن ظهر زر تأكيد/موافق
      sendProgress('جاري تأكيد الاستيراد...');
      const confirm = await ajyalVisibleClick(nav.confirmImport);
      if (confirm?.clicked) sendProgress('✓ تم تأكيد الاستيراد');
      else sendProgress('ℹ️ لم يظهر زر تأكيد — قد يكون الاستيراد بدأ تلقائياً');

      const successMsg = '✅ تمت عملية الاستيراد (تصدير + رفع نفس الملف)';
      await updateToolbarStatus('success', successMsg);
      sendProgress(successMsg);
      await showButtonFeedback('btn-import-students', true);

      return { success: true, file: downloadedFilePath, message: successMsg };
    } catch (err) {
      sendProgress('❌ خطأ: ' + err.message);
      await updateToolbarStatus('error', '✗ ' + err.message);
      await showButtonFeedback('btn-import-students', false, err.message);
      return { success: false, error: err.message };
    }
  }

  // ── TASK 2: Submit absence ──
  async function runSubmitAbsence(mainWindow, absenceData, selectedGrades) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) return { success: false, error: 'View not open' };
    try {
      let records = absenceData || null;

      if (!records || records.length === 0) {
        records = await mainWindow.webContents.executeJavaScript(
          `(function() {
            try {
              var keys = Object.keys(localStorage);
              var absKey = keys.find(function(k) { return k.startsWith('student_absence_data_'); });
              if (!absKey) return [];
              var allRecords = JSON.parse(localStorage.getItem(absKey) || '[]');
              var today = new Date();
              var yyyy = today.getFullYear();
              var mm = String(today.getMonth() + 1).padStart(2, '0');
              var dd = String(today.getDate()).padStart(2, '0');
              var todayStr = yyyy + '/' + mm + '/' + dd;
              return allRecords.filter(function(r) { return r.date === todayStr; });
            } catch(e) { return []; }
          })()`
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

      // Navigate with visible mouse
      for (const step of nav.steps) {
        sendProgress(step.message);
        const clickResult = await ajyalVisibleClick(step.targets);
        if (!clickResult?.clicked) sendProgress('⚠️ لم يتم العثور على: ' + step.targets[0]);
        await ajyalWaitForNavigation();
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
      const report = { processed: [], notFound: [], totalMarked: 0 };

      const filteredClassKeys = (selectedGrades && selectedGrades.length > 0)
        ? classKeys.filter(cls => selectedGrades.some(sg => cls.includes(sg.text) || sg.text.includes(cls)))
        : classKeys;

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
          if (inlineMatch) { section = inlineMatch[2]; grade = inlineMatch[1].trim(); }
        }
        if (!grade) grade = cls;
        return { grade, section };
      }

      for (let ci = 0; ci < filteredClassKeys.length; ci++) {
        const cls = filteredClassKeys[ci];
        const classRecords = byClass[cls];

        const statusMsg = 'جاري تعبئة غياب: ' + cls + ' (' + (ci + 1) + '/' + filteredClassKeys.length + ')';
        await updateToolbarStatus('loading', statusMsg);
        sendProgress(statusMsg);

        const parsed = parseClassName(cls);
        const grade = parsed.grade;
        const section = parsed.section;

        // Set date
        const today = new Date();
        const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        await ajyalExec(`(function() { var dateInputs = document.querySelectorAll('input[type="date"]'); for (var i = 0; i < dateInputs.length; i++) { dateInputs[i].value = '${dateStr}'; dateInputs[i].dispatchEvent(new Event('change', { bubbles: true })); } })()`);

        if (grade) {
          sendProgress('جاري اختيار الصف: ' + grade + '...');
          await ajyalExec(`
            (function() {
              var grade = ${JSON.stringify(grade)};
              var selects = document.querySelectorAll('select');
              for (var i = 0; i < selects.length; i++) {
                var sel = selects[i];
                var label = ((sel.closest('div, label, .form-group') || {}).textContent || '');
                if (label.indexOf('الصف') !== -1 || label.indexOf('المرحلة') !== -1 || (sel.name && sel.name.indexOf('grade') !== -1) || (sel.name && sel.name.indexOf('class') !== -1)) {
                  for (var j = 0; j < sel.options.length; j++) {
                    var opt = sel.options[j];
                    if (opt.text.trim() === grade || opt.text.includes(grade) || grade.includes(opt.text.trim())) {
                      sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return { selected: true };
                    }
                  }
                }
              }
              return { selected: false };
            })()`
          );
          await ajyalWait(600);
        }

        if (section) {
          sendProgress('جاري اختيار الشعبة: ' + section + '...');
          await ajyalExec(setSelectValueJS(nav.sectionLabels, section));
          await ajyalWait(400);
        }

        sendProgress('جاري الضغط على عرض الطلبة...');
        await ajyalVisibleClick(nav.searchButtons);
        await ajyalWaitForTable();

        let classMarked = 0;
        let classNotFound = [];

        for (const record of classRecords) {
          try {
            const studentNameJson = JSON.stringify(record.studentName);
            const classNameJson = JSON.stringify(record.className || '');

            const marked = await ajyalExec(`
              (function() {
                var studentName = ${studentNameJson};
                var expectedClass = ${classNameJson};
                var rows = document.querySelectorAll('table tr, table tbody tr');
                var matchedRows = [];
                for (var i = 0; i < rows.length; i++) {
                  var row = rows[i];
                  var cells = Array.from(row.querySelectorAll('td'));
                  var rowText = cells.map(function(c) { return c.textContent.trim(); }).join(' ');
                  if (rowText.indexOf(studentName) !== -1) matchedRows.push(row);
                }
                var targetRow = matchedRows[0];
                if (matchedRows.length > 1 && expectedClass) {
                  for (var m = 0; m < matchedRows.length; m++) {
                    if (matchedRows[m].textContent.indexOf(expectedClass) !== -1) { targetRow = matchedRows[m]; break; }
                  }
                }
                if (!targetRow) return false;
                var cb = targetRow.querySelector('input[type="checkbox"]');
                if (cb && !cb.checked) cb.click();
                var tdCells = targetRow.querySelectorAll('td');
                for (var j = 0; j < tdCells.length; j++) {
                  var sel = tdCells[j].querySelector('select');
                  if (sel) {
                    for (var k = 0; k < sel.options.length; k++) {
                      var opt = sel.options[k];
                      if (opt.text.indexOf('بدون عذر') !== -1 || opt.text.indexOf('غائب بدون عذر') !== -1 || opt.text.indexOf('غياب بدون عذر') !== -1) {
                        sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true;
                      }
                    }
                    for (var k2 = 0; k2 < sel.options.length; k2++) {
                      var opt2 = sel.options[k2];
                      if (opt2.text.indexOf('غائب') !== -1 || opt2.text.indexOf('غ') !== -1 || opt2.value === 'absent' || opt2.value === 'A') {
                        sel.value = opt2.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true;
                      }
                    }
                  }
                }
                if (cb && cb.checked) return true;
                return false;
              })()`
            );

            // Verify the mark was applied
            const verified = marked && await ajyalExec(`
              (function() {
                var name = ${studentNameJson};
                var rows = document.querySelectorAll('table tr');
                for (var i = 0; i < rows.length; i++) {
                  var row = rows[i];
                  if (row.textContent.indexOf(name) !== -1) {
                    var cb = row.querySelector('input[type="checkbox"]');
                    var sel = row.querySelector('select');
                    if (cb && cb.checked) return true;
                    if (sel && sel.value && sel.value !== '' && sel.value !== '0') return true;
                  }
                }
                return false;
              })()`
            );

            if (verified) {
              classMarked++;
              totalMarked++;
              sendProgress('✅ تم تسجيل غياب: ' + record.studentName);
            } else {
              classNotFound.push(record.studentName);
              sendProgress('⚠️ لم يُعثر على أو لم يُؤكد: ' + record.studentName);
            }
          } catch {}
        }

        report.processed.push({ className: cls, marked: classMarked, total: classRecords.length });
        if (classNotFound.length > 0) report.notFound.push({ className: cls, students: classNotFound });

        // Save after each class before moving to next
        if (classMarked > 0) {
          sendProgress('جاري حفظ غياب الصف: ' + cls + '...');
          await ajyalVisibleClick(['حفظ', 'Save', 'تأكيد', 'Confirm', 'موافق', 'OK']);
          await ajyalWait(1200);
          sendProgress('✅ تم حفظ غياب: ' + cls);
        }
      }

      // Final confirmation steps
      if (totalMarked > 0 && nav.confirmSteps) {
        sendProgress('جاري تأكيد الانتهاء من الغياب...');
        await updateToolbarStatus('loading', 'جاري تأكيد الانتهاء من الغياب...');
        for (const step of nav.confirmSteps) {
          sendProgress(step.message);
          await ajyalVisibleClick(step.targets);
          await ajyalWait(1500);
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

  // ── Open Ajyal embedded ──
  ipcMain.handle('ajyal-open-embedded', async (_event, username, password, loginMethod = 'credentials') => {
    try {
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
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, devTools: isDev },
      });

      mainWindow.addBrowserView(ajyalView);
      const bounds = mainWindow.getContentBounds();
      ajyalView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
      ajyalView.setAutoResize({ width: true, height: true });

      ajyalView.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) ajyalView.webContents.loadURL(url);
        return { action: 'deny' };
      });

      const injectToolbar = async () => {
        if (!ajyalView || ajyalView.webContents.isDestroyed()) return;
        try {
          await ajyalView.webContents.executeJavaScript(`
            (function() {
              if (document.getElementById('ajyal-toolbar')) return;
              var toolbar = document.createElement('div');
              toolbar.id = 'ajyal-toolbar';
              toolbar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:56px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;display:flex;align-items:center;justify-content:space-between;padding:0 20px;z-index:999999;font-family:Segoe UI,Tahoma,Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.4);direction:rtl;';
              var leftDiv = document.createElement('div');
              leftDiv.style.cssText = 'display:flex;align-items:center;gap:14px;';
              leftDiv.innerHTML = '<span style="font-weight:bold;font-size:15px;letter-spacing:0.5px;">🏫 الإدارة المدرسية</span>'
                + '<span style="width:1px;height:24px;background:rgba(255,255,255,0.3);"></span>'
                + '<div id="toolbar-status-area" style="display:flex;align-items:center;gap:8px;">'
                + '<span id="toolbar-spinner" style="display:none;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top:2px solid white;border-radius:50%;animation:ajyal-spin 0.8s linear infinite;"></span>'
                + '<span id="toolbar-status" style="font-size:13px;opacity:0.9;">متصل بأجيال ✓</span>'
                + '</div>';
              var rightDiv = document.createElement('div');
              rightDiv.style.cssText = 'display:flex;gap:10px;';
              var btnStyle = 'color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;transition:all 0.2s ease;';
              rightDiv.innerHTML = '<button id="btn-import-students" style="background:#059669;' + btnStyle + '">📥 استيراد الطلاب</button>'
                + '<button id="btn-submit-absence" style="background:#d97706;' + btnStyle + '">📋 تعبئة الغياب</button>'
                + '<button id="btn-close-ajyal" style="background:#dc2626;' + btnStyle + '">← رجوع</button>';
              toolbar.appendChild(leftDiv);
              toolbar.appendChild(rightDiv);
              document.body.style.paddingTop = '56px';
              document.body.insertBefore(toolbar, document.body.firstChild);
              var styleEl = document.createElement('style');
              styleEl.textContent = '@keyframes ajyal-spin { to { transform: rotate(360deg); } }'
                + ' #ajyal-toolbar button:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }'
                + ' #ajyal-toolbar button:active:not(:disabled) { filter: brightness(0.9); transform: translateY(0); }'
                + ' #ajyal-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }';
              document.head.appendChild(styleEl);
              var gradePanel = document.createElement('div');
              gradePanel.id = 'grade-selection-panel';
              gradePanel.style.cssText = 'display:none;position:fixed;top:56px;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);color:white;padding:20px;z-index:999998;direction:rtl;font-family:Segoe UI,Tahoma,Arial,sans-serif;overflow-y:auto;';
              document.body.appendChild(gradePanel);
            })();
          `);
        } catch (e) { console.error('Toolbar injection failed:', e.message); }
      };

      const autoFillCredentials = async () => {
        if (!ajyalView || ajyalView.webContents.isDestroyed()) return;
        const currentURL = ajyalView.webContents.getURL();
        if (loginMethod === 'credentials' && (currentURL.includes('/login') || currentURL.includes('ajyal.moe.gov.jo'))) {
          try {
            await ajyalView.webContents.executeJavaScript(
              `(function() {
                var selectors = ['input[name="username"]','input[name="email"]','input[name="user"]','input[id="username"]','input[id="email"]','input[type="text"]'];
                var passSelectors = ['input[name="password"]','input[id="password"]','input[type="password"]'];
                var userInput = null;
                for (var i = 0; i < selectors.length; i++) { userInput = document.querySelector(selectors[i]); if (userInput) break; }
                var passInput = null;
                for (var i = 0; i < passSelectors.length; i++) { passInput = document.querySelector(passSelectors[i]); if (passInput) break; }
                if (userInput) { userInput.focus(); userInput.value = ${JSON.stringify(username)}; userInput.dispatchEvent(new Event('input', { bubbles: true })); userInput.dispatchEvent(new Event('change', { bubbles: true })); }
                if (passInput) { passInput.focus(); passInput.value = ${JSON.stringify(password)}; passInput.dispatchEvent(new Event('input', { bubbles: true })); passInput.dispatchEvent(new Event('change', { bubbles: true })); }
              })()`
            );
          } catch (e) { console.error('Auto-fill failed:', e.message); }
        }
      };

      ajyalView.webContents.on('did-finish-load', async () => { if (!ajyalView) return; await autoFillCredentials(); await injectToolbar(); });
      ajyalView.webContents.on('did-navigate-in-page', async () => { await injectToolbar(); });
      ajyalView.webContents.on('dom-ready', async () => { setTimeout(async () => { await injectToolbar(); }, 1500); });

      await ajyalView.webContents.loadURL(ajyalUrl);
      await injectToolbar();
      startAjyalToolbarPolling();

      return { success: true, url: ajyalUrl };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('ajyal-open-window', async (_event, username, password, loginMethod = 'credentials') => {
    return ipcMain.emit('ajyal-open-embedded', null, username, password, loginMethod) || { success: true };
  });

  ipcMain.handle('ajyal-check-login', async () => {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) return { loggedIn: false, error: 'View not open' };
    try {
      const url = ajyalView.webContents.getURL();
      const isOnLogin = url.includes('/login') || url.includes('/auth') || url === 'https://ajyal.moe.gov.jo/' || url === 'https://ajyal.moe.gov.jo';
      let hasLoggedInUI = false;
      try {
        hasLoggedInUI = await ajyalView.webContents.executeJavaScript(`
          !!(document.querySelector('[class*="dashboard"]') || document.querySelector('[class*="sidebar"]') || document.querySelector('[class*="navbar"]') || document.querySelector('[class*="logout"]') || document.querySelector('a[href*="logout"]') || document.body.innerText.includes('تسجيل خروج') || document.body.innerText.includes('لوحة'))
        `);
      } catch {}
      return { loggedIn: hasLoggedInUI || !isOnLogin, url };
    } catch (err) { return { loggedIn: false, error: err.message }; }
  });

  ipcMain.handle('ajyal-import-students', async () => { return runImportStudents(mainWindow, null); });
  ipcMain.handle('ajyal-submit-absence', async (_event, data) => { return runSubmitAbsence(mainWindow, data); });

  ipcMain.handle('ajyal-close-window', async () => {
    if (ajyalView && !ajyalView.webContents.isDestroyed()) {
      stopAjyalToolbarPolling(); ajyalActionInProgress = false; mainWindow.removeBrowserView(ajyalView);
    }
    return { success: true };
  });

  ipcMain.handle('ajyal-is-open', () => { return { isOpen: !!ajyalView && !ajyalView.webContents.isDestroyed() }; });
}

// ── App startup ──────────────────────────────────────────────────────────────
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
  lanServer.stop().catch(() => {});
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  lanServer.stop().catch(() => {});
});
