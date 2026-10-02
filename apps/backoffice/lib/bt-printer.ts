// Kirim raw ESC/POS ke printer termal Bluetooth (BLE) langsung dari browser lewat Web
// Bluetooth — jalur cetak untuk HP Android, tempat QZ Tray tidak bisa berjalan.
//
// Penyusun perintahnya sama dengan jalur QZ (`lib/escpos-*.ts`); modul ini hanya
// transport. Hanya didukung Chrome Android/desktop di halaman HTTPS (atau localhost);
// Safari iOS tidak punya Web Bluetooth sama sekali.
//
// Semua fungsi yang menyentuh `navigator` hanya boleh dipanggil di sisi klien.

/**
 * Service BLE yang lazim dipakai printer termal klon. Web Bluetooth hanya mengizinkan
 * akses ke service yang disebut di `optionalServices` saat pemasangan, jadi printer
 * yang memakai service di luar daftar ini akan tersambung tapi tidak bisa ditulisi —
 * tambahkan UUID-nya di sini (cek pakai app nRF Connect).
 */
export const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
]

/**
 * Ukuran satu kali tulis. Chrome Android biasanya menegosiasikan MTU besar, tapi banyak
 * printer klon membuang data bila satu paket kebesaran — 100 byte aman di hampir semua.
 */
export const BT_CHUNK_SIZE = 100

/** Jeda antar-potongan saat menulis tanpa respons, supaya buffer printer tidak meluap. */
const WRITE_WITHOUT_RESPONSE_DELAY_MS = 20

const STORAGE_KEY = 'struk_bt_printer'

// ---- Tipe Web Bluetooth minimal (tanpa @types/web-bluetooth) ----

interface BtCharacteristic {
  uuid: string
  properties: { write: boolean; writeWithoutResponse: boolean }
  writeValueWithResponse?: (value: BufferSource) => Promise<void>
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>
  writeValue: (value: BufferSource) => Promise<void>
}

interface BtService {
  uuid: string
  getCharacteristics: () => Promise<BtCharacteristic[]>
}

interface BtGattServer {
  connected: boolean
  connect: () => Promise<BtGattServer>
  disconnect: () => void
  getPrimaryServices: () => Promise<BtService[]>
}

interface BtDevice {
  id: string
  name?: string
  gatt?: BtGattServer
}

interface BtNavigator {
  requestDevice: (opts: { acceptAllDevices: boolean; optionalServices: string[] }) => Promise<BtDevice>
  getDevices?: () => Promise<BtDevice[]>
}

function getBluetooth(): BtNavigator | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as unknown as { bluetooth?: BtNavigator }).bluetooth ?? null
}

// ---- Fungsi murni (diuji) ----

/**
 * String ESC/POS → byte. Penyusun kita sudah menyaring teks ke ASCII cetak
 * (`toPrintableAscii`), sisanya byte perintah 0x00–0xFF, jadi kode karakter = byte.
 * Ini setara dengan encoding CP437 yang dipakai jalur QZ untuk rentang tersebut.
 */
export function escposToBytes(data: string): Uint8Array {
  const bytes = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xff
  return bytes
}

export function chunkBytes(bytes: Uint8Array, size = BT_CHUNK_SIZE): Uint8Array[] {
  if (size <= 0) throw new Error('Ukuran potongan harus lebih dari 0')
  const chunks: Uint8Array[] = []
  for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.subarray(i, i + size))
  return chunks
}

// ---- Status perangkat ----

interface StoredPrinter {
  id: string
  name: string
}

function readStored(): StoredPrinter | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredPrinter) : null
  } catch {
    return null
  }
}

function writeStored(value: StoredPrinter | null): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage bisa dilarang (mode privat); printer tetap terpakai selama halaman hidup.
  }
}

let device: BtDevice | null = null
let characteristic: BtCharacteristic | null = null
// Cetak diantrekan: dua struk yang dikirim bersamaan akan saling menyela di kertas.
let queue: Promise<unknown> = Promise.resolve()

export function isBluetoothSupported(): boolean {
  return getBluetooth() !== null
}

/**
 * Perangkat ini pernah dipasangkan ke printer Bluetooth. Dipakai `printReceipt` untuk
 * memilih jalur: HP ber-printer BT tidak perlu mencoba QZ (pasti gagal, dan menunggu
 * timeout-nya di tiap struk).
 */
export function isBluetoothPrinterConfigured(): boolean {
  return readStored() !== null
}

export function getBluetoothPrinterName(): string | null {
  return readStored()?.name ?? null
}

/** Printer sudah siap tulis tanpa perlu pemasangan ulang (yang butuh ketukan user). */
export function isBluetoothPrinterReady(): boolean {
  return device !== null
}

async function findWritableCharacteristic(server: BtGattServer): Promise<BtCharacteristic> {
  const services = await server.getPrimaryServices()
  for (const service of services) {
    const chars = await service.getCharacteristics()
    const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse)
    if (writable) return writable
  }
  throw new Error('Printer tersambung, tapi tidak ditemukan saluran tulis yang dikenal')
}

async function ensureConnected(): Promise<BtCharacteristic> {
  if (!device?.gatt) {
    throw new Error('Printer Bluetooth belum tersambung — ketuk ikon printer untuk memasangkan ulang')
  }
  if (!device.gatt.connected) {
    characteristic = null
    await device.gatt.connect()
  }
  if (!characteristic) characteristic = await findWritableCharacteristic(device.gatt)
  return characteristic
}

/**
 * Buka dialog pilih perangkat Chrome. WAJIB dipanggil langsung dari handler ketukan —
 * Chrome menolak `requestDevice` di luar gestur user.
 */
export async function pairBluetoothPrinter(): Promise<string> {
  const bt = getBluetooth()
  if (!bt) throw new Error('Browser ini tidak mendukung Bluetooth — pakai Chrome di Android')

  const picked = await bt.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICE_UUIDS })
  if (!picked.gatt) throw new Error('Perangkat ini tidak bisa disambungkan')

  device = picked
  characteristic = null
  await ensureConnected()

  const name = picked.name || 'Printer Bluetooth'
  writeStored({ id: picked.id, name })
  return name
}

/**
 * Pulihkan printer yang izinnya sudah diberikan sebelumnya, tanpa dialog. Hanya
 * berhasil bila Chrome menyediakan `getDevices()` (izin Bluetooth persisten); bila tidak,
 * kasir harus mengetuk ikon printer sekali setelah halaman dimuat ulang.
 */
export async function restoreBluetoothPrinter(): Promise<boolean> {
  if (device) return true
  const stored = readStored()
  const bt = getBluetooth()
  if (!stored || !bt?.getDevices) return false
  try {
    const known = await bt.getDevices()
    const match = known.find((d) => d.id === stored.id)
    if (!match) return false
    device = match
    return true
  } catch {
    return false
  }
}

export function forgetBluetoothPrinter(): void {
  try {
    device?.gatt?.disconnect()
  } catch {
    // sudah putus
  }
  device = null
  characteristic = null
  writeStored(null)
}

async function writeAll(target: BtCharacteristic, bytes: Uint8Array): Promise<void> {
  const withResponse = target.properties.write
  for (const chunk of chunkBytes(bytes)) {
    // `slice()` supaya tiap potongan punya ArrayBuffer sendiri — sebagian implementasi
    // mengirim seluruh buffer induk bila diberi subarray.
    const value = chunk.slice()
    if (withResponse) {
      await (target.writeValueWithResponse ?? target.writeValue).call(target, value)
    } else {
      await (target.writeValueWithoutResponse ?? target.writeValue).call(target, value)
      await new Promise((r) => setTimeout(r, WRITE_WITHOUT_RESPONSE_DELAY_MS))
    }
  }
}

/**
 * Kirim string ESC/POS ke printer. Melempar bila printer belum tersambung atau putus di
 * tengah jalan — pemanggil yang memutuskan cara memberi tahu kasir.
 */
export function printEscposViaBluetooth(data: string): Promise<void> {
  const job = queue.then(async () => {
    if (!device) await restoreBluetoothPrinter()
    let target: BtCharacteristic
    try {
      target = await ensureConnected()
    } catch (error) {
      characteristic = null
      throw error
    }
    try {
      await writeAll(target, escposToBytes(data))
    } catch (error) {
      characteristic = null
      throw new Error(
        'Gagal mengirim ke printer Bluetooth' + (error instanceof Error ? `: ${error.message}` : '')
      )
    }
  })
  queue = job.catch(() => undefined)
  return job
}
