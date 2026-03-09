const { app, BrowserWindow, session, globalShortcut, dialog, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { setupAutoUpdater, checkForUpdates, checkForUpdatesSilent } = require('./updater.cjs');

const isDev = !app.isPackaged;

// Security: Disable hardware acceleration for security
app.disableHardwareAcceleration();

// ── Integrity Check ──────────────────────────────────────────────────────────
function verifyIntegrity() {
  if (isDev) return true; // Skip in development

  try {
    const distDir = path.join(__dirname, '../dist');
    const manifestPath = path.join(distDir, '.integrity.json');

    if (!fs.existsSync(manifestPath)) {
      console.error('Integrity manifest not found');
      return false;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Verify manifest signature
    const expectedSig = crypto
      .createHash('sha256')
      .update(JSON.stringify(manifest.files) + manifest.generatedAt)
      .digest('hex');

    if (expectedSig !== manifest.signature) {
      console.error('Integrity manifest signature mismatch');
      return false;
    }

    // Verify each file hash
    for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
      const filePath = path.join(distDir, relativePath);

      if (!fs.existsSync(filePath)) {
        console.error(`Missing file: ${relativePath}`);
        return false;
      }

      const content = fs.readFileSync(filePath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');

      if (actualHash !== expectedHash) {
        console.error(`Tampered file detected: ${relativePath}`);
        return false;
      }
    }

    console.log('Integrity check passed ✓');
    return true;
  } catch (error) {
    console.error('Integrity check failed:', error.message);
    return false;
  }
}

// ── Main Window ──────────────────────────────────────────────────────────────
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'مالية المدارس - Ali Megdadi',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDev,
      javascript: true,
      webgl: false,
      enableWebSQL: false,
    },
  });

  // Runtime diagnostics: show clear errors instead of silent white screen
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load:', { errorCode, errorDescription, validatedURL });
    dialog.showErrorBox(
      'خطأ في تحميل الواجهة',
      `تعذر تحميل واجهة البرنامج.\n${errorDescription} (${errorCode})\n${validatedURL || ''}`
    );
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process crashed:', details);
    dialog.showErrorBox('تعطل الواجهة', 'حدث تعطل في واجهة البرنامج. أعد تشغيل التطبيق.');
  });

  // Security: Remove menu entirely in production
  if (!isDev) {
    mainWindow.setMenu(null);
    mainWindow.removeMenu();
  }

  // Security: Prevent DevTools from opening in production
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // Security: Set Content Security Policy for HTTP content only
  // (file:// packaged assets can break with overly strict CSP headers)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith('file://')) {
      callback({ responseHeaders: { ...details.responseHeaders } });
      return;
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: blob: https:; " +
            "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co; " +
            "frame-src 'none';",
        ],
      },
    });
  });

  // Security: Control new window creation (allow print windows)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow blank windows for PDF print export
    if (url === '' || url === 'about:blank') {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (isDev && parsedUrl.hostname === 'localhost') return;
    if (parsedUrl.protocol === 'file:') return;
    event.preventDefault();
  });

  // Security: Block keyboard shortcuts for DevTools in production
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        event.preventDefault();
        return;
      }
      if (input.control && input.shift && ['I', 'J', 'C'].includes(input.key.toUpperCase())) {
        event.preventDefault();
        return;
      }
      if (input.control && input.key.toUpperCase() === 'U') {
        event.preventDefault();
        return;
      }
    });
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ── App Ready ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Security: Integrity check before launching
  if (!isDev && !verifyIntegrity()) {
    dialog.showErrorBox(
      'خطأ أمني',
      'تم اكتشاف تعديل غير مصرح به على ملفات البرنامج.\nيرجى إعادة تثبيت البرنامج من المصدر الرسمي.'
    );
    app.quit();
    return;
  }

  // Security: Block all DevTools shortcuts globally in production
  if (!isDev) {
    globalShortcut.register('F12', () => {});
    globalShortcut.register('CommandOrControl+Shift+I', () => {});
    globalShortcut.register('CommandOrControl+Shift+J', () => {});
    globalShortcut.register('CommandOrControl+Shift+C', () => {});
    globalShortcut.register('CommandOrControl+U', () => {});
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Security: Unregister shortcuts on quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
