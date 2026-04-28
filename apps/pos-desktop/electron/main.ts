import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'

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

const PRINTER_LABELS = {
  STORE_NAME: "HAMMIELION PETSHOP",
  STORE_TAGLINE: "Solusi Kebutuhan Hamster Anda",
  REPRINT_HEADER: "*** SALINAN STRUK ***",
  FOOTER_THANKS: "Terima Kasih Atas Kunjungan Anda",
  FOOTER_SOCIAL: "Follow IG: @hammielion",
  SETTLEMENT_HEADER: "LAPORAN SETTLEMENT SHIFT"
};

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
    const { items, totals, payments, trxNumber, isReprint } = payload;

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
    printer.println(PRINTER_LABELS.STORE_NAME);
    printer.bold(false);
    printer.setTextNormal();
    printer.println(PRINTER_LABELS.STORE_TAGLINE);
    printer.drawLine();

    if (isReprint) {
      printer.alignCenter()
      printer.bold(true)
      printer.println(PRINTER_LABELS.REPRINT_HEADER)
      printer.bold(false)
      printer.drawLine()
    }

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
    printer.println(PRINTER_LABELS.FOOTER_THANKS);
    printer.println(PRINTER_LABELS.FOOTER_SOCIAL);
    
    printer.cut();
    await printer.execute();
    return { success: true };
  } catch (err) {
    console.error('[Printer] Error:', err);
    return { success: false, error: (err as Error).message };
  }
})

ipcMain.handle('printer:print-settlement', async (_, payload: any) => {
  console.log('[Printer] Received settlement print payload');
  try {
    const { summary, copies = 1 } = payload;
    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'printer:Generic',
    });

    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      console.warn('[Printer] No physical printer found for settlement.');
      return { success: true, mocked: true };
    }

    for (let i = 0; i < copies; i++) {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.println(PRINTER_LABELS.SETTLEMENT_HEADER);
      printer.setTextNormal();
      printer.println(PRINTER_LABELS.STORE_NAME);
      printer.bold(false);
      printer.drawLine();

      printer.alignLeft();
      printer.println(`Shift #: ${summary.shiftNumber}`);
      printer.println(`Buka   : ${new Date(summary.openedAt).toLocaleString('id-ID')}`);
      printer.println(`Tutup  : ${new Date().toLocaleString('id-ID')}`);
      printer.println(`Status : CLOSED`);
      printer.drawLine();

      // Expenses
      if (summary.totalExpenses > 0) {
        printer.bold(true);
        printer.println("PENGELUARAN SHIFT:");
        printer.bold(false);
        // Note: In a real scenario, we might want to list individual expenses if summary has them
        printer.tableCustom([
          { text: "TOTAL PENGELUARAN", align: "LEFT", width: 0.6 },
          { text: summary.totalExpenses.toLocaleString('id-ID'), align: "RIGHT", width: 0.4 }
        ]);
        printer.drawLine();
      }

      // Cashier Breakdowns
      printer.bold(true);
      printer.println("DETAIL PER KASIR:");
      printer.bold(false);
      for (const b of summary.breakdowns) {
        printer.println(`- ${b.cashierName} (${b.totalTransactions} trx)`);
        printer.tableCustom([
          { text: "  Cash", align: "LEFT", width: 0.4 },
          { text: b.totalSalesCash.toLocaleString('id-ID'), align: "RIGHT", width: 0.6 }
        ]);
        printer.tableCustom([
          { text: "  Non-Cash", align: "LEFT", width: 0.4 },
          { text: (b.totalSalesQris + b.totalSalesDebit + b.totalSalesCredit).toLocaleString('id-ID'), align: "RIGHT", width: 0.6 }
        ]);
        printer.tableCustom([
          { text: "  Modal Awal", align: "LEFT", width: 0.4 },
          { text: b.openingCash.toLocaleString('id-ID'), align: "RIGHT", width: 0.6 }
        ]);
      }
      printer.drawLine();

      // Final Summary
      printer.bold(true);
      printer.println("RINGKASAN AKHIR:");
      printer.tableCustom([
        { text: "TOTAL EXPECTED CASH", align: "LEFT", width: 0.6 },
        { text: summary.totalExpectedCash.toLocaleString('id-ID'), align: "RIGHT", width: 0.4 }
      ]);
      printer.tableCustom([
        { text: "TOTAL REAL CASH", align: "LEFT", width: 0.6 },
        { text: summary.totalRealCash.toLocaleString('id-ID'), align: "RIGHT", width: 0.4 }
      ]);
      
      const variance = summary.totalRealCash - summary.totalExpectedCash;
      printer.tableCustom([
        { text: "SELISIH (VARIANCE)", align: "LEFT", width: 0.6 },
        { text: (variance >= 0 ? "+" : "") + variance.toLocaleString('id-ID'), align: "RIGHT", width: 0.4 }
      ]);
      printer.bold(false);
      printer.drawLine();

      if (summary.settlementNotes) {
        printer.println("Catatan:");
        printer.println(summary.settlementNotes);
        printer.newLine();
      }

      printer.newLine();
      printer.alignCenter();
      printer.tableCustom([
        { text: "Manager", align: "CENTER", width: 0.5 },
        { text: "Owner", align: "CENTER", width: 0.5 }
      ]);
      printer.newLine();
      printer.newLine();
      printer.tableCustom([
        { text: "( _________ )", align: "CENTER", width: 0.5 },
        { text: "( _________ )", align: "CENTER", width: 0.5 }
      ]);

      printer.cut();
    }

    await printer.execute();
    return { success: true };
  } catch (err) {
    console.error('[Printer] Settlement Error:', err);
    return { success: false, error: (err as Error).message };
  }
});

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
