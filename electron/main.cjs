const { app, BrowserWindow, session, globalShortcut } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const isDev = !app.isPackaged;

// Security: Disable hardware acceleration for security
app.disableHardwareAcceleration();

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
      devTools: isDev, // Disable DevTools in production
      javascript: true,
      webgl: false,
      enableWebSQL: false,
    },
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

  // Security: Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
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
          "frame-src 'none';"
        ],
      },
    });
  });

  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
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
      // Block F12
      if (input.key === 'F12') {
        event.preventDefault();
        return;
      }
      // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools shortcuts)
      if (input.control && input.shift && ['I', 'J', 'C'].includes(input.key.toUpperCase())) {
        event.preventDefault();
        return;
      }
      // Block Ctrl+U (View Source)
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

app.whenReady().then(() => {
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
