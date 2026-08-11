/**
 * Penyusun struk kasir sebagai perintah ESC/POS untuk printer termal 80mm.
 *
 * Kenapa mode teks, bukan mencetak HTML: printer termal bukan perangkat grafis melainkan
 * **grid karakter**. Ia tidak mengenal "skala 70%" — yang ia kenal font mana dan berapa
 * kolom per baris. Pada 80mm, Font A = 42 kolom dan Font B = 56 kolom; rasionya 0,75,
 * praktis sama dengan permintaan "perkecil jadi 70%" tapi berupa huruf yang memang
 * dirancang sekecil itu, bukan raster yang dikecilkan.
 *
 * Ini modul **saudara** `lib/qz-print.ts`, bukan turunannya. Berkas itu menyasar printer
 * dot-matrix yang bicara ESC/**P** (PICA 10 cpi, form feed); termal bicara ESC/**POS**
 * dengan auto-cut dan tanpa form feed. Polanya dicontoh, perintahnya berbeda.
 *
 * Sengaja bebas dari QZ Tray maupun DOM supaya keluarannya bisa diuji sebagai string biasa.
 */

/**
 * Lebar kertas dalam kolom karakter — **satu-satunya angka yang perlu diubah** kalau
 * ternyata Font B (56 kolom) terlalu rapat di kertas dan harus turun ke Font A (42).
 * Ganti nilainya berbarengan dengan RECEIPT_FONT di bawah.
 */
export const RECEIPT_COLUMNS = 56

/** 0 = Font A (12x24, 42 kolom), 1 = Font B (9x17, 56 kolom). */
const RECEIPT_FONT: 0 | 1 = 1

// ---- ESC/POS (Epson-compatible; klon OEM meniru perintah dasar ini) ----
const ESC = '\x1B'
const GS = '\x1D'
const INIT = ESC + '@'
const SELECT_FONT = ESC + 'M' + String.fromCharCode(RECEIPT_FONT)
/** CP437 — tabel kode yang paling aman di klon murah; sudah terbukti di jalur surat jalan. */
const CODEPAGE_CP437 = ESC + 't' + '\x00'
const BOLD_ON = ESC + 'E' + '\x01'
const BOLD_OFF = ESC + 'E' + '\x00'
const ALIGN_LEFT = ESC + 'a' + '\x00'
const ALIGN_CENTER = ESC + 'a' + '\x01'
/** GS ! n — bit 0-2 tinggi, bit 4-6 lebar. 0x01 = tinggi 2x, lebar tetap. */
const SIZE_TALL = GS + '!' + '\x01'
const SIZE_NORMAL = GS + '!' + '\x00'
const LF = '\n'

/**
 * Potong kertas setelah memajukan 4 baris supaya baris terakhir lolos dari pisau.
 * GS V 66 n = potong sebagian dengan feed. Printer tanpa pisau mengabaikan perintah ini.
 */
const FEED_AND_CUT = ESC + 'd' + '\x04' + GS + 'V' + '\x42' + '\x00'

export interface EscposReceiptItem {
  productName: string
  uomCode: string
  qty: number
  unitPrice: number
  discountAmount: number
  subtotal: number
}

export interface EscposReceiptData {
  storeName: string
  storeAddress?: string | null
  storePhone?: string | null
  receiptNumber: string
  /** Sudah diformat oleh pemanggil — penyusun ini sengaja tidak tahu-menahu soal zona waktu. */
  transactionDate: string
  cashierName: string
  customerName?: string | null
  items: EscposReceiptItem[]
  discountAmount: number
  grandTotal: number
  amountPaid: number
  change: number
  paymentMethodName: string
  payments?: { name: string; amount: number }[]
  isReprint?: boolean
  isVoided?: boolean
}

const TYPOGRAPHIC_REPLACEMENTS: Record<string, string> = {
  ' ': ' ',
  '–': '-',
  '—': '-',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '×': 'x',
  '·': '.',
}

/**
 * CP437 tidak punya tanda kutip melengkung, en-dash, atau spasi tak-putus — kalau lolos,
 * printer memuntahkan karakter acak. Yang punya padanan ASCII ditukar, sisanya dibuang.
 */
export function toPrintableAscii(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/[ –—‘’“”…×·]/g, (c) => TYPOGRAPHIC_REPLACEMENTS[c] ?? ' ')
    .replace(/[^\x20-\x7E]/g, '')
}

/** Rupiah tanpa Intl `style: 'currency'` — format itu menyisipkan spasi tak-putus yang merusak CP437. */
export function money(value: number): string {
  return Math.round(value).toLocaleString('id-ID')
}

function truncate(text: string, width: number): string {
  const s = toPrintableAscii(text)
  return s.length > width ? s.slice(0, width) : s
}

function padEnd(text: string, width: number): string {
  return truncate(text, width).padEnd(width)
}

function divider(char = '-'): string {
  return char.repeat(RECEIPT_COLUMNS)
}

/** Label di kiri, angka rata kanan di kolom terakhir — dipakai semua baris total. */
function labelAmount(label: string, amount: string): string {
  const amountText = truncate(amount, RECEIPT_COLUMNS)
  const labelWidth = Math.max(0, RECEIPT_COLUMNS - amountText.length - 1)
  return padEnd(label, labelWidth) + ' ' + amountText
}

function wrapText(text: string, width: number): string[] {
  const clean = toPrintableAscii(text).trim()
  if (clean.length === 0) return ['']
  const words = clean.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current)
        current = ''
      }
      // Kata yang lebih panjang dari kertas (SKU sambung, nama tanpa spasi) dipenggal paksa.
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
 * Satu item = dua baris: nama produk penuh selebar kertas, lalu rincian qty x harga di kiri
 * dengan subtotal rata kanan. Menjejalkan semuanya ke satu baris memaksa nama produk
 * dipenggal pendek — di kertas 56 kolom itu membuat produk sejenis tak bisa dibedakan.
 */
function itemLines(item: EscposReceiptItem): string[] {
  const lines = wrapText(item.productName, RECEIPT_COLUMNS)
  const qtyText = `  ${money(item.qty)} ${toPrintableAscii(item.uomCode)} x ${money(item.unitPrice)}`
  lines.push(labelAmount(qtyText, money(item.subtotal)))
  if (item.discountAmount > 0) {
    lines.push(labelAmount('    Diskon', '-' + money(item.discountAmount)))
  }
  return lines
}

export function buildReceiptEscpos(data: EscposReceiptData): string {
  const out: string[] = []

  out.push(INIT, CODEPAGE_CP437, SELECT_FONT)

  // Kop toko
  out.push(ALIGN_CENTER, BOLD_ON, SIZE_TALL)
  out.push(toPrintableAscii(data.storeName) + LF)
  out.push(SIZE_NORMAL, BOLD_OFF)
  for (const line of wrapText(data.storeAddress ?? '', RECEIPT_COLUMNS)) {
    if (line) out.push(line + LF)
  }
  if (data.storePhone) out.push('Telp: ' + toPrintableAscii(data.storePhone) + LF)
  out.push(ALIGN_LEFT)

  out.push(divider() + LF)

  if (data.isVoided) {
    out.push(ALIGN_CENTER, BOLD_ON)
    out.push('*** BATAL / VOID ***' + LF)
    out.push(BOLD_OFF, ALIGN_LEFT)
  }
  if (data.isReprint) {
    out.push(ALIGN_CENTER)
    out.push('-- CETAK ULANG --' + LF)
    out.push(ALIGN_LEFT)
  }

  out.push(padEnd('No', 6) + ': ' + truncate(data.receiptNumber, RECEIPT_COLUMNS - 8) + LF)
  out.push(padEnd('Tgl', 6) + ': ' + truncate(data.transactionDate, RECEIPT_COLUMNS - 8) + LF)
  out.push(padEnd('Kasir', 6) + ': ' + truncate(data.cashierName, RECEIPT_COLUMNS - 8) + LF)
  out.push(padEnd('Plgn', 6) + ': ' + truncate(data.customerName || 'Umum', RECEIPT_COLUMNS - 8) + LF)

  out.push(divider() + LF)

  for (const item of data.items) {
    for (const line of itemLines(item)) out.push(line + LF)
  }

  out.push(divider() + LF)

  if (data.discountAmount > 0) {
    // Subtotal diturunkan dari grandTotal + diskon, BUKAN dari menjumlahkan subtotal item:
    // subtotal item sudah bersih dari diskon barisnya, jadi menjumlahkannya lalu dikurangi
    // diskon lagi menghasilkan "Subtotal - Diskon != TOTAL" di kertas. Rumus ini sama persis
    // dengan yang dipakai receipt-print.tsx supaya jalur QZ dan fallback tidak beda angka.
    out.push(labelAmount('Subtotal', money(data.grandTotal + data.discountAmount)) + LF)
    out.push(labelAmount('Diskon', '-' + money(data.discountAmount)) + LF)
  }

  out.push(BOLD_ON)
  out.push(labelAmount('TOTAL', money(data.grandTotal)) + LF)
  out.push(BOLD_OFF)

  const payments = data.payments ?? []
  if (payments.length > 1) {
    for (const p of payments) {
      out.push(labelAmount(toPrintableAscii(p.name), money(p.amount)) + LF)
    }
  } else {
    out.push(labelAmount(toPrintableAscii(data.paymentMethodName || 'Tunai'), money(data.amountPaid)) + LF)
  }
  out.push(labelAmount('Kembali', money(data.change)) + LF)

  out.push(divider() + LF)
  out.push(ALIGN_CENTER)
  out.push('Terima kasih' + LF)
  out.push(toPrintableAscii(data.storeName) + LF)
  out.push(ALIGN_LEFT)

  out.push(FEED_AND_CUT)

  return out.join('')
}
