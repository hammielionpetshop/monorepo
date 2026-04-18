import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// Secure Storage Logic
const APP_STORAGE_PATH = path.join(app.getPath('userData'), 'secure_config.json')

function getSecureConfig() {
  if (!fs.existsSync(APP_STORAGE_PATH)) return {}
  try {
    const raw = fs.readFileSync(APP_STORAGE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveSecureConfig(config: any) {
  fs.writeFileSync(APP_STORAGE_PATH, JSON.stringify(config))
}

// IPC Handlers
ipcMain.handle('secure-storage:set', (_, key: string, value: string) => {
  if (!safeStorage.isEncryptionAvailable()) return false
  const encrypted = safeStorage.encryptString(value).toString('base64')
  const config = getSecureConfig()
  config[key] = encrypted
  saveSecureConfig(config)
  return true
})

ipcMain.handle('secure-storage:get', (_, key: string) => {
  if (!safeStorage.isEncryptionAvailable()) return null
  const config = getSecureConfig()
  const encrypted = config[key]
  if (!encrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return null
  }
})

ipcMain.handle('secure-storage:remove', (_, key: string) => {
  const config = getSecureConfig()
  delete config[key]
  saveSecureConfig(config)
  return true
})

ipcMain.handle('printer:print', async (_, payload: any) => {
  console.log('[Printer] Received print payload:', payload.trxNumber);
  
  try {
    const { items, totals, payments, trxNumber } = payload;
    
    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'printer:Generic', // To be configured by user
    });

    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      console.warn('[Printer] No physical printer found. Previewing in logs...');
      return { success: true, mocked: true };
    }

    printer.alignCenter();
    printer.bold(true);
    printer.println("HAMMIELION PETSHOP");
    printer.bold(false);
    printer.setTextNormal();
    printer.println("Solusi Kebutuhan Hamster Anda");
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Trx: ${trxNumber}`);
    printer.println(`Tgl: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`);
    printer.drawLine();

    for (const item of items) {
      printer.println(item.productName);
      printer.tableCustom([
        { text: `${item.qty} ${item.uomCode} x ${item.unitPrice.toLocaleString('id-ID')}`, align: "LEFT", width: 0.6 },
        { text: item.subtotal.toLocaleString('id-ID'), align: "RIGHT", width: 0.4 }
      ]);
    }

    printer.drawLine();
    printer.tableCustom([
      { text: "GRAND TOTAL", align: "LEFT", width: 0.4 },
      { text: `Rp ${totals.grandTotal.toLocaleString('id-ID')}`, align: "RIGHT", width: 0.6 }
    ]);

    printer.newLine();
    printer.alignCenter();
    printer.println("Terima Kasih Atas Kunjungan Anda");
    printer.println("Follow IG: @hammielion");
    
    printer.cut();
    await printer.execute();
    return { success: true };
  } catch (err) {
    console.error('[Printer] Error:', err);
    return { success: false, error: (err as Error).message };
  }
})

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
