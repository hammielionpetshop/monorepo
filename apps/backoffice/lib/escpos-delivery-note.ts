/**
 * Surat Jalan / Nota Penjualan untuk printer termal 80mm (ESC/POS). Isi barisnya sama
 * persis dengan versi dot-matrix (`lib/delivery-note-layout.ts`) — Font B 80mm = 56
 * kolom, sama dengan NOTE_WIDTH — hanya tanpa pemecahan lembar.
 *
 * Dipakai kasir POS yang hanya punya printer termal (Surat Jalan PO Internal).
 */

import { buildDeliveryNoteRoll, type DeliveryNoteData } from '@/lib/delivery-note-layout'
import {
  BOLD_OFF,
  BOLD_ON,
  CODEPAGE_CP437,
  FEED_AND_CUT,
  INIT,
  LF,
  SELECT_FONT_B,
  SIZE_NORMAL,
  SIZE_WIDE,
  toPrintableAscii,
} from '@/lib/escpos-common'

// Bersihkan teks bebas SEBELUM disusun ke kolom: membuang karakter non-ASCII setelah
// baris jadi akan menggeser kolom di kanannya.
function sanitize(data: DeliveryNoteData): DeliveryNoteData {
  const clean = (v: string | null | undefined) => (v == null ? v : toPrintableAscii(v))
  return {
    ...data,
    customerName: toPrintableAscii(data.customerName),
    customerPhone: clean(data.customerPhone),
    customerAddress: clean(data.customerAddress),
    staffName: clean(data.staffName) ?? undefined,
    items: data.items.map((item) => ({
      ...item,
      productName: toPrintableAscii(item.productName),
      uomCode: toPrintableAscii(item.uomCode),
    })),
  }
}

export function buildDeliveryNoteThermalEscpos(data: DeliveryNoteData): string {
  const body = buildDeliveryNoteRoll(sanitize(data))
    .map((line) => {
      let text = line.text
      if (line.wide) text = SIZE_WIDE + text + SIZE_NORMAL
      if (line.bold) text = BOLD_ON + text + BOLD_OFF
      return text + LF
    })
    .join('')
  return INIT + CODEPAGE_CP437 + SELECT_FONT_B + body + FEED_AND_CUT
}
