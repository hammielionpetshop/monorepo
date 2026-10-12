/**
 * Penyusun karcis grooming sebagai perintah ESC/POS untuk printer termal 80mm. Tiap ekor kucing
 * mendapat DUA lembar: satu untuk konsumen (bukti ambil), satu untuk groomer (bukti bonus).
 * Isinya harus setara komponen `grooming-ticket-print.tsx` (jalur cadangan `window.print()`).
 *
 * Bebas dari QZ Tray maupun DOM supaya keluarannya bisa diuji sebagai string biasa.
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
  toPrintableAscii,
  wrap,
} from '@/lib/escpos-common'

export interface GroomingTicketData {
  storeName: string
  ticketNumber: string
  ownerName: string
  ownerPhone: string | null
  petName: string
  petSpecies: string
  petColor: string
  petAge: string
  serviceName: string
  groomerName: string
  condition: string
  receivedAt: Date | string
  /** true = nota sudah lunas; false = bayar saat ambil. */
  isPaid: boolean
  /** Delivery antar-jemput; null = diambil sendiri. */
  delivery: { courierName: string; address: string } | null
  isReprint: boolean
}

export type GroomingTicketCopy = 'KONSUMEN' | 'GROOMER'

const LABEL_WIDTH = 10

function fmtDateTime(date: Date | string): string {
  return formatWIB(date, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function field(label: string, value: string): string[] {
  const lines = wrap(value, COLUMNS - LABEL_WIDTH - 2)
  if (lines.length === 0) lines.push('-')
  return lines.map((line, i) => (i === 0 ? `${label.padEnd(LABEL_WIDTH)}: ${line}` : `${' '.repeat(LABEL_WIDTH + 2)}${line}`))
}

/** Baris-baris isi satu lembar karcis (tanpa perintah printer) — dipakai juga oleh tes. */
export function groomingTicketLines(data: GroomingTicketData, copy: GroomingTicketCopy): string[] {
  const pet = `${data.petName} (${data.petSpecies}, ${data.petColor}, ${data.petAge})`
  const lines: string[] = [
    ...field('No', data.ticketNumber),
    ...field('Masuk', fmtDateTime(data.receivedAt)),
    ...field('Kucing', pet),
    ...field('Jasa', data.serviceName),
  ]
  if (copy === 'KONSUMEN') {
    lines.push(...field('Pemilik', data.ownerPhone ? `${data.ownerName} ${data.ownerPhone}` : data.ownerName))
    lines.push(...field('Status', data.isPaid ? 'LUNAS' : 'BELUM BAYAR - bayar saat ambil'))
  } else {
    lines.push(...field('Groomer', data.groomerName))
    lines.push(...field('Pemilik', data.ownerName))
    lines.push(...field('Kondisi', data.condition))
  }
  if (data.delivery) {
    lines.push(...field('Delivery', `diantar ${data.delivery.courierName}`))
    lines.push(...field('Alamat', data.delivery.address))
  }
  return lines.map(toPrintableAscii)
}

function buildCopy(data: GroomingTicketData, copy: GroomingTicketCopy): string {
  const title = copy === 'KONSUMEN' ? 'BUKTI AMBIL KUCING' : 'KARCIS GROOMER'
  const footer = copy === 'KONSUMEN' ? 'Tunjukkan karcis ini saat mengambil kucing' : 'Bukti pengerjaan untuk groomer'
  let out = ALIGN_CENTER + BOLD_ON + SIZE_TALL + toPrintableAscii(data.storeName) + LF + SIZE_NORMAL
  out += toPrintableAscii(title) + LF + BOLD_OFF
  if (data.isReprint) out += BOLD_ON + '*** CETAK ULANG ***' + LF + BOLD_OFF
  out += ALIGN_LEFT + divider() + LF
  for (const line of groomingTicketLines(data, copy)) out += line + LF
  out += divider() + LF + ALIGN_CENTER + toPrintableAscii(footer) + LF + ALIGN_LEFT
  return out + FEED_AND_CUT
}

/** Dua lembar per ekor (konsumen lalu groomer), semua ekor dalam satu kiriman ke printer. */
export function buildGroomingTicketsEscpos(tickets: GroomingTicketData[]): string {
  let out = INIT + SELECT_FONT_B + CODEPAGE_CP437
  for (const ticket of tickets) {
    out += buildCopy(ticket, 'KONSUMEN')
    out += buildCopy(ticket, 'GROOMER')
  }
  return out
}
