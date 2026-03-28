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
    dialog.showErrorBox('خطأ في تحميل الواجهة', `تعذر تحميل واجهة البرنامج.\n${errorDescription} (${errorCode})\n${validatedURL || ''}`);
  });
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error('Renderer console:', { level, message, line, sourceId });
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process crashed:', details);
    dialog.showErrorBox('تعطل الواجهة', 'حدث تعطل في واجهة البرنامج. أعد تشغيل التطبيق.');
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
      // Remove existing view if any
      if (ajyalView) {
        try { mainWindow.removeBrowserView(ajyalView); } catch {}
        try { ajyalView.webContents.destroy(); } catch {}
        ajyalView = null;
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

      // Set bounds to fill window with space for top toolbar
      const bounds = mainWindow.getContentBounds();
      const toolbarHeight = 50;
      ajyalView.setBounds({ x: 0, y: toolbarHeight, width: bounds.width, height: bounds.height - toolbarHeight });
      ajyalView.setAutoResize({ width: true, height: true });

      // Handle navigation within Ajyal
      ajyalView.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          ajyalView.webContents.loadURL(url);
        }
        return { action: 'deny' };
      });

      await ajyalView.webContents.loadURL(ajyalUrl);

      // Auto-fill credentials on login page
      ajyalView.webContents.on('did-finish-load', async () => {
        if (!ajyalView) return;
        const currentURL = ajyalView.webContents.getURL();
        if (loginMethod === 'credentials' && (currentURL.includes('/login') || currentURL.includes('ajyal.moe.gov.jo'))) {
          try {
            await ajyalView.webContents.executeJavaScript(`
              (function() {
                const selectors = [
                  'input[name="username"]', 'input[name="email"]', 'input[name="user"]',
                  'input[id="username"]', 'input[id="email"]', 'input[type="text"]',
                  'input[placeholder*="مستخدم"]', 'input[placeholder*="رقم"]'
                ];
                const passSelectors = [
                  'input[name="password"]', 'input[id="password"]', 'input[type="password"]'
                ];
                let userInput = null;
                for (const sel of selectors) { userInput = document.querySelector(sel); if (userInput) break; }
                let passInput = null;
                for (const sel of passSelectors) { passInput = document.querySelector(sel); if (passInput) break; }
                if (userInput) {
                  userInput.focus();
                  userInput.value = ${JSON.stringify(username)};
                  userInput.dispatchEvent(new Event('input', { bubbles: true }));
                  userInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (passInput) {
                  passInput.focus();
                  passInput.value = ${JSON.stringify(password)};
                  passInput.dispatchEvent(new Event('input', { bubbles: true }));
                  passInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
              })();
            `);
          } catch (e) {
            console.error('Auto-fill failed:', e.message);
          }
        }

        // Inject floating toolbar into the Ajyal page
        try {
          await ajyalView.webContents.executeJavaScript(`
            (function() {
              if (document.getElementById('school-toolbar')) return;
              const toolbar = document.createElement('div');
              toolbar.id = 'school-toolbar';
              toolbar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:50px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:999999;font-family:Arial,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.3);direction:rtl;';
              toolbar.innerHTML = \`
                <div style="display:flex;align-items:center;gap:12px;">
                  <span style="font-weight:bold;font-size:14px;">🏫 الإدارة المدرسية</span>
                  <span style="font-size:12px;opacity:0.8;">|</span>
                  <span style="font-size:12px;opacity:0.8;" id="toolbar-status">متصل بأجيال</span>
                </div>
                <div style="display:flex;gap:8px;">
                  <button id="btn-import-students" style="background:#10b981;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;display:flex;align-items:center;gap:4px;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                    📥 استيراد الطلاب
                  </button>
                  <button id="btn-submit-absence" style="background:#f59e0b;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;display:flex;align-items:center;gap:4px;" onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">
                    📋 تعبئة الغياب
                  </button>
                  <button id="btn-close-ajyal" style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                    ✕ إغلاق
                  </button>
                </div>
              \`;
              document.body.style.paddingTop = '50px';
              document.body.insertBefore(toolbar, document.body.firstChild);
            })();
          `);
        } catch (e) {
          console.error('Toolbar injection failed:', e.message);
        }
      });

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
            mainWindow.webContents.send('ajyal-action', { type: 'import-request' });
          } else if (action === 'absence') {
            mainWindow.webContents.send('ajyal-action', { type: 'absence-request' });
          } else if (action === 'close') {
            clearInterval(pollInterval);
            if (ajyalView && !ajyalView.webContents.isDestroyed()) {
              mainWindow.removeBrowserView(ajyalView);
              ajyalView.webContents.destroy();
              ajyalView = null;
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

  ipcMain.handle('ajyal-import-students', async () => {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) {
      return { success: false, error: 'View not open' };
    }
    try {
      // Show loading indicator on toolbar
      try {
        await ajyalView.webContents.executeJavaScript(`
          (function() {
            const btn = document.getElementById('btn-import-students');
            if (btn) { btn.textContent = '⏳ جاري الاستيراد...'; btn.disabled = true; }
          })();
        `);
      } catch {}

      const result = await ajyalView.webContents.executeJavaScript(`
        (function () {
          try {
            const text = (value) => (value || '').replace(/\\s+/g, ' ').trim();
            const rows = Array.from(document.querySelectorAll('table tr'));
            const students = rows
              .map((row) => {
                const cells = Array.from(row.querySelectorAll('td, th')).map((cell) => text(cell.textContent));
                if (cells.length < 2) return null;
                const name = cells.find((cell) => /[\\u0600-\\u06FF]{2,}/.test(cell) && !/الصف|الشعبة|الهاتف|ولي الأمر|اسم الطالب|الرقم|م\\.?$/.test(cell)) || '';
                const className = cells.find((cell) => /صف|شعبة|أول|ثاني|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر|حادي عشر|ثاني عشر/.test(cell)) || '';
                const parentPhone = cells.find((cell) => /(07|962)\\d{8,}/.test(cell.replace(/\\s+/g, ''))) || '';
                const parentName = cells.find((cell) => /ولي الأمر|الأب|الأم/.test(cell)) || '';
                if (!name || /اسم الطالب|الطالب/.test(name)) return null;
                return { name, className, parentPhone, parentName };
              })
              .filter(Boolean);
            return { success: students.length > 0, students, count: students.length };
          } catch (error) {
            return { success: false, error: error.message };
          }
        })();
      `);

      // Reset toolbar button
      try {
        await ajyalView.webContents.executeJavaScript(`
          (function() {
            const btn = document.getElementById('btn-import-students');
            if (btn) { btn.textContent = '📥 استيراد الطلاب'; btn.disabled = false; }
          })();
        `);
      } catch {}

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ajyal-submit-absence', async (_event, data) => {
    if (!ajyalView || ajyalView.webContents.isDestroyed()) {
      return { success: false, error: 'View not open' };
    }
    try {
      const result = await ajyalView.webContents.executeJavaScript(`
        (function() {
          try {
            const studentName = ${JSON.stringify(data.studentName)};
            const className = ${JSON.stringify(data.className)};
            const searchInputs = document.querySelectorAll('input[type="search"], input[type="text"], input.search-input');
            let filled = false;
            for (const input of searchInputs) {
              if (input.placeholder && (input.placeholder.includes('بحث') || input.placeholder.includes('طالب'))) {
                input.focus();
                input.value = studentName;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                filled = true;
                break;
              }
            }
            if (!filled) {
              const elements = document.querySelectorAll('td, span, div, label');
              for (const el of elements) {
                if (el.textContent.trim() === studentName) { el.click(); filled = true; break; }
              }
            }
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            for (const cb of checkboxes) {
              const parent = cb.closest('tr, div, label');
              if (parent && parent.textContent.includes(studentName) && !cb.checked) { cb.click(); break; }
            }
            return { success: true, filled };
          } catch (e) { return { success: false, error: e.message }; }
        })();
      `);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ajyal-close-window', async () => {
    if (ajyalView && !ajyalView.webContents.isDestroyed()) {
      mainWindow.removeBrowserView(ajyalView);
      ajyalView.webContents.destroy();
      ajyalView = null;
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
    setupAjyalHandlers();

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
