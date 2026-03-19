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

  sendStatusToWindow(
    mainWindow ?? currentMainWindow,
    currentUpdateState.status,
    currentUpdateState.version,
    currentUpdateState.progress,
  );
}

function logInfo(message, meta) {
  autoUpdater?.logger?.info?.(`[updater] ${message}`, meta || '');
}

function logError(message, error) {
  autoUpdater?.logger?.error?.(`[updater] ${message}`, error);
}

function showErrorDialog(title, message) {
  if (currentMainWindow && !currentMainWindow.isDestroyed()) {
    dialog.showMessageBox(currentMainWindow, {
      type: 'error',
      title,
      message,
      buttons: ['حسناً'],
    });
  }
}

function downloadAvailableUpdate() {
  if (!autoUpdater || updateCheckInProgress) return;

  updateCheckInProgress = true;
  updateState(currentMainWindow, 'downloading', currentUpdateState.version, currentUpdateState.progress || 0);
  logInfo('Starting update download', { version: currentUpdateState.version });

  autoUpdater.downloadUpdate().catch((err) => {
    updateCheckInProgress = false;
    updateState(currentMainWindow, 'error', currentUpdateState.version, 0);
    logError('Failed to download update', err);
    showErrorDialog('خطأ في تنزيل التحديث', `تعذر تنزيل التحديث:\n${err.message}`);
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

  try {
    autoUpdater.setFeedURL(UPDATE_FEED);
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;

    autoUpdater.removeAllListeners('checking-for-update');
    autoUpdater.removeAllListeners('update-available');
    autoUpdater.removeAllListeners('update-not-available');
    autoUpdater.removeAllListeners('download-progress');
    autoUpdater.removeAllListeners('update-downloaded');
    autoUpdater.removeAllListeners('error');

    logInfo('Auto updater configured', {
      currentVersion: app.getVersion(),
      feed: UPDATE_FEED,
      isPackaged: app.isPackaged,
    });

    autoUpdater.on('checking-for-update', () => {
      updateCheckInProgress = true;
      updateState(mainWindow, 'checking', '', 0);
      logInfo('Checking for updates', { currentVersion: app.getVersion() });
    });

    autoUpdater.on('update-available', (info) => {
      updateCheckInProgress = false;
      updateState(mainWindow, 'available', info.version, 0);
      logInfo('Update available', info);

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
        })
        .catch((err) => {
          logError('Failed to show update-available dialog', err);
        });
    });

    autoUpdater.on('update-not-available', (info) => {
      updateCheckInProgress = false;
      updateState(mainWindow, 'not-available', '', 0);
      logInfo('No update available', info || { currentVersion: app.getVersion() });
    });

    autoUpdater.on('download-progress', (progress) => {
      updateState(mainWindow, 'downloading', currentUpdateState.version, Math.round(progress.percent));
    });

    autoUpdater.on('update-downloaded', (info) => {
      updateCheckInProgress = false;
      updateState(mainWindow, 'downloaded', info.version, 100);
      logInfo('Update downloaded', info);

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
        })
        .catch((err) => {
          logError('Failed to show update-downloaded dialog', err);
        });
    });

    autoUpdater.on('error', (err) => {
      updateCheckInProgress = false;
      updateState(mainWindow, 'error', currentUpdateState.version, 0);
      logError('Updater error', err);
      showErrorDialog('خطأ في التحديث', `حدث خطأ أثناء التحقق من التحديثات:\n${err.message}`);
    });
  } catch (err) {
    updateCheckInProgress = false;
    updateState(mainWindow, 'error', currentUpdateState.version, 0);
    logError('Failed to initialize auto updater', err);
    showErrorDialog('خطأ في التحديث', `تعذر تهيئة نظام التحديث:\n${err.message}`);
  }
}

function checkForUpdates() {
  if (!autoUpdater || updateCheckInProgress) return;

  updateCheckInProgress = true;
  logInfo('Manual update check requested', { currentVersion: app.getVersion() });

  autoUpdater.checkForUpdates().catch((err) => {
    updateCheckInProgress = false;
    updateState(currentMainWindow, 'error', currentUpdateState.version, 0);
    logError('Manual update check failed', err);
    showErrorDialog('خطأ في التحديث', `تعذر التحقق من التحديثات:\n${err.message}`);
  });
}

function checkForUpdatesSilent() {
  if (!autoUpdater || updateCheckInProgress) return;

  updateCheckInProgress = true;
  logInfo('Silent update check requested', { currentVersion: app.getVersion() });

  autoUpdater.checkForUpdates().catch((err) => {
    updateCheckInProgress = false;
    updateState(currentMainWindow, 'idle', currentUpdateState.version, 0);
    logError('Silent update check failed', err);
  });
}

function runUpdateAction() {
  if (!autoUpdater) return;

  if (currentUpdateState.status === 'downloaded') {
    logInfo('Installing downloaded update', { version: currentUpdateState.version });
    autoUpdater.quitAndInstall(false, true);
    return;
  }

  if (currentUpdateState.status === 'available') {
    downloadAvailableUpdate();
    return;
  }

  if (currentUpdateState.status === 'downloading' || currentUpdateState.status === 'checking') {
    return;
  }

  checkForUpdates();
}

module.exports = { setupAutoUpdater, checkForUpdates, checkForUpdatesSilent, runUpdateAction };
