import { describe, expect, it } from 'vitest'
import {
  BODY_LINES,
  NOTE_WIDTH,
  PAGE_LINES,
  buildDeliveryNotePages,
  paginateItems,
  type DeliveryNoteData,
  type DeliveryNoteItem,
} from './delivery-note-layout'
import { buildDeliveryNoteEscp } from './qz-print'

function makeItems(n: number, weightGram: number | null = 1000): DeliveryNoteItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    productCode: `SKU${i + 1}`,
    productName: `Produk ${i + 1}`,
    uomCode: 'PCS',
    qty: 2,
    unitPrice: 15000,
    subtotal: 30000,
    weightGram,
  }))
}

function makeData(n: number, extra: Partial<DeliveryNoteData> = {}): DeliveryNoteData {
  return {
    transactionNumber: 'TRX-20261001-0001',
    transactionDate: '01/10/2026 10:00',
    branchName: 'Toko Pusat',
    customerName: 'Pelanggan Grosir',
    staffName: 'Andi',
    items: makeItems(n),
    ...extra,
  }
}

function itemNumbers(pages: ReturnType<typeof buildDeliveryNotePages>) {
  return pages.flatMap((page) =>
    page.map((l) => l.text.match(/^(\d+)\s+Produk \1\b/)?.[1]).filter(Boolean).map(Number),
  )
}

describe('paginateItems', () => {
  it('muat satu halaman bila jumlah item ≤ kapasitas halaman terakhir', () => {
    expect(paginateItems([1, 2, 3], 5, 3)).toEqual([[1, 2, 3]])
  })

  it('halaman terakhir tidak pernah kosong (tanda tangan butuh minimal satu item)', () => {
    // 4 item, halaman penuh muat 5 tapi halaman akhir cuma 3 → jangan [4 item] + [].
    const pages = paginateItems([1, 2, 3, 4], 5, 3)
    expect(pages).toEqual([[1, 2, 3], [4]])
  })

  it('halaman tengah diisi penuh', () => {
    const pages = paginateItems(Array.from({ length: 12 }, (_, i) => i), 5, 3)
    expect(pages.map((p) => p.length)).toEqual([5, 5, 2])
  })

  it('daftar kosong tetap menghasilkan satu halaman', () => {
    expect(paginateItems([], 5, 3)).toEqual([[]])
  })
})

describe('buildDeliveryNotePages — kertas 9.5" x 5.5"', () => {
  it.each([
    ['tanpa harga', false],
    ['dengan harga', true],
  ])('setiap halaman ≤ %s baris isi & ≤ lebar kolom (%s)', (_label, withPrice) => {
    for (const n of [1, 5, 14, 15, 16, 30, 60]) {
      const pages = buildDeliveryNotePages(makeData(n, { withPrice, grandTotal: 30000 * n, isVoided: true }))
      for (const page of pages) {
        expect(page.length).toBeLessThanOrEqual(BODY_LINES)
        for (const line of page) expect(line.text.length).toBeLessThanOrEqual(NOTE_WIDTH)
      }
    }
  })

  it('semua item tercetak tepat sekali dan nomor urut berlanjut lintas halaman', () => {
    const pages = buildDeliveryNotePages(makeData(45))
    expect(pages.length).toBeGreaterThan(1)
    expect(itemNumbers(pages)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1))
  })

  it('nota pendek = satu lembar tanpa label halaman', () => {
    const pages = buildDeliveryNotePages(makeData(5))
    expect(pages).toHaveLength(1)
    expect(pages[0].some((l) => l.text.includes('Hal '))).toBe(false)
  })

  it('nota panjang: header diulang, label Hal x/y, tanda tangan & tonase hanya di lembar terakhir', () => {
    const pages = buildDeliveryNotePages(makeData(40, { withPrice: true, grandTotal: 1_200_000 }))
    const total = pages.length
    pages.forEach((page, i) => {
      const text = page.map((l) => l.text).join('\n')
      const isLast = i === total - 1
      expect(text).toContain('NOTA PENJUALAN')
      expect(text).toContain('TRX-20261001-0001')
      expect(text).toContain(`Hal ${i + 1}/${total}`)
      expect(text.includes('Penerima')).toBe(isLast)
      expect(text.includes('TONASE')).toBe(isLast)
      expect(text.includes('TOTAL: Rp')).toBe(isLast)
      expect(text.includes('Bersambung')).toBe(!isLast)
    })
  })

  it('nama staf & customer tetap muat satu baris walau panjang', () => {
    const pages = buildDeliveryNotePages(
      makeData(1, { customerName: 'X'.repeat(90), staffName: 'Nama Staf Yang Cukup Panjang' }),
    )
    const line = pages[0].find((l) => l.text.startsWith('Kepada:'))!
    expect(line.text.length).toBe(NOTE_WIDTH)
    expect(line.text.endsWith('Staf: Nama Staf Yang Cukup Panjang')).toBe(true)
  })
})

describe('buildDeliveryNoteEscp', () => {
  it('menyetel panjang lembar 33 baris pada 6 lpi sebelum isi', () => {
    const escp = buildDeliveryNoteEscp(makeData(3))
    expect(PAGE_LINES).toBe(33)
    expect(escp.startsWith('\x1B@\x1BP\x12\x1B2\x1BC' + String.fromCharCode(33))).toBe(true)
  })

  it('satu form feed per lembar', () => {
    const data = makeData(45)
    const pages = buildDeliveryNotePages(data).length
    const escp = buildDeliveryNoteEscp(data)
    expect(escp.split('\x0C').length - 1).toBe(pages)
    expect(escp.endsWith('\x0C')).toBe(true)
  })
})
