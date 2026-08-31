import { describe, expect, it } from 'vitest'
import { buildPoReceiptEscpos, type PoReceiptData, type PoReceiptItem } from './escpos-po-receipt'

const COLUMNS = 56

function item(overrides: Partial<PoReceiptItem> = {}): PoReceiptItem {
  return {
    productName: 'WHISKAS TUNA 1KG',
    productSku: 'WHK-TUNA-1KG',
    uomCode: 'PCS',
    qtyReceived: 24,
    qtyDamaged: 0,
    ...overrides,
  }
}

function data(overrides: Partial<PoReceiptData> = {}): PoReceiptData {
  return {
    poNumber: 'PO-20260831-0003',
    supplierName: 'PT Sumber Pangan Sejahtera',
    branchName: 'Toko Pusat',
    receivedByName: 'Budi',
    receivedAt: new Date('2026-08-31T10:00:00Z'),
    note: null,
    items: [item()],
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
  it('tidak ada baris yang melebihi lebar kolom, walau nama/catatan panjang', () => {
    const escpos = buildPoReceiptEscpos(
      data({
        supplierName: 'PT Distribusi Pakan Ternak Nusantara Raya Abadi Sentosa Makmur Jaya',
        note: 'Ada dua karton yang kemasannya penyok berat, sudah difoto dan dilaporkan ke supplier via WhatsApp',
        items: [
          item({
            productName: 'ROYAL CANIN MAXI ADULT DRY DOG FOOD KEMASAN KARUNG 15 KILOGRAM IMPOR',
            productSku: 'RC-MAXI-ADULT-15KG-IMPORT-2026',
            qtyReceived: 40,
            qtyDamaged: 2,
          }),
        ],
      })
    )
    for (const line of printedLines(escpos)) {
      expect(line.length).toBeLessThanOrEqual(COLUMNS)
    }
  })
})

describe('isi BPB PO', () => {
  it('menampilkan qty rusak hanya bila ada', () => {
    const tanpa = printedLines(buildPoReceiptEscpos(data({ items: [item({ qtyDamaged: 0 })] })))
    expect(tanpa.some((l) => l.includes('Rusak'))).toBe(false)

    const dengan = printedLines(buildPoReceiptEscpos(data({ items: [item({ qtyReceived: 22, qtyDamaged: 2 })] })))
    const line = dengan.find((l) => l.startsWith('Terima: 22'))
    expect(line).toBeDefined()
    expect(line!.includes('Rusak: 2')).toBe(true)
  })

  it('menampilkan catatan hanya bila ada', () => {
    expect(printedLines(buildPoReceiptEscpos(data())).some((l) => l.startsWith('Catatan'))).toBe(false)
    const lines = printedLines(buildPoReceiptEscpos(data({ note: 'barang lengkap' })))
    expect(lines.some((l) => l === 'Catatan:')).toBe(true)
    expect(lines.some((l) => l.includes('barang lengkap'))).toBe(true)
  })

  it('membawa nomor PO, supplier, cabang, penerima', () => {
    const lines = printedLines(buildPoReceiptEscpos(data()))
    expect(lines.some((l) => l.includes('PO-20260831-0003'))).toBe(true)
    expect(lines.some((l) => l.includes('PT Sumber Pangan Sejahtera'))).toBe(true)
    expect(lines.some((l) => l.includes('Cabang: Toko Pusat'))).toBe(true)
    expect(lines.some((l) => l.includes('Penerima: Budi'))).toBe(true)
  })

  it('Total Jenis Barang = jumlah item', () => {
    const lines = printedLines(buildPoReceiptEscpos(data({ items: [item(), item({ productName: 'B', productSku: 'B' })] })))
    expect(lines.find((l) => l.startsWith('Total Jenis Barang'))!.trim().endsWith('2')).toBe(true)
  })

  it('nama toko jatuh ke HAMMIELION bila tidak diberikan', () => {
    expect(printedLines(buildPoReceiptEscpos(data()))[0]).toBe('HAMMIELION')
  })
})

describe('keamanan CP437', () => {
  it('seluruh keluaran bebas dari karakter di luar ASCII cetak', () => {
    const escpos = buildPoReceiptEscpos(
      data({
        supplierName: 'PT Café Ñam – Impor',
        note: 'kemasan “sobek” … parah',
        items: [item({ productName: 'CAT FOOD × PREMIUM' })],
      })
    )
    for (const line of printedLines(escpos)) {
      expect(line).toMatch(/^[\x20-\x7E]*$/)
    }
  })
})

describe('perintah printer', () => {
  it('diawali inisialisasi, tabel kode, dan pemilihan font', () => {
    expect(buildPoReceiptEscpos(data()).startsWith('\x1B@\x1Bt\x00\x1BM')).toBe(true)
  })

  it('diakhiri feed lalu potong kertas', () => {
    expect(buildPoReceiptEscpos(data()).endsWith('\x1Bd\x04\x1DV\x42\x00')).toBe(true)
  })

  it('tidak meninggalkan bold atau rata tengah menyala di akhir', () => {
    const escpos = buildPoReceiptEscpos(data({ note: 'x' }))
    expect(escpos.lastIndexOf('\x1BE\x00')).toBeGreaterThan(escpos.lastIndexOf('\x1BE\x01'))
    expect(escpos.lastIndexOf('\x1Ba\x00')).toBeGreaterThan(escpos.lastIndexOf('\x1Ba\x01'))
  })
})
