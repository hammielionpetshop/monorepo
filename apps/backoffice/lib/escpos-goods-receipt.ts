/**
 * Penyusun Bukti Penerimaan Barang (BPB) transfer internal antar-cabang sebagai perintah
 * ESC/POS untuk printer termal 80mm. Primitif ESC/POS & helper dari `lib/escpos-common.ts`.
 *
 * Isinya harus setara komponen
 * `app/pos/(authenticated)/incoming-transfers/_components/receiving-note-print.tsx`
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

export interface GoodsReceiptItem {
  productName: string | null
  productSku: string | null
  uomCode: string | null
  qtyShipped: number
  qtyReceived: number
  notes: string | null
}

export interface GoodsReceiptData {
  ibtNumber: string
  sourceBranchName: string | null
  destinationBranchName: string
  receivedByName: string
  receivedAt: Date | string
  items: GoodsReceiptItem[]
  storeName?: string
  isReprint?: boolean
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

export function buildGoodsReceiptEscpos(data: GoodsReceiptData): string {
  const storeName = data.storeName || 'HAMMIELION'
  const received = data.items.filter((i) => i.qtyReceived > 0)

  const out: string[] = []
  out.push(INIT, CODEPAGE_CP437, SELECT_FONT_B)

  // Kop
  out.push(ALIGN_CENTER, BOLD_ON, SIZE_TALL)
  out.push(toPrintableAscii(storeName) + LF)
  out.push(SIZE_NORMAL)
  out.push('BUKTI PENERIMAAN BARANG' + LF)
  out.push(BOLD_OFF)
  out.push('Transfer Internal Antar-Cabang' + LF)
  if (data.isReprint) out.push(BOLD_ON + '*** CETAK ULANG ***' + BOLD_OFF + LF)
  out.push(ALIGN_LEFT)
  out.push(divider() + LF)

  // Info
  out.push(truncate('No: ' + data.ibtNumber, COLUMNS) + LF)
  out.push(truncate('Tgl: ' + fmtDateTime(data.receivedAt), COLUMNS) + LF)
  for (const line of wrap('Dari: ' + (data.sourceBranchName ?? '-'))) out.push(line + LF)
  for (const line of wrap('Ke: ' + data.destinationBranchName)) out.push(line + LF)
  for (const line of wrap('Penerima: ' + data.receivedByName)) out.push(line + LF)
  out.push(divider() + LF)

  // Item
  for (const item of received) {
    const uom = toPrintableAscii(item.uomCode ?? '')
    for (const line of wrap(item.productName ?? '-')) out.push(line + LF)
    if (item.productSku) out.push(truncate(item.productSku, COLUMNS) + LF)
    out.push(labelAmount(`Kirim: ${item.qtyShipped} ${uom}`.trim(), `Terima: ${item.qtyReceived} ${uom}`.trim()) + LF)
    const selisih = item.qtyShipped - item.qtyReceived
    if (selisih > 0) {
      out.push(`  Selisih: -${selisih} ${uom}`.trimEnd() + LF)
      if (item.notes) for (const line of wrap('  Alasan: ' + item.notes, COLUMNS)) out.push(line + LF)
    }
  }
  out.push(divider() + LF)

  // Ringkasan
  out.push(BOLD_ON + labelAmount('Total Jenis Barang', String(received.length)) + BOLD_OFF + LF)

  // Tanda tangan
  out.push(LF + LF)
  out.push(centerLine('Penerima,') + LF)
  out.push(LF + LF)
  out.push(centerLine('( ____________________ )') + LF)
  out.push(divider() + LF)
  out.push(centerLine('Dokumen bukti serah-terima') + LF)
  out.push(centerLine('barang transfer internal.') + LF)

  out.push(FEED_AND_CUT)
  return out.join('')
}
