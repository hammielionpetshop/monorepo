/**
 * Penyusun Bukti Penerimaan Barang (BPB) dari Purchase Order supplier sebagai perintah
 * ESC/POS untuk printer termal 80mm. Primitif ESC/POS & helper dari `lib/escpos-common.ts`.
 *
 * Isinya harus setara komponen
 * `app/(dashboard)/purchase-orders/[id]/_components/po-receiving-note-print.tsx`
 * (jalur cadangan `window.print()`).
 *
 * Sengaja bebas dari QZ Tray maupun DOM supaya keluarannya bisa diuji sebagai string biasa.
 */

import { formatWIB } from '@petshop/shared'
import {
  ALIGN_CENTER,
  ALIGN_LEFT,
  BOLD_OFF,
  BOLD_ON,
  CODEPAGE_CP437,
  FEED_AND_CUT,
  INIT,
  LF,
  SELECT_FONT_B,
  SIZE_NORMAL,
  SIZE_TALL,
  THERMAL_COLUMNS as COLUMNS,
  divider,
  labelAmount,
  toPrintableAscii,
  truncate,
  wrap,
} from '@/lib/escpos-common'

export interface PoReceiptItem {
  productName: string | null
  productSku: string | null
  uomCode: string | null
  qtyReceived: number
  qtyDamaged: number
}

export interface PoReceiptData {
  poNumber: string
  supplierName: string
  branchName: string
  receivedByName: string
  receivedAt: Date | string
  note: string | null
  items: PoReceiptItem[]
  storeName?: string
}

function fmtDateTime(date: Date | string): string {
  return formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function centerLine(text: string): string {
  const t = truncate(text, COLUMNS)
  const pad = Math.max(0, Math.floor((COLUMNS - t.length) / 2))
  return ' '.repeat(pad) + t
}

export function buildPoReceiptEscpos(data: PoReceiptData): string {
  const storeName = data.storeName || 'HAMMIELION'

  const out: string[] = []
  out.push(INIT, CODEPAGE_CP437, SELECT_FONT_B)

  // Kop
  out.push(ALIGN_CENTER, BOLD_ON, SIZE_TALL)
  out.push(toPrintableAscii(storeName) + LF)
  out.push(SIZE_NORMAL)
  out.push('BUKTI PENERIMAAN BARANG' + LF)
  out.push(BOLD_OFF)
  out.push('Purchase Order dari Supplier' + LF)
  out.push(ALIGN_LEFT)
  out.push(divider() + LF)

  // Info
  out.push(truncate('No PO: ' + data.poNumber, COLUMNS) + LF)
  out.push(truncate('Tgl: ' + fmtDateTime(data.receivedAt), COLUMNS) + LF)
  for (const line of wrap('Supplier: ' + data.supplierName)) out.push(line + LF)
  for (const line of wrap('Cabang: ' + data.branchName)) out.push(line + LF)
  for (const line of wrap('Penerima: ' + data.receivedByName)) out.push(line + LF)
  out.push(divider() + LF)

  // Item
  for (const item of data.items) {
    const uom = toPrintableAscii(item.uomCode ?? '')
    for (const line of wrap(item.productName ?? '-')) out.push(line + LF)
    if (item.productSku) out.push(truncate(item.productSku, COLUMNS) + LF)
    if (item.qtyDamaged > 0) {
      out.push(
        labelAmount(`Terima: ${item.qtyReceived} ${uom}`.trim(), `Rusak: ${item.qtyDamaged} ${uom}`.trim()) + LF
      )
    } else {
      out.push(`Terima: ${item.qtyReceived} ${uom}`.trim() + LF)
    }
  }
  out.push(divider() + LF)

  // Ringkasan
  out.push(BOLD_ON + labelAmount('Total Jenis Barang', String(data.items.length)) + BOLD_OFF + LF)

  // Catatan
  if (data.note) {
    out.push(BOLD_ON + 'Catatan:' + BOLD_OFF + LF)
    for (const line of wrap(data.note)) out.push(line + LF)
  }

  // Tanda tangan
  out.push(LF + LF)
  out.push(centerLine('Penerima,') + LF)
  out.push(LF + LF)
  out.push(centerLine('( ____________________ )') + LF)
  out.push(divider() + LF)
  out.push(centerLine('Dokumen bukti serah-terima') + LF)
  out.push(centerLine('barang dari supplier.') + LF)

  out.push(FEED_AND_CUT)
  return out.join('')
}
