// Satu pintu cetak struk untuk semua pemanggil. Urutan jalur:
//   1. printer Bluetooth — hanya di perangkat yang pernah dipasangkan (HP Android)
//   2. QZ Tray (raw ESC/POS, tanpa dialog) — PC kasir
//   3. cetak browser — stasiun tanpa keduanya
//
// Dipusatkan di sini supaya tiap pemanggil cukup satu baris dan tidak ada yang lupa
// memasang fallback — struk harus tetap bisa keluar di stasiun tanpa QZ Tray.

import { toast } from 'sonner'
import { printReceiptViaQz, probeQzAvailability } from '@/lib/qz-receipt'
import { toReceiptPrintData, type ReceiptSource } from '@/lib/receipt-data'
import { buildReceiptEscpos } from '@/lib/escpos-receipt'
import {
  isBluetoothPrinterConfigured,
  printEscposViaBluetooth,
  restoreBluetoothPrinter,
} from '@/lib/bt-printer'

export type { ReceiptSource } from '@/lib/receipt-data'
export { probeQzAvailability } from '@/lib/qz-receipt'

export type ReceiptPrintRoute = 'bluetooth' | 'qz' | 'browser' | 'failed'

/**
 * `printViaBrowser` dipanggil hanya bila jalur QZ gagal — biasanya berisi
 * `setState(mode) + window.print()` milik pemanggil.
 *
 * Perangkat ber-printer Bluetooth TIDAK jatuh ke QZ maupun cetak browser saat gagal:
 * QZ pasti tidak ada di HP, dan dialog cetak yang muncul setelah setengah struk sempat
 * keluar dari printer BT membuat kasir mencetak dua kali. Cukup beri tahu, kasir
 * mengulang lewat tombol cetak.
 *
 * `forceRetry` diteruskan ke jalur QZ untuk aksi cetak yang dipicu user (cetak ulang):
 * abaikan status `unavailable` basi dari warm-up dan beri tenggang koneksi lebih panjang.
 * Cetak otomatis pasca-transaksi memanggil tanpa opsi ini supaya tetap di jalur cepat.
 */
export async function printReceipt(
  src: ReceiptSource,
  printViaBrowser: () => void,
  opts: { forceRetry?: boolean } = {}
): Promise<ReceiptPrintRoute> {
  if (isBluetoothPrinterConfigured()) {
    try {
      await printEscposViaBluetooth(buildReceiptEscpos(toReceiptPrintData(src)))
      return 'bluetooth'
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mencetak ke printer Bluetooth')
      return 'failed'
    }
  }

  try {
    await printReceiptViaQz(toReceiptPrintData(src), opts)
    return 'qz'
  } catch {
    printViaBrowser()
    return 'browser'
  }
}

/**
 * Panggil sekali saat halaman POS dimuat. Tanpa ini, cetak pertama di stasiun tanpa QZ
 * menanggung ongkos timeout koneksi — dan struk dicetak tiap transaksi, jadi jeda itu
 * terasa di setiap penjualan sampai hasil probe tersimpan.
 */
export function warmUpQz(): void {
  if (isBluetoothPrinterConfigured()) {
    void restoreBluetoothPrinter()
    return
  }
  void probeQzAvailability()
}
