import { app, ipcMain, safeStorage, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
const APP_STORAGE_PATH = path.join(app.getPath("userData"), "secure_config.json");
function getSecureConfig() {
  if (!fs.existsSync(APP_STORAGE_PATH)) return {};
  try {
    const raw = fs.readFileSync(APP_STORAGE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveSecureConfig(config) {
  fs.writeFileSync(APP_STORAGE_PATH, JSON.stringify(config));
}
ipcMain.handle("secure-storage:set", (_, key, value) => {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const encrypted = safeStorage.encryptString(value).toString("base64");
  const config = getSecureConfig();
  config[key] = encrypted;
  saveSecureConfig(config);
  return true;
});
ipcMain.handle("secure-storage:get", (_, key) => {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const config = getSecureConfig();
  const encrypted = config[key];
  if (!encrypted) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return null;
  }
});
ipcMain.handle("secure-storage:remove", (_, key) => {
  const config = getSecureConfig();
  delete config[key];
  saveSecureConfig(config);
  return true;
});
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
