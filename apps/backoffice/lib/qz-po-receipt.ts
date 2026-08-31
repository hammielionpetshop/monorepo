// Kirim BPB Purchase Order supplier ke printer termal 80mm via QZ Tray (raw ESC/POS).
// Plumbing koneksi QZ di `lib/qz-thermal.ts`; penyusun di `lib/escpos-po-receipt.ts`.

import { buildPoReceiptEscpos, type PoReceiptData } from '@/lib/escpos-po-receipt'
import { printThermalRawViaQz } from '@/lib/qz-thermal'

export type { PoReceiptData, PoReceiptItem } from '@/lib/escpos-po-receipt'

/**
 * Kirim BPB PO sebagai raw ESC/POS. Melempar bila QZ Tray tak terpasang/aktif atau printer
 * tak ditemukan — pemanggil WAJIB menangkapnya dan jatuh ke `window.print()`.
 */
export function printPoReceiptViaQz(data: PoReceiptData): Promise<void> {
  return printThermalRawViaQz(buildPoReceiptEscpos(data))
}
