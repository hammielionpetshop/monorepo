// Satu pintu cetak laporan settlement shift: coba QZ Tray (raw ESC/POS, tanpa dialog),
// jatuh ke cetak browser bila QZ tak ada. Pola yang sama dipakai struk & surat jalan.

import { printSettlementViaQz, type SettlementPrintData } from '@/lib/qz-settlement'

export type { SettlementPrintData } from '@/lib/qz-settlement'

export type SettlementPrintRoute = 'qz' | 'browser'

/**
 * `printViaBrowser` dipanggil hanya bila jalur QZ gagal — biasanya berisi `window.print()`
 * milik pemanggil (komponen `SettlementPrint` yang sudah ter-mount).
 */
export async function printSettlement(
  data: SettlementPrintData,
  printViaBrowser: () => void
): Promise<SettlementPrintRoute> {
  try {
    await printSettlementViaQz(data)
    return 'qz'
  } catch {
    printViaBrowser()
    return 'browser'
  }
}
