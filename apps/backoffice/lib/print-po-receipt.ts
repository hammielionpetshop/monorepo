// Satu pintu cetak BPB Purchase Order supplier: coba QZ Tray (raw ESC/POS, tanpa dialog),
// jatuh ke cetak browser bila QZ tak ada. Pola sama dengan struk & BPB transfer internal.

import { printPoReceiptViaQz, type PoReceiptData } from '@/lib/qz-po-receipt'

export type { PoReceiptData, PoReceiptItem } from '@/lib/qz-po-receipt'

export type PoReceiptPrintRoute = 'qz' | 'browser'

/**
 * `printViaBrowser` dipanggil hanya bila jalur QZ gagal — biasanya `window.print()` milik
 * pemanggil (komponen `POReceivingNotePrint` yang sudah ter-mount).
 */
export async function printPoReceipt(
  data: PoReceiptData,
  printViaBrowser: () => void
): Promise<PoReceiptPrintRoute> {
  try {
    await printPoReceiptViaQz(data)
    return 'qz'
  } catch {
    printViaBrowser()
    return 'browser'
  }
}
