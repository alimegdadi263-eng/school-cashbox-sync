/**
 * Auto-updater module using electron-updater with GitHub Releases.
 * Shows native dialogs to the user when an update is available.
 */
const { dialog, BrowserWindow } = require('electron');

let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  console.error('electron-updater not available:', e.message);
  autoUpdater = null;
}

let updateCheckInProgress = false;

function setupAutoUpdater(mainWindow) {
  if (!autoUpdater) {
    console.warn('Auto-updater is not available, skipping setup.');
    return;
  }

  // Configure logging
  try {
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'info';
  } catch (e) {
    console.warn('electron-log not available, using console.');
  }
  autoUpdater.logger.transports.file.level = 'info';

  // Don't auto-download, let the user decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // ── Events ──────────────────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow(mainWindow, 'checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow(mainWindow, 'available', info.version);

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'تحديث متوفر',
        message: `يتوفر إصدار جديد (${info.version}).\nهل تريد تحميله وتثبيته الآن؟`,
        buttons: ['نعم، حدّث الآن', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        } else {
          updateCheckInProgress = false;
        }
      });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatusToWindow(mainWindow, 'not-available');
    updateCheckInProgress = false;
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatusToWindow(mainWindow, 'downloading', null, Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow(mainWindow, 'downloaded', info.version);
    updateCheckInProgress = false;

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'التحديث جاهز',
        message: `تم تحميل الإصدار ${info.version} بنجاح.\nسيتم إعادة تشغيل البرنامج لتثبيت التحديث.`,
        buttons: ['أعد التشغيل الآن', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });

  autoUpdater.on('error', (err) => {
    sendStatusToWindow(mainWindow, 'error');
    updateCheckInProgress = false;

    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'خطأ في التحديث',
      message: `حدث خطأ أثناء التحقق من التحديثات:\n${err.message}`,
      buttons: ['حسناً'],
    });
  });
}

function checkForUpdates() {
  if (updateCheckInProgress) return;
  updateCheckInProgress = true;
  autoUpdater.checkForUpdates();
}

function checkForUpdatesSilent() {
  if (updateCheckInProgress) return;
  updateCheckInProgress = true;
  autoUpdater.checkForUpdates().catch(() => {
    updateCheckInProgress = false;
  });
}

function sendStatusToWindow(mainWindow, status, version, progress) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, version, progress });
  }
}

module.exports = { setupAutoUpdater, checkForUpdates, checkForUpdatesSilent };
