// Satu pintu cetak struk untuk semua pemanggil: coba QZ Tray (raw ESC/POS, tanpa dialog),
// jatuh ke cetak browser bila QZ tak ada. Pola yang sama dipakai surat jalan.
//
// Dipusatkan di sini supaya tiap pemanggil cukup satu baris dan tidak ada yang lupa
// memasang fallback — struk harus tetap bisa keluar di stasiun tanpa QZ Tray.

import { printReceiptViaQz, probeQzAvailability } from '@/lib/qz-receipt'
import { toReceiptPrintData, type ReceiptSource } from '@/lib/receipt-data'

export type { ReceiptSource } from '@/lib/receipt-data'
export { probeQzAvailability } from '@/lib/qz-receipt'

export type ReceiptPrintRoute = 'qz' | 'browser'

/**
 * `printViaBrowser` dipanggil hanya bila jalur QZ gagal — biasanya berisi
 * `setState(mode) + window.print()` milik pemanggil.
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
  void probeQzAvailability()
}
