/**
 * Auto-updater module using electron-updater with GitHub Releases.
 * Falls back to direct GitHub API check if electron-updater fails.
 */
const { dialog, app, shell } = require('electron');
const https = require('https');

const GITHUB_OWNER = 'alimegdadi263-eng';
const GITHUB_REPO = 'school-cashbox-sync';

const UPDATE_FEED = {
  provider: 'github',
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO,
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
let currentUpdateState = { status: 'idle', version: '', progress: 0 };
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

function logInfo(message, meta) {
  const logger = autoUpdater?.logger || console;
  logger.info?.(`[updater] ${message}`, meta || '');
}

function logError(message, error) {
  const logger = autoUpdater?.logger || console;
  logger.error?.(`[updater] ${message}`, error);
}

// ── Direct GitHub API check (fallback) ──────────────────────────
function checkGitHubReleaseDirect() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers: { 'User-Agent': 'school-cashbox-updater' },
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          const release = JSON.parse(data);
          resolve({
            version: (release.tag_name || '').replace(/^v/, ''),
            tagName: release.tag_name,
            htmlUrl: release.html_url,
            publishedAt: release.published_at,
            assets: (release.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })),
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function compareVersions(current, latest) {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return 1;  // latest is newer
    if (lv < cv) return -1; // current is newer
  }
  return 0; // equal
}

// ── Download update via electron-updater ────────────────────────
function downloadAvailableUpdate() {
  if (!autoUpdater || updateCheckInProgress) return;
  updateCheckInProgress = true;
  updateState(currentMainWindow, 'downloading', currentUpdateState.version, 0);
  logInfo('Starting update download', { version: currentUpdateState.version });

  autoUpdater.downloadUpdate().catch((err) => {
    updateCheckInProgress = false;
    updateState(currentMainWindow, 'error', currentUpdateState.version, 0);
    logError('Failed to download update', err);
    dialog.showMessageBox(currentMainWindow, {
      type: 'error',
      title: 'خطأ في تنزيل التحديث',
      message: `تعذر تنزيل التحديث:\n${err.message}`,
      buttons: ['حسناً'],
    });
  });
}

// ── Setup auto-updater listeners ────────────────────────────────
function setupAutoUpdater(mainWindow) {
  currentMainWindow = mainWindow;

  if (!autoUpdater) {
    console.warn('Auto-updater is not available, will use GitHub API fallback.');
    return;
  }

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
    autoUpdater.disableDifferentialDownload = true;

    autoUpdater.removeAllListeners();

    autoUpdater.on('checking-for-update', () => {
      updateCheckInProgress = true;
      updateState(mainWindow, 'checking', '', 0);
      logInfo('Checking for updates...', { currentVersion: app.getVersion() });
    });

    autoUpdater.on('update-available', (info) => {
      updateCheckInProgress = false;
      updateState(mainWindow, 'available', info.version, 0);
      logInfo('Update available', info);
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'تحديث متوفر',
        message: `يتوفر إصدار جديد (${info.version}).\nالإصدار الحالي: ${app.getVersion()}\n\nهل تريد تحميله وتثبيته الآن؟`,
        buttons: ['نعم، حدّث الآن', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) downloadAvailableUpdate();
      }).catch(err => logError('Dialog error', err));
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
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'التحديث جاهز',
        message: `تم تحميل الإصدار ${info.version} بنجاح.\nسيتم إعادة تشغيل البرنامج لتثبيت التحديث.`,
        buttons: ['أعد التشغيل الآن', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall(false, true);
      }).catch(err => logError('Dialog error', err));
    });

    autoUpdater.on('error', (err) => {
      updateCheckInProgress = false;
      logError('electron-updater error, trying GitHub API fallback', err);
      // Fallback to direct GitHub API
      checkViaGitHubAPI(true);
    });
  } catch (err) {
    logError('Failed to initialize auto updater', err);
  }
}

// ── GitHub API fallback check ───────────────────────────────────
async function checkViaGitHubAPI(showDialog = true) {
  const currentVersion = app.getVersion();
  logInfo('Checking updates via GitHub API', { currentVersion });
  updateState(currentMainWindow, 'checking', '', 0);

  try {
    const release = await checkGitHubReleaseDirect();
    logInfo('GitHub API response', release);

    if (!release.version) {
      updateState(currentMainWindow, 'error', '', 0);
      if (showDialog) {
        dialog.showMessageBox(currentMainWindow, {
          type: 'warning',
          title: 'تحقق التحديث',
          message: 'لم يتم العثور على إصدارات منشورة على GitHub.',
          buttons: ['حسناً'],
        });
      }
      return;
    }

    const cmp = compareVersions(currentVersion, release.version);

    if (cmp > 0) {
      updateState(currentMainWindow, 'available', release.version, 0);
      const setupAsset = release.assets.find(a => a.name.endsWith('.exe') && a.name.includes('Setup'));
      
      const message = [
        `يتوفر إصدار جديد: ${release.version}`,
        `الإصدار الحالي: ${currentVersion}`,
        `تاريخ النشر: ${release.publishedAt ? new Date(release.publishedAt).toLocaleDateString('ar') : 'غير معروف'}`,
        '',
        setupAsset
          ? `حجم الملف: ${(setupAsset.size / (1024 * 1024)).toFixed(1)} MB`
          : 'لم يتم العثور على ملف التثبيت.',
        '',
        'هل تريد فتح صفحة التحميل؟',
      ].join('\n');

      const { response } = await dialog.showMessageBox(currentMainWindow, {
        type: 'info',
        title: 'تحديث متوفر',
        message,
        buttons: ['فتح صفحة التحميل', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        const url = setupAsset ? setupAsset.url : release.htmlUrl;
        shell.openExternal(url);
      }
    } else {
      updateState(currentMainWindow, 'not-available', '', 0);
      if (showDialog) {
        dialog.showMessageBox(currentMainWindow, {
          type: 'info',
          title: 'لا يوجد تحديث',
          message: `أنت تستخدم أحدث إصدار (${currentVersion}).\n\nآخر إصدار على GitHub: ${release.version}`,
          buttons: ['حسناً'],
        });
      }
    }
  } catch (err) {
    updateCheckInProgress = false;
    updateState(currentMainWindow, 'error', '', 0);
    logError('GitHub API check failed', err);
    if (showDialog) {
      dialog.showMessageBox(currentMainWindow, {
        type: 'error',
        title: 'خطأ في التحقق',
        message: `تعذر الاتصال بـ GitHub:\n${err.message}\n\nالإصدار الحالي: ${currentVersion}`,
        buttons: ['حسناً'],
      });
    }
  } finally {
    updateCheckInProgress = false;
  }
}

// ── Public API ──────────────────────────────────────────────────
function checkForUpdates() {
  if (updateCheckInProgress) return;
  updateCheckInProgress = true;
  updateState(currentMainWindow, 'checking', '', 0);
  logInfo('Manual update check requested', { currentVersion: app.getVersion() });

  if (autoUpdater) {
    autoUpdater.checkForUpdates().catch((err) => {
      logError('electron-updater check failed, trying GitHub API', err);
      updateCheckInProgress = false;
      checkViaGitHubAPI(true);
    });
  } else {
    updateCheckInProgress = false;
    checkViaGitHubAPI(true);
  }
}

function checkForUpdatesSilent() {
  if (updateCheckInProgress) return;

  if (autoUpdater) {
    updateCheckInProgress = true;
    autoUpdater.checkForUpdates().catch((err) => {
      updateCheckInProgress = false;
      logError('Silent check failed, trying GitHub API silently', err);
      checkViaGitHubAPI(false);
    });
  } else {
    checkViaGitHubAPI(false);
  }
}

function runUpdateAction() {
  if (!autoUpdater) {
    checkViaGitHubAPI(true);
    return;
  }

  if (currentUpdateState.status === 'downloaded') {
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
