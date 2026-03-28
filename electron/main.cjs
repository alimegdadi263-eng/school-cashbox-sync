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

function setupAjyalHandlers(mainWindow) {
  mainWindowRef = mainWindow;

  ipcMain.handle('ajyal-open-embedded', async (_event, username, password, loginMethod = 'credentials') => {
    try {
      // Reuse existing view if session is alive
      if (ajyalView && !ajyalView.webContents.isDestroyed()) {
        mainWindow.addBrowserView(ajyalView);
        const bounds = mainWindow.getContentBounds();
        ajyalView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
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

      mainWindow.addBrowserView(ajyalView);

      // Set bounds to fill entire window (toolbar is injected inside the page)
      const bounds = mainWindow.getContentBounds();
      ajyalView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
      ajyalView.setAutoResize({ width: true, height: true });

      // Handle navigation within Ajyal
      ajyalView.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          ajyalView.webContents.loadURL(url);
        }
        return { action: 'deny' };
      });

      // Setup navigation handlers BEFORE loading URL
      const injectToolbar = async () => {
        if (!ajyalView || ajyalView.webContents.isDestroyed()) return;
        try {
          await ajyalView.webContents.executeJavaScript(
            '(function() {' +
            'if (document.getElementById("school-toolbar")) return;' +
            'var toolbar = document.createElement("div");' +
            'toolbar.id = "school-toolbar";' +
            'toolbar.style.cssText = "position:fixed;top:0;left:0;right:0;height:50px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:999999;font-family:Arial,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.3);direction:rtl;";' +
            'toolbar.innerHTML = \'<div style="display:flex;align-items:center;gap:12px;"><span style="font-weight:bold;font-size:14px;">🏫 الإدارة المدرسية</span><span style="font-size:12px;opacity:0.8;">|</span><span style="font-size:12px;opacity:0.8;" id="toolbar-status">متصل بأجيال</span></div><div style="display:flex;gap:8px;"><button id="btn-import-students" style="background:#10b981;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">📥 استيراد الطلاب</button><button id="btn-submit-absence" style="background:#f59e0b;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">📋 تعبئة الغياب</button><button id="btn-close-ajyal" style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">✕ رجوع</button></div>\';' +
            'document.body.style.paddingTop = "50px";' +
            'document.body.insertBefore(toolbar, document.body.firstChild);' +
            '})();'
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

      // Re-inject toolbar on in-page navigations (SPA)
      ajyalView.webContents.on('did-navigate-in-page', async () => {
        await injectToolbar();
      });

      // Also inject after a short delay for dynamic pages
      ajyalView.webContents.on('dom-ready', async () => {
        setTimeout(async () => { await injectToolbar(); }, 1500);
      });

      await ajyalView.webContents.loadURL(ajyalUrl);

      // Also inject immediately after load
      await injectToolbar();

      // (handlers already registered above)

      // Listen for toolbar button clicks via polling
      const pollInterval = setInterval(async () => {
        if (!ajyalView || ajyalView.webContents.isDestroyed()) {
          clearInterval(pollInterval);
          return;
        }
        try {
          const action = await ajyalView.webContents.executeJavaScript(`
            (function() {
              const toolbar = document.getElementById('school-toolbar');
              if (!toolbar) return null;
              
              // Setup click handlers if not already set
              if (!toolbar.dataset.handlersSet) {
                toolbar.dataset.handlersSet = 'true';
                document.getElementById('btn-import-students')?.addEventListener('click', () => { toolbar.dataset.action = 'import'; });
                document.getElementById('btn-submit-absence')?.addEventListener('click', () => { toolbar.dataset.action = 'absence'; });
                document.getElementById('btn-close-ajyal')?.addEventListener('click', () => { toolbar.dataset.action = 'close'; });
              }
              
              const action = toolbar.dataset.action;
              if (action) { delete toolbar.dataset.action; return action; }
              return null;
            })();
          `);

          if (action === 'import') {
            // Run import directly in main process
            mainWindow.webContents.send('ajyal-action', { type: 'import-started' });
            try {
              const result = await runImportStudents(mainWindow);
              mainWindow.webContents.send('ajyal-action', { type: 'import-result', ...result });
            } catch (e) {
              mainWindow.webContents.send('ajyal-action', { type: 'import-result', success: false, error: e.message });
            }
          } else if (action === 'absence') {
            // Run absence directly in main process
            mainWindow.webContents.send('ajyal-action', { type: 'absence-started' });
            try {
              const result = await runSubmitAbsence(mainWindow);
              mainWindow.webContents.send('ajyal-action', { type: 'absence-result', ...result });
            } catch (e) {
              mainWindow.webContents.send('ajyal-action', { type: 'absence-result', success: false, error: e.message });
            }
          } else if (action === 'close') {
            clearInterval(pollInterval);
            // Hide BrowserView instead of destroying (keep session alive)
            if (ajyalView && !ajyalView.webContents.isDestroyed()) {
              mainWindow.removeBrowserView(ajyalView);
              // Don't destroy - keep alive for next time
            }
            mainWindow.webContents.send('ajyal-action', { type: 'closed' });
          }
        } catch {}
      }, 500);

      return { success: true, url: ajyalUrl };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Keep old handler for backwards compat
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

  // Helper: execute JS with retry and wait
  async function ajyalExec(js) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) throw new Error('View not open');
    return ajyalView.webContents.executeJavaScript(js);
  }

  async function ajyalWait(ms = 2000) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Helper: update toolbar status text
  async function updateToolbarStatus(text) {
    try {
      const safeText = String(text).replace(/'/g, "\\'");
      await ajyalExec('(function(){ var s = document.getElementById("toolbar-status"); if(s) s.textContent = \'' + safeText + '\'; })()');
    } catch {}
  }

  // Helper: normalize Arabic text (remove diacritics/tashkeel, normalize whitespace)
  const normalizeArabicJS = `
    function normalizeArabic(text) {
      return (text || '').replace(/[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED]/g, '').replace(/\\s+/g, ' ').trim();
    }
  `;

  // Fix #4: Improved text matching with normalization, partial matching, and href patterns
  const clickByTextJS = (texts, tag = 'a, button, span, li, div, label, [role="menuitem"], [role="button"], .nav-link, .menu-item, .sidebar-link') => `
    (function() {
      ${normalizeArabicJS}
      const targets = ${JSON.stringify(texts)}.map(t => normalizeArabic(t));
      const els = document.querySelectorAll('${tag}');
      // Pass 1: exact or includes match (normalized)
      for (const el of els) {
        const t = normalizeArabic(el.textContent);
        for (const target of targets) {
          if (t === target || t.includes(target)) {
            el.click();
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return { clicked: true, text: t };
          }
        }
      }
      // Pass 2: partial match (at least 3 chars overlap)
      for (const el of els) {
        const t = normalizeArabic(el.textContent);
        for (const target of targets) {
          if (target.length >= 3 && t.includes(target.substring(0, Math.min(target.length, 6)))) {
            el.click();
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return { clicked: true, text: t, partial: true };
          }
        }
      }
      // Pass 3: href-based matching for known Ajyal URL paths
      const hrefPatterns = { 'الطلبة': ['/students', '/student'], 'إدارة الطلبة': ['/students', '/student'], 'الحضور والغياب': ['/attendance', '/absence'], 'تسجيل الغياب': ['/absence', '/record-absence'], 'بيانات الطلبة': ['/students/list', '/student-data'] };
      const links = document.querySelectorAll('a[href]');
      for (const target of ${JSON.stringify(texts)}) {
        const patterns = hrefPatterns[target] || [];
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          for (const pattern of patterns) {
            if (href.includes(pattern)) { link.click(); return { clicked: true, text: link.textContent.trim(), href: true }; }
          }
        }
      }
      return { clicked: false };
    })()
  `;

  // Helper: select dropdown option by visible text
  const selectOptionJS = (selectTexts, optionText) => `
    (function() {
      const selectors = ${JSON.stringify(selectTexts)};
      // Try native <select> elements
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
      // Try custom dropdowns (click to open, then click option)
      const dropdowns = document.querySelectorAll('[class*="select"], [class*="dropdown"], [role="listbox"], [role="combobox"]');
      for (const dd of dropdowns) {
        const label = dd.closest('div, label, .form-group')?.textContent || '';
        for (const s of selectors) {
          if (label.includes(s)) {
            dd.click();
            return { selected: false, opened: true };
          }
        }
      }
      return { selected: false };
    })()
  `;

  // Helper: get all select options for a field
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

  // Helper: set select value directly
  const setSelectValueJS = (selectTexts, value) => `
    (function() {
      const selectors = ${JSON.stringify(selectTexts)};
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        const label = sel.closest('div, label, .form-group')?.textContent || '';
        for (const s of selectors) {
          if (label.includes(s) || sel.name?.includes(s) || sel.id?.includes(s)) {
            sel.value = '${value}';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return { selected: true };
          }
        }
      }
      return { selected: false };
    })()
  `;

  // Fix #2: Improved student scraping - detect name column by header row
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
        
        // Find header row and identify column indices
        const headerRow = bestTable.querySelector('thead tr') || bestTable.querySelector('tr');
        const headerCells = Array.from(headerRow.querySelectorAll('th, td')).map(c => text(c.textContent));
        
        let nameColIdx = -1;
        let classColIdx = -1;
        let phoneColIdx = -1;
        
        for (let i = 0; i < headerCells.length; i++) {
          const h = headerCells[i];
          if (/اسم الطالب|الاسم|اسم|Student Name|Name/i.test(h) && nameColIdx === -1) nameColIdx = i;
          if (/الصف|الفصل|المرحلة|Class|Grade/i.test(h) && classColIdx === -1) classColIdx = i;
          if (/الهاتف|الجوال|رقم.*ولي|Phone|Mobile/i.test(h) && phoneColIdx === -1) phoneColIdx = i;
        }
        
        // Fallback: find name column by content if header detection fails
        const dataRows = Array.from(bestTable.querySelectorAll('tbody tr'));
        if (dataRows.length === 0) {
          // Use all tr except first (header)
          const allRows = Array.from(bestTable.querySelectorAll('tr'));
          if (allRows.length > 1) dataRows.push(...allRows.slice(1));
        }
        
        if (nameColIdx === -1 && dataRows.length > 0) {
          const sampleCells = Array.from(dataRows[0].querySelectorAll('td')).map(c => text(c.textContent));
          for (let i = 0; i < sampleCells.length; i++) {
            if (/[\\u0600-\\u06FF]{2,}/.test(sampleCells[i]) && sampleCells[i].length >= 4 && !/\\d{5,}/.test(sampleCells[i])) {
              nameColIdx = i;
              break;
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

  // ── Shared import function (used by toolbar and IPC) ──
  async function runImportStudents(mainWindow) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) {
      return { success: false, error: 'View not open' };
    }
    try {
      await ajyalExec(`(function(){ const btn = document.getElementById('btn-import-students'); if(btn){ btn.textContent = '⏳ جاري الاستيراد...'; btn.disabled = true; } })()`);
      await updateToolbarStatus('جاري التنقل إلى قائمة الطلاب...');

      let navResult = await ajyalExec(clickByTextJS(['إدارة الطلبة', 'الطلبة', 'بيانات الطلبة', 'إدارة الطلاب', 'Students']));
      await ajyalWait(2000);

      if (navResult.clicked) {
        await ajyalExec(clickByTextJS(['بيانات الطلبة', 'قائمة الطلبة', 'قائمة الطلاب', 'عرض الطلبة', 'Student List']));
        await ajyalWait(2000);
      }

      await updateToolbarStatus('جاري اكتشاف الصفوف والشعب...');
      const gradeOptions = await ajyalExec(getSelectOptionsJS(['الصف', 'المرحلة', 'الفصل', 'grade', 'class', 'Grade']));
      const sectionOptions = await ajyalExec(getSelectOptionsJS(['الشعبة', 'القسم', 'الفرع', 'section', 'Section']));

      let allStudents = [];

      if (gradeOptions.length > 0) {
        for (let gi = 0; gi < gradeOptions.length; gi++) {
          const grade = gradeOptions[gi];
          if (!grade.text || grade.text === '--' || grade.text === 'اختر' || grade.text.includes('اختر') || grade.value === '' || grade.value === '0') continue;

          await updateToolbarStatus(`جاري استيراد: ${grade.text} (${gi + 1}/${gradeOptions.length})`);
          await ajyalExec(setSelectValueJS(['الصف', 'المرحلة', 'الفصل', 'grade', 'class', 'Grade'], grade.value));
          await ajyalWait(1000);

          const currentSections = await ajyalExec(getSelectOptionsJS(['الشعبة', 'القسم', 'الفرع', 'section', 'Section']));

          if (currentSections.length > 0) {
            for (const sec of currentSections) {
              if (!sec.text || sec.text === '--' || sec.text.includes('اختر') || sec.value === '' || sec.value === '0') continue;
              await ajyalExec(setSelectValueJS(['الشعبة', 'القسم', 'الفرع', 'section', 'Section'], sec.value));
              await ajyalWait(500);
              await ajyalExec(clickByTextJS(['بحث', 'عرض', 'Search', 'Show', 'إظهار', 'استعلام'], 'button, input[type="submit"], input[type="button"], a.btn, .btn'));
              await ajyalWait(2500);
              const result = await ajyalExec(scrapeStudentsJS);
              if (result.success && result.students) {
                allStudents.push(...result.students.map(s => ({ ...s, className: s.className || `${grade.text} ${sec.text}` })));
              }
              await updateToolbarStatus(`تم استيراد ${allStudents.length} طالب حتى الآن...`);
            }
          } else {
            await ajyalExec(clickByTextJS(['بحث', 'عرض', 'Search', 'Show', 'إظهار', 'استعلام'], 'button, input[type="submit"], input[type="button"], a.btn, .btn'));
            await ajyalWait(2500);
            const result = await ajyalExec(scrapeStudentsJS);
            if (result.success && result.students) {
              allStudents.push(...result.students.map(s => ({ ...s, className: s.className || grade.text })));
            }
          }
        }
      } else {
        await updateToolbarStatus('لم يُعثر على قوائم الصفوف، جاري قراءة الصفحة الحالية...');
        await ajyalExec(clickByTextJS(['بحث', 'عرض', 'Search', 'Show'], 'button, input[type="submit"], input[type="button"], a.btn, .btn'));
        await ajyalWait(2500);
        const result = await ajyalExec(scrapeStudentsJS);
        if (result.success && result.students) allStudents = result.students;
      }

      // Deduplicate
      const seen = new Set();
      allStudents = allStudents.filter(s => { const k = `${s.name}||${s.className}`; if (seen.has(k)) return false; seen.add(k); return true; });

      await updateToolbarStatus(`✅ تم استيراد ${allStudents.length} طالب بنجاح`);
      await ajyalExec(`(function(){ const btn = document.getElementById('btn-import-students'); if(btn){ btn.textContent = '📥 استيراد الطلاب'; btn.disabled = false; } })()`);

      return { success: allStudents.length > 0, students: allStudents, count: allStudents.length };
    } catch (err) {
      try { await ajyalExec(`(function(){ const btn = document.getElementById('btn-import-students'); if(btn){ btn.textContent = '📥 استيراد الطلاب'; btn.disabled = false; } })()`); } catch {}
      return { success: false, error: err.message };
    }
  }

  // Fix #1: Accept absence data directly from IPC instead of re-reading localStorage
  async function runSubmitAbsence(mainWindow, absenceData) {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) {
      return { success: false, error: 'View not open' };
    }
    try {
      let records = absenceData || null;

      // Fallback: if no data passed, read from localStorage
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
        await updateToolbarStatus('⚠️ لا يوجد غياب مسجل لهذا اليوم');
        return { success: false, error: 'لا يوجد غياب مسجل لهذا اليوم. سجّل الغياب أولاً من الرصد اليومي.' };
      }

      await ajyalExec(`(function(){ const btn = document.getElementById('btn-submit-absence'); if(btn){ btn.textContent = '⏳ جاري التعبئة...'; btn.disabled = true; } })()`);
      await updateToolbarStatus('جاري التنقل إلى صفحة تسجيل الغياب...');

      // Navigate to attendance section
      await ajyalExec(clickByTextJS(['الحضور والغياب', 'الغياب', 'Attendance', 'متابعة الحضور']));
      await ajyalWait(2000);
      await ajyalExec(clickByTextJS(['تسجيل الغياب', 'متابعة الغياب', 'رصد الغياب', 'Absence', 'تسجيل الحضور والغياب']));
      await ajyalWait(2000);

      // Group by class
      const byClass = {};
      for (const r of records) {
        const key = r.className || 'unknown';
        if (!byClass[key]) byClass[key] = [];
        byClass[key].push(r);
      }

      let totalMarked = 0;
      const classKeys = Object.keys(byClass);

      // Fix #3: Improved className parsing - extract section as last Arabic letter (أ-د)
      function parseClassName(cls) {
        // Match last Arabic letter that looks like a section (أ، ب، ج، د، ه، و)
        const sectionMatch = cls.match(/([أبجدهو])\s*$/);
        let section = '';
        let grade = cls;
        if (sectionMatch) {
          section = sectionMatch[1];
          grade = cls.substring(0, cls.lastIndexOf(section)).trim();
        }
        // Handle formats like "8ب" or "الثامنب"
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

      for (let ci = 0; ci < classKeys.length; ci++) {
        const cls = classKeys[ci];
        const classRecords = byClass[cls];
        
        await updateToolbarStatus('جاري تعبئة غياب: ' + cls + ' (' + (ci + 1) + '/' + classKeys.length + ')');

        const parsed = parseClassName(cls);
        const grade = parsed.grade;
        const section = parsed.section;

        // Set date
        const today = new Date();
        const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        await ajyalExec('(function() { var dateInputs = document.querySelectorAll("input[type=\\"date\\"]"); for (var i = 0; i < dateInputs.length; i++) { dateInputs[i].value = "' + dateStr + '"; dateInputs[i].dispatchEvent(new Event("change", { bubbles: true })); } })()');

        // Fix #3: Use partial matching for grade dropdown
        if (grade) {
          // Try exact match first, then partial match
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
          await ajyalExec(setSelectValueJS(['\u0627\u0644\u0634\u0639\u0628\u0629', '\u0627\u0644\u0642\u0633\u0645', 'section'], section));
          await ajyalWait(500);
        }

        await ajyalExec(clickByTextJS(['عرض الطلبة', 'عرض', 'بحث', 'Show', 'Search', 'إظهار'], 'button, input[type="submit"], input[type="button"], a.btn, .btn'));
        await ajyalWait(2500);

        // Fix #5: Match students by name AND verify className to handle duplicate names
        for (const record of classRecords) {
          try {
            const studentNameJson = JSON.stringify(record.studentName);
            const classNameJson = JSON.stringify(record.className || '');
            await ajyalExec(
              '(function() {' +
              'var studentName = ' + studentNameJson + ';' +
              'var expectedClass = ' + classNameJson + ';' +
              'var rows = document.querySelectorAll("table tr, table tbody tr");' +
              'var matchedRows = [];' +
              'for (var i = 0; i < rows.length; i++) {' +
              '  var row = rows[i];' +
              '  var cells = Array.from(row.querySelectorAll("td"));' +
              '  var rowText = cells.map(function(c) { return c.textContent.trim(); }).join(" ");' +
              '  if (rowText.indexOf(studentName) !== -1) {' +
              '    matchedRows.push(row);' +
              '  }' +
              '}' +
              '// If multiple matches, verify by class column' +
              'var targetRow = matchedRows[0];' +
              'if (matchedRows.length > 1 && expectedClass) {' +
              '  for (var m = 0; m < matchedRows.length; m++) {' +
              '    if (matchedRows[m].textContent.indexOf(expectedClass) !== -1) {' +
              '      targetRow = matchedRows[m]; break;' +
              '    }' +
              '  }' +
              '}' +
              'if (!targetRow) return false;' +
              'var cb = targetRow.querySelector("input[type=\\"checkbox\\"], input[type=\\"radio\\"]");' +
              'if (cb && !cb.checked) { cb.click(); return true; }' +
              'var cells = targetRow.querySelectorAll("td");' +
              'for (var j = 0; j < cells.length; j++) {' +
              '  var cell = cells[j];' +
              '  var sel = cell.querySelector("select");' +
              '  if (sel) {' +
              '    for (var k = 0; k < sel.options.length; k++) {' +
              '      var opt = sel.options[k];' +
              '      if (opt.text.indexOf("غائب") !== -1 || opt.text.indexOf("غ") !== -1 || opt.value === "absent" || opt.value === "A") {' +
              '        sel.value = opt.value; sel.dispatchEvent(new Event("change", { bubbles: true })); return true;' +
              '      }' +
              '    }' +
              '  }' +
              '}' +
              'return false;' +
              '})()'
            );
            totalMarked++;
          } catch {}
        }
      }

      await updateToolbarStatus('✅ تم تعبئة ' + totalMarked + ' غياب - اضغط حفظ في أجيال');
      await ajyalExec('(function(){ var btn = document.getElementById("btn-submit-absence"); if(btn){ btn.textContent = "📋 تعبئة الغياب"; btn.disabled = false; } })()');

      return { success: true, marked: totalMarked, total: records.length };
    } catch (err) {
      try { await ajyalExec('(function(){ var btn = document.getElementById("btn-submit-absence"); if(btn){ btn.textContent = "📋 تعبئة الغياب"; btn.disabled = false; } })()'); } catch {}
      return { success: false, error: err.message };
    }
  }

  ipcMain.handle('ajyal-import-students', async () => {
    return runImportStudents(mainWindow);
  });

  ipcMain.handle('ajyal-submit-absence', async (_event, data) => {
    return runSubmitAbsence(mainWindow, data);
  });

  ipcMain.handle('ajyal-close-window', async () => {
    if (ajyalView && !ajyalView.webContents.isDestroyed()) {
      mainWindow.removeBrowserView(ajyalView);
      // Keep view alive - don't destroy, so session persists
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
