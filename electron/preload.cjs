const { contextBridge, ipcRenderer } = require('electron');

let appVersion = '2.0.1';
try {
  const pkg = require('../package.json');
  appVersion = pkg.version || appVersion;
} catch {}

contextBridge.exposeInMainWorld('electronAPI', {
  appName: 'الادارة المدرسية - Ali Megdadi',
  appVersion,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  runUpdateAction: () => ipcRenderer.send('run-update-action'),
  onUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
});
