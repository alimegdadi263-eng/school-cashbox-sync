const { contextBridge, ipcRenderer } = require('electron');

let appVersion = '2.6.2';
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

  // ── LAN Network APIs ──
  lan: {
    /** Start as server */
    startServer: () => ipcRenderer.invoke('lan-start-server'),
    /** Stop server */
    stopServer: () => ipcRenderer.invoke('lan-stop-server'),
    /** Get server info (IPs, port, running status) */
    getServerInfo: () => ipcRenderer.invoke('lan-get-server-info'),
    /** Connect to a server as client */
    connect: (ip, port) => ipcRenderer.invoke('lan-connect', ip, port),
    /** Disconnect client */
    disconnect: () => ipcRenderer.invoke('lan-disconnect'),
    /** Get current network mode */
    getMode: () => ipcRenderer.invoke('lan-get-mode'),
    /** Get data from server */
    getData: (key) => ipcRenderer.invoke('lan-get-data', key),
    /** Set data on server */
    setData: (key, data) => ipcRenderer.invoke('lan-set-data', key, data),
    /** Ping server */
    ping: () => ipcRenderer.invoke('lan-ping'),
    /** Check if connected */
    isConnected: () => ipcRenderer.invoke('lan-is-connected'),
  },
});
