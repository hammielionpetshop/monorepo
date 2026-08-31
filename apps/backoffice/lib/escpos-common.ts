/**
 * Primitif ESC/POS bersama untuk dokumen termal 80mm selain struk kasir
 * (laporan settlement, bukti penerimaan barang, dst).
 *
 * `lib/escpos-receipt.ts` — penyusun struk — SENGAJA tidak memakai modul ini: berkas itu
 * sudah tervalidasi di printer nyata lewat beberapa putaran uji cetak dan tidak diusik.
 * Fungsi sanitasi CP437 (`toPrintableAscii`, `money`) tetap diambil dari sana supaya
 * hanya ada satu sumber kebenaran untuk bagian yang paling rawan bikin printer ngaco.
 */

import { toPrintableAscii, money } from '@/lib/escpos-receipt'

export { toPrintableAscii, money }

/** Lebar kertas dalam kolom karakter pada 80mm + Font B. */
export const THERMAL_COLUMNS = 56

// ---- ESC/POS (Epson-compatible; klon OEM meniru perintah dasar ini) ----
const ESC = '\x1B'
const GS = '\x1D'
export const INIT = ESC + '@'
/** Font B (9x17) → 56 kolom di 80mm. */
export const SELECT_FONT_B = ESC + 'M' + '\x01'
/** CP437 — tabel kode paling aman di klon murah; terbukti di jalur surat jalan. */
export const CODEPAGE_CP437 = ESC + 't' + '\x00'
export const BOLD_ON = ESC + 'E' + '\x01'
export const BOLD_OFF = ESC + 'E' + '\x00'
export const ALIGN_LEFT = ESC + 'a' + '\x00'
export const ALIGN_CENTER = ESC + 'a' + '\x01'
/** GS ! n — 0x01 = tinggi 2x, lebar tetap. */
export const SIZE_TALL = GS + '!' + '\x01'
export const SIZE_NORMAL = GS + '!' + '\x00'
export const LF = '\n'
/** Maju 4 baris lalu potong sebagian; printer tanpa pisau mengabaikannya. */
export const FEED_AND_CUT = ESC + 'd' + '\x04' + GS + 'V' + '\x42' + '\x00'

export function truncate(text: string, width: number): string {
  const s = toPrintableAscii(text)
  if (width <= 0) return ''
  return s.length > width ? s.slice(0, width) : s
}

export function padEnd(text: string, width: number): string {
  return truncate(text, width).padEnd(width)
}

export function padStart(text: string, width: number): string {
  return truncate(text, width).padStart(width)
}

export function divider(char = '-', columns = THERMAL_COLUMNS): string {
  return char.repeat(columns)
}

/** Label di kiri, angka rata kanan di kolom terakhir. Selalu tepat `columns` lebar. */
export function labelAmount(label: string, amount: string, indent = 0, columns = THERMAL_COLUMNS): string {
  const amountText = truncate(amount, columns)
  const labelWidth = Math.max(0, columns - amountText.length - 1)
  const body = ' '.repeat(indent) + truncate(label, labelWidth - indent)
  return padEnd(body, labelWidth) + ' ' + amountText
}

/** Bungkus teks bebas selebar kertas — nama panjang / catatan tidak boleh meluber. */
export function wrap(text: string, width = THERMAL_COLUMNS): string[] {
  const clean = toPrintableAscii(text).trim()
  if (clean.length === 0) return []
  const words = clean.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current)
        current = ''
      }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width))
      continue
    }
    if (current.length === 0) current = word
    else if (current.length + 1 + word.length <= width) current += ' ' + word
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Tiga kolom dengan lebar [kiri, tengah] tetap; kolom kanan mengisi sisa lebar rata kanan.
 * Selalu tepat `columns` lebar.
 */
export function row3(
  a: string,
  b: string,
  c: string,
  widths: [number, number] = [14, 16],
  columns = THERMAL_COLUMNS
): string {
  const left = padEnd(a, widths[0]) + padEnd(b, widths[1])
  return left + padStart(c, columns - left.length)
}
