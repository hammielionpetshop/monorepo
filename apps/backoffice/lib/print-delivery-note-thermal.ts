// Satu pintu cetak Surat Jalan ke printer termal: coba QZ Tray (raw ESC/POS, tanpa
// dialog), jatuh ke cetak browser bila QZ tak ada. Pola sama dengan BPB & settlement.

import type { DeliveryNoteData } from '@/lib/delivery-note-layout'
import { buildDeliveryNoteThermalEscpos } from '@/lib/escpos-delivery-note'
import { printThermalRawViaQz } from '@/lib/qz-thermal'

export type DeliveryNotePrintRoute = 'qz' | 'browser'

/** `printViaBrowser` dipanggil hanya bila jalur QZ gagal. */
export async function printDeliveryNoteThermal(
  data: DeliveryNoteData,
  printViaBrowser: () => void
): Promise<DeliveryNotePrintRoute> {
  try {
    await printThermalRawViaQz(buildDeliveryNoteThermalEscpos(data))
    return 'qz'
  } catch (err) {
    console.error('[Surat Jalan] Cetak termal via QZ Tray gagal:', err)
    printViaBrowser()
    return 'browser'
  }
}
