const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, input) => input === undefined ? ipcRenderer.invoke(channel) : ipcRenderer.invoke(channel, input);

contextBridge.exposeInMainWorld('parsyuvaGold', Object.freeze({
  getStatus: () => invoke('gold:durum'),
  prepareVault: () => invoke('gold:kasa-hazirla'),
  provisionTrust: () => invoke('gold:guven-yapilandir'),
  captureDeviceBinding: () => invoke('gold:cihaz-bagi-al'),
  generateActivation: (input) => invoke('gold:kod-uret', input),
  installActivation: () => invoke('gold:aktivasyonu-kur')
}));
