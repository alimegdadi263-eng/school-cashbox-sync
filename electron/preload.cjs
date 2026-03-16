const { contextBridge, ipcRenderer } = require('electron');
const { app } = require('@electron/remote') || {};

// Get app version from package.json
let appVersion = '2.0.0';
try {
  const pkg = require('../package.json');
  appVersion = pkg.version || appVersion;
} catch {}

contextBridge.exposeInMainWorld('electronAPI', {
  appName: 'الادارة المدرسية - Ali Megdadi',
  appVersion,
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  runUpdateAction: () => ipcRenderer.send('run-update-action'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
});
