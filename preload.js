const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  version: '0.3.0',
  platform: process.platform
});
