const { app, BrowserWindow, session, globalShortcut, dialog, ipcMain } = require('electron');
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

// ── App Ready ────────────────────────────────────────────────────────────────
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
