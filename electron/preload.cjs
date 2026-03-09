const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appName: 'مالية المدارس - Ali Megdadi',
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
});
