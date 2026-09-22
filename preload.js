const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scriptura', {
  outputs: {
    getDisplays: () => ipcRenderer.invoke('outputs:get-displays'),
    getStatus: () => ipcRenderer.invoke('outputs:get-status'),
    getSettings: () => ipcRenderer.invoke('outputs:get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('outputs:save-settings', settings),
    openMain: (displayId) => ipcRenderer.invoke('outputs:open-main', displayId),
    closeMain: () => ipcRenderer.invoke('outputs:close-main'),
    openAlternate: (displayId) => ipcRenderer.invoke('outputs:open-alternate', displayId),
    closeAlternate: () => ipcRenderer.invoke('outputs:close-alternate'),
    onDisplaysChanged: (callback) => {
      const handler = (_event, displays) => callback(displays);
      ipcRenderer.on('outputs:displays-changed', handler);
      return () => ipcRenderer.removeListener('outputs:displays-changed', handler);
    },
    onStatusChanged: (callback) => {
      const handler = (_event, status) => callback(status);
      ipcRenderer.on('outputs:status-changed', handler);
      return () => ipcRenderer.removeListener('outputs:status-changed', handler);
    },
  },
});

contextBridge.exposeInMainWorld('electron', {
  launchProjector: () => ipcRenderer.send('launch-projector'),
});

