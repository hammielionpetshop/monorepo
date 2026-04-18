"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  },
  // You can expose other APTs you need here.
  secureStorage: {
    set: (key, value) => electron.ipcRenderer.invoke("secure-storage:set", key, value),
    get: (key) => electron.ipcRenderer.invoke("secure-storage:get", key),
    remove: (key) => electron.ipcRenderer.invoke("secure-storage:remove", key)
  },
  printer: {
    printReceipt: (payload) => electron.ipcRenderer.invoke("printer:print", payload)
  }
});
