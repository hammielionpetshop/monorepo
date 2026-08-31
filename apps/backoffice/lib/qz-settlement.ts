// Kirim laporan settlement shift ke printer termal 80mm via QZ Tray (raw ESC/POS).
// Plumbing koneksi QZ ada di `lib/qz-thermal.ts`; penyusun perintah di `lib/escpos-settlement.ts`.

import { buildSettlementEscpos, type SettlementPrintData } from '@/lib/escpos-settlement'
import { printThermalRawViaQz } from '@/lib/qz-thermal'

export type { SettlementPrintData } from '@/lib/escpos-settlement'

/**
 * Kirim laporan settlement sebagai raw ESC/POS. Melempar bila QZ Tray tak terpasang/aktif
 * atau printer tak ditemukan — pemanggil WAJIB menangkapnya dan jatuh ke `window.print()`.
 */
export function printSettlementViaQz(data: SettlementPrintData): Promise<void> {
  return printThermalRawViaQz(buildSettlementEscpos(data))
}
