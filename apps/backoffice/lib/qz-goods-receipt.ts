// Kirim Bukti Penerimaan Barang (BPB) transfer internal ke printer termal 80mm via QZ Tray
// (raw ESC/POS). Plumbing koneksi QZ di `lib/qz-thermal.ts`; penyusun di `lib/escpos-goods-receipt.ts`.

import { buildGoodsReceiptEscpos, type GoodsReceiptData } from '@/lib/escpos-goods-receipt'
import { printThermalRawViaQz } from '@/lib/qz-thermal'

export type { GoodsReceiptData, GoodsReceiptItem } from '@/lib/escpos-goods-receipt'

/**
 * Kirim BPB sebagai raw ESC/POS. Melempar bila QZ Tray tak terpasang/aktif atau printer
 * tak ditemukan — pemanggil WAJIB menangkapnya dan jatuh ke `window.print()`.
 */
export function printGoodsReceiptViaQz(data: GoodsReceiptData): Promise<void> {
  return printThermalRawViaQz(buildGoodsReceiptEscpos(data))
}
