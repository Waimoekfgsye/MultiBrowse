const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  auth: {
    setToken: (token) => ipcRenderer.invoke('auth-set-token', token),
    getToken: () => ipcRenderer.invoke('auth-get-token'),
    clearToken: () => ipcRenderer.invoke('auth-clear-token'),
  },

  camoufox: {
    checkInstalled: () => ipcRenderer.invoke('camoufox-check-installed'),
    launch: (profileId, config) => ipcRenderer.invoke('camoufox-launch', profileId, config),
    stop: (profileId) => ipcRenderer.invoke('camoufox-stop', profileId),
    listActive: () => ipcRenderer.invoke('camoufox-list-active'),
    download: () => ipcRenderer.invoke('camoufox-download'),
    onDownloadProgress: (callback) => {
      ipcRenderer.on('camoufox-download-progress', (_, data) => callback(data));
    },
    onProfileStopped: (callback) => {
      ipcRenderer.on('camoufox-profile-stopped', (_, profileId) => callback(profileId));
    },
  },

  quit: () => ipcRenderer.send('app-quit'),
});
