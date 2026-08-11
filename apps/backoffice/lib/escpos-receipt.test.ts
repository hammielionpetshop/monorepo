import { describe, expect, it } from 'vitest'
import {
  RECEIPT_COLUMNS,
  buildReceiptEscpos,
  money,
  toPrintableAscii,
  type EscposReceiptData,
  type EscposReceiptItem,
} from './escpos-receipt'

function item(overrides: Partial<EscposReceiptItem> = {}): EscposReceiptItem {
  return {
    productName: 'WHISKAS TUNA 1KG',
    uomCode: 'PCS',
    qty: 2,
    unitPrice: 28000,
    discountAmount: 0,
    subtotal: 56000,
    ...overrides,
  }
}

function data(overrides: Partial<EscposReceiptData> = {}): EscposReceiptData {
  return {
    storeName: 'HAMMIELION',
    storeAddress: 'Jl. Contoh No. 1',
    storePhone: '0812345678',
    receiptNumber: 'TRX-20260811-0001',
    transactionDate: '11/08/2026 14.30.15',
    cashierName: 'Budi',
    customerName: 'Umum',
    items: [item()],
    discountAmount: 0,
    grandTotal: 56000,
    amountPaid: 100000,
    change: 44000,
    paymentMethodName: 'Tunai',
    ...overrides,
  }
}

/** Buang semua perintah ESC/POS, sisakan baris teks yang benar-benar tercetak. */
function printedLines(escpos: string): string[] {
  return escpos
    .replace(/\x1B@/g, '')
    .replace(/\x1B[Mat]./g, '')
    .replace(/\x1BE./g, '')
    .replace(/\x1Bd./g, '')
    .replace(/\x1D!./g, '')
    .replace(/\x1DV../g, '')
    .split('\n')
    .filter((line) => line.length > 0)
}

describe('lebar kertas', () => {
  it('tidak ada baris yang melebihi lebar kolom kertas', () => {
    const escpos = buildReceiptEscpos(
      data({
        items: [
          item(),
          item({ productName: 'ROYAL CANIN PERSIAN ADULT DRY CAT FOOD KEMASAN BESAR 10KG', qty: 3 }),
          item({ productName: 'A', unitPrice: 1234567, subtotal: 3703701, qty: 3 }),
        ],
        grandTotal: 12345678,
        amountPaid: 20000000,
        change: 7654322,
      })
    )

    for (const line of printedLines(escpos)) {
      expect(line.length).toBeLessThanOrEqual(RECEIPT_COLUMNS)
    }
  })

  it('nama produk panjang dibungkus, bukan dipotong diam-diam', () => {
    const nama = 'ROYAL CANIN PERSIAN ADULT DRY CAT FOOD KEMASAN BESAR 10KG'
    const lines = printedLines(buildReceiptEscpos(data({ items: [item({ productName: nama })] })))

    // Nama menempati baris-baris sejak awalnya sampai tepat sebelum baris "qty x harga".
    const mulai = lines.findIndex((l) => l.startsWith('ROYAL'))
    const qtyIdx = lines.findIndex((l) => l.includes(' x '))
    const gabungan = lines.slice(mulai, qtyIdx).join(' ')

    expect(mulai).toBeGreaterThanOrEqual(0)
    expect(qtyIdx).toBeGreaterThan(mulai)
    for (const kata of nama.split(' ')) {
      expect(gabungan).toContain(kata)
    }
  })

  it('kata tunggal yang lebih panjang dari kertas dipenggal paksa, tidak meluber', () => {
    const panjang = 'X'.repeat(RECEIPT_COLUMNS * 2 + 5)
    const lines = printedLines(buildReceiptEscpos(data({ items: [item({ productName: panjang })] })))

    for (const line of lines) expect(line.length).toBeLessThanOrEqual(RECEIPT_COLUMNS)
    expect(lines.filter((l) => /^X+$/.test(l)).join('').length).toBe(panjang.length)
  })
})

describe('perataan angka', () => {
  it('nominal total rata kanan di kolom terakhir', () => {
    const lines = printedLines(buildReceiptEscpos(data({ grandTotal: 56000 })))
    const totalLine = lines.find((l) => l.startsWith('TOTAL'))

    expect(totalLine).toBeDefined()
    expect(totalLine!.length).toBe(RECEIPT_COLUMNS)
    expect(totalLine!.endsWith('56.000')).toBe(true)
  })

  it('subtotal item rata kanan sejajar dengan total', () => {
    const lines = printedLines(buildReceiptEscpos(data()))
    const qtyLine = lines.find((l) => l.includes(' x '))

    expect(qtyLine!.length).toBe(RECEIPT_COLUMNS)
    expect(qtyLine!.endsWith('56.000')).toBe(true)
  })
})

describe('keamanan CP437', () => {
  it('membuang karakter non-ASCII yang bikin printer memuntahkan sampah', () => {
    expect(toPrintableAscii('Kopi – Susu “enak”')).toBe('Kopi - Susu "enak"')
    expect(toPrintableAscii('2 x 3')).toBe('2 x 3')
    expect(toPrintableAscii('emoji \u{1F600} hilang')).toBe('emoji  hilang')
  })

  it('seluruh keluaran struk bebas dari karakter di luar ASCII cetak', () => {
    const escpos = buildReceiptEscpos(
      data({
        storeName: 'HAMMIELION – PUSAT',
        storeAddress: 'Jl. Mawar “Blok A” No. 5',
        items: [item({ productName: 'CAT FOOD × PREMIUM …' })],
        customerName: 'Bu Ani',
      })
    )

    for (const line of printedLines(escpos)) {
      expect(line).toMatch(/^[\x20-\x7E]*$/)
    }
  })

  it('rupiah diformat tanpa spasi tak-putus bawaan Intl currency', () => {
    expect(money(1234567)).toBe('1.234.567')
    expect(money(0)).toBe('0')
    expect(/[^\x20-\x7E]/.test(money(1234567))).toBe(false)
  })
})

describe('isi struk', () => {
  it('menampilkan subtotal dan diskon hanya bila ada diskon', () => {
    const tanpa = printedLines(buildReceiptEscpos(data({ discountAmount: 0 })))
    expect(tanpa.some((l) => l.startsWith('Diskon'))).toBe(false)

    const dengan = printedLines(buildReceiptEscpos(data({ discountAmount: 5000, grandTotal: 51000 })))
    expect(dengan.find((l) => l.startsWith('Diskon'))!.endsWith('-5.000')).toBe(true)
    // Subtotal - Diskon harus benar-benar sama dengan TOTAL di kertas.
    expect(dengan.find((l) => l.startsWith('Subtotal'))!.endsWith('56.000')).toBe(true)
    expect(dengan.find((l) => l.startsWith('TOTAL'))!.endsWith('51.000')).toBe(true)
  })

  it('subtotal dikurangi diskon selalu cocok dengan total, apa pun diskon per itemnya', () => {
    const lines = printedLines(
      buildReceiptEscpos(
        data({
          items: [item({ discountAmount: 3000, subtotal: 53000 })],
          discountAmount: 8000,
          grandTotal: 45000,
        })
      )
    )
    const angka = (prefix: string) =>
      Number(lines.find((l) => l.startsWith(prefix))!.trim().split(/\s+/).pop()!.replace(/[.-]/g, ''))

    expect(angka('Subtotal') - angka('Diskon')).toBe(angka('TOTAL'))
  })

  it('merinci tiap metode saat pembayaran campuran', () => {
    const lines = printedLines(
      buildReceiptEscpos(
        data({
          payments: [
            { name: 'Tunai', amount: 30000 },
            { name: 'QRIS', amount: 26000 },
          ],
        })
      )
    )

    expect(lines.find((l) => l.startsWith('Tunai'))!.endsWith('30.000')).toBe(true)
    expect(lines.find((l) => l.startsWith('QRIS'))!.endsWith('26.000')).toBe(true)
  })

  it('memakai metode tunggal bila tidak ada rincian pembayaran', () => {
    const lines = printedLines(buildReceiptEscpos(data({ paymentMethodName: 'QRIS', amountPaid: 56000 })))
    expect(lines.find((l) => l.startsWith('QRIS'))!.endsWith('56.000')).toBe(true)
  })

  it('menandai struk batal dan cetak ulang', () => {
    const lines = printedLines(buildReceiptEscpos(data({ isVoided: true, isReprint: true })))
    expect(lines.some((l) => l.includes('BATAL / VOID'))).toBe(true)
    expect(lines.some((l) => l.includes('CETAK ULANG'))).toBe(true)
  })

  it('struk normal tidak membawa penanda batal maupun cetak ulang', () => {
    const lines = printedLines(buildReceiptEscpos(data()))
    expect(lines.some((l) => l.includes('BATAL'))).toBe(false)
    expect(lines.some((l) => l.includes('CETAK ULANG'))).toBe(false)
  })

  it('pelanggan kosong ditulis Umum, bukan dibiarkan melompong', () => {
    const lines = printedLines(buildReceiptEscpos(data({ customerName: null })))
    expect(lines.find((l) => l.startsWith('Plgn'))).toContain('Umum')
  })

  it('alamat dan telepon kosong tidak menyisakan baris hampa', () => {
    const lines = printedLines(buildReceiptEscpos(data({ storeAddress: null, storePhone: null })))
    expect(lines.some((l) => l.trim() === '')).toBe(false)
    expect(lines.some((l) => l.includes('Telp:'))).toBe(false)
  })

  it('diskon per item tampil di bawah barisnya', () => {
    const lines = printedLines(
      buildReceiptEscpos(data({ items: [item({ discountAmount: 3000, subtotal: 53000 })] }))
    )
    expect(lines.find((l) => l.trim().startsWith('Diskon'))!.endsWith('-3.000')).toBe(true)
  })
})

describe('perintah printer', () => {
  it('diawali inisialisasi, tabel kode, dan pemilihan font', () => {
    const escpos = buildReceiptEscpos(data())
    expect(escpos.startsWith('\x1B@\x1Bt\x00\x1BM')).toBe(true)
  })

  it('diakhiri feed lalu potong kertas', () => {
    const escpos = buildReceiptEscpos(data())
    expect(escpos.endsWith('\x1Bd\x04\x1DV\x42\x00')).toBe(true)
  })

  it('tidak meninggalkan bold atau rata tengah menyala di akhir', () => {
    const escpos = buildReceiptEscpos(data({ isVoided: true }))
    const lastBold = escpos.lastIndexOf('\x1BE\x01')
    const lastBoldOff = escpos.lastIndexOf('\x1BE\x00')
    const lastCenter = escpos.lastIndexOf('\x1Ba\x01')
    const lastLeft = escpos.lastIndexOf('\x1Ba\x00')

    expect(lastBoldOff).toBeGreaterThan(lastBold)
    expect(lastLeft).toBeGreaterThan(lastCenter)
  })
})
