const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  version: '0.2.0',
  platform: process.platform
});
