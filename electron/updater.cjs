/**
 * Auto-updater module using electron-updater with GitHub Releases.
 * Shows native dialogs to the user when an update is available.
 */
const { dialog, app } = require('electron');

const UPDATE_FEED = {
  provider: 'github',
  owner: 'alimegdadi263-eng',
  repo: 'school-cashbox-sync',
  private: false,
};

let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  console.error('electron-updater not available:', e.message);
  autoUpdater = null;
}

let updateCheckInProgress = false;
let currentUpdateState = {
  status: 'idle',
  version: '',
  progress: 0,
};
let currentMainWindow = null;

function sendStatusToWindow(mainWindow, status, version, progress) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, version, progress });
  }
}

function updateState(mainWindow, status, version, progress) {
  currentUpdateState = {
    status,
    version: version ?? currentUpdateState.version,
    progress: progress ?? currentUpdateState.progress,
  };
  sendStatusToWindow(mainWindow ?? currentMainWindow, currentUpdateState.status, currentUpdateState.version, currentUpdateState.progress);
}

function downloadAvailableUpdate() {
  if (!autoUpdater) return;
  updateCheckInProgress = true;
  updateState(currentMainWindow, 'downloading', currentUpdateState.version, currentUpdateState.progress || 0);
  autoUpdater.downloadUpdate().catch((err) => {
    updateCheckInProgress = false;
    updateState(currentMainWindow, 'error', currentUpdateState.version, 0);
    dialog.showMessageBox(currentMainWindow, {
      type: 'error',
      title: 'خطأ في تنزيل التحديث',
      message: `تعذر تنزيل التحديث:\n${err.message}`,
      buttons: ['حسناً'],
    });
  });
}

function setupAutoUpdater(mainWindow) {
  if (!autoUpdater) {
    console.warn('Auto-updater is not available, skipping setup.');
    return;
  }

  currentMainWindow = mainWindow;

  try {
    const electronLog = require('electron-log');
    autoUpdater.logger = electronLog;
    if (autoUpdater.logger?.transports?.file) {
      autoUpdater.logger.transports.file.level = 'info';
    }
  } catch (e) {
    console.warn('electron-log not available, using default logger.');
  }

  autoUpdater.setFeedURL(UPDATE_FEED);
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.logger?.info?.('Auto updater configured', {
    currentVersion: app.getVersion(),
    feed: UPDATE_FEED,
  });

  autoUpdater.on('checking-for-update', () => {
    updateCheckInProgress = true;
    updateState(mainWindow, 'checking', '', 0);
  });

  autoUpdater.on('update-available', (info) => {
    updateCheckInProgress = false;
    updateState(mainWindow, 'available', info.version, 0);

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
          downloadAvailableUpdate();
        }
      });
  });

  autoUpdater.on('update-not-available', () => {
    updateCheckInProgress = false;
    updateState(mainWindow, 'not-available', '', 0);
  });

  autoUpdater.on('download-progress', (progress) => {
    updateState(mainWindow, 'downloading', currentUpdateState.version, Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', (info) => {
  updateCheckInProgress = false;
  updateState(mainWindow, 'downloaded', info.version, 100);

  console.log("Update downloaded - installing...");
  autoUpdater.quitAndInstall();
});

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
    updateCheckInProgress = false;
    updateState(mainWindow, 'error', currentUpdateState.version, 0);

    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'خطأ في التحديث',
      message: `حدث خطأ أثناء التحقق من التحديثات:\n${err.message}`,
      buttons: ['حسناً'],
    });
  });
}

function checkForUpdates() {
  if (!autoUpdater || updateCheckInProgress) return;
  updateCheckInProgress = true;
  autoUpdater.checkForUpdates().catch((err) => {
    updateCheckInProgress = false;
    updateState(currentMainWindow, 'error', currentUpdateState.version, 0);
    dialog.showMessageBox(currentMainWindow, {
      type: 'error',
      title: 'خطأ في التحديث',
      message: `تعذر التحقق من التحديثات:\n${err.message}`,
      buttons: ['حسناً'],
    });
  });
}

function checkForUpdatesSilent() {
  if (!autoUpdater || updateCheckInProgress) return;
  updateCheckInProgress = true;
  autoUpdater.checkForUpdates().catch(() => {
    updateCheckInProgress = false;
    updateState(currentMainWindow, 'idle', currentUpdateState.version, 0);
  });
}

function runUpdateAction() {
  if (!autoUpdater) return;

  if (currentUpdateState.status === 'downloaded') {
    autoUpdater.quitAndInstall(false, true);
    return;
  }

  if (currentUpdateState.status === 'available') {
    if (updateCheckInProgress) return;
    downloadAvailableUpdate();
    return;
  }

  if (currentUpdateState.status === 'downloading') {
    return;
  }

  if (currentUpdateState.status === 'checking') {
    updateCheckInProgress = false;
  }

  checkForUpdates();
}

module.exports = { setupAutoUpdater, checkForUpdates, checkForUpdatesSilent, runUpdateAction };
