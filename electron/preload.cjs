const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appName: 'مالية المدارس - Ali Megdadi',
});
