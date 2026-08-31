// Satu pintu cetak Bukti Penerimaan Barang transfer internal: coba QZ Tray (raw ESC/POS,
// tanpa dialog), jatuh ke cetak browser bila QZ tak ada. Pola sama dengan struk & settlement.

import { printGoodsReceiptViaQz, type GoodsReceiptData } from '@/lib/qz-goods-receipt'

export type { GoodsReceiptData, GoodsReceiptItem } from '@/lib/qz-goods-receipt'

export type GoodsReceiptPrintRoute = 'qz' | 'browser'

/**
 * `printViaBrowser` dipanggil hanya bila jalur QZ gagal — biasanya `window.print()` milik
 * pemanggil (komponen `ReceivingNotePrint` yang sudah ter-mount).
 */
export async function printGoodsReceipt(
  data: GoodsReceiptData,
  printViaBrowser: () => void
): Promise<GoodsReceiptPrintRoute> {
  try {
    await printGoodsReceiptViaQz(data)
    return 'qz'
  } catch {
    printViaBrowser()
    return 'browser'
  }
}
