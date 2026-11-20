const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vidora', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  appInfo: () => ipcRenderer.invoke('app:info'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  ollamaTags: (host) => ipcRenderer.invoke('ollama:tags', host),
  chat: (payload) => ipcRenderer.invoke('ollama:chat', payload),
  abort: (requestId) => ipcRenderer.send('ollama:abort', requestId),
  onToken: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('ollama:token', handler);
    return () => ipcRenderer.removeListener('ollama:token', handler);
  }
});
