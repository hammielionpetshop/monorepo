import { describe, expect, it } from 'vitest'
import { buildDiscountHistory, isCalendarDay, isDiscountSource, type DiscountHistoryRow } from './discount-history'

let seq = 0
const row = (over: Partial<DiscountHistoryRow>): DiscountHistoryRow => {
  seq += 1
  return {
    key: `k${seq}`, source: 'MANUAL', transactionId: seq, trxNumber: `TRX-${seq}`, createdAt: '2026-10-12T03:00:00.000Z',
    branchId: 1, branchName: 'Toko Depan', byName: 'Kasir A', saleType: 'RETAIL', customerName: null,
    productId: 10, productName: 'BOLT DRY IKAN 800GR', productSku: 'BLT-800', uomCode: 'PCS', qty: 1, unitPrice: 25000,
    amount: 5000, reason: 'Kemasan rusak',
    ...over,
  }
}

describe('buildDiscountHistory', () => {
  it('mengelompokkan per barang: berapa kali, jumlah nota, total, jenis, dan alasan terbanyak di depan', () => {
    const view = buildDiscountHistory([
      row({ transactionId: 1, amount: 5000, reason: 'Kemasan rusak', createdAt: '2026-10-10T03:00:00.000Z' }),
      row({ transactionId: 2, amount: 3000, reason: 'Pelanggan langganan', createdAt: '2026-10-12T03:00:00.000Z' }),
      row({ transactionId: 2, amount: 2000, reason: 'Pelanggan langganan', createdAt: '2026-10-12T03:00:00.000Z' }),
      row({ transactionId: 3, source: 'GROSIR', amount: 20000, reason: 'Potongan Penjualan Grosir', createdAt: '2026-10-11T03:00:00.000Z' }),
      row({ transactionId: 4, productId: 11, productName: 'PASIR 5L', productSku: null, amount: 40000 }),
    ])

    expect(view.products.map((p) => p.productName)).toEqual(['PASIR 5L', 'BOLT DRY IKAN 800GR']) // total terbesar di atas
    const bolt = view.products[1]
    expect(bolt).toMatchObject({ count: 4, noteCount: 3, total: 30000, sources: ['MANUAL', 'GROSIR'] })
    expect(bolt.reasons).toEqual([
      { label: 'Pelanggan langganan', count: 2 },
      { label: 'Kemasan rusak', count: 1 },
      { label: 'Potongan Penjualan Grosir', count: 1 },
    ])
    expect(bolt.rows.map((r) => r.transactionId)).toEqual([2, 2, 3, 1]) // terbaru di atas
    expect(view.summary).toMatchObject({ total: 70000, noteCount: 4 })
    expect(view.summary.bySource.MANUAL).toEqual({ count: 4, total: 50000 })
    expect(view.summary.bySource.GROSIR).toEqual({ count: 1, total: 20000 })
    expect(view.summary.bySource.PROMO).toEqual({ count: 0, total: 0 })
  })

  it('diskon nota (tidak per barang) dipisah dari daftar barang tetapi ikut total', () => {
    const view = buildDiscountHistory([
      row({ amount: 5000 }),
      row({ source: 'NOTA', productId: null, productName: 'Diskon nota (tidak per barang)', amount: 10000, trxNumber: 'TRX-LAMA' }),
    ])
    expect(view.products).toHaveLength(1)
    expect(view.noteLevel.map((r) => r.trxNumber)).toEqual(['TRX-LAMA'])
    expect(view.summary.total).toBe(15000)
    expect(view.summary.bySource.NOTA).toEqual({ count: 1, total: 10000 })
  })

  it('saringan jenis dan pencarian per kata (barang, SKU, nomor nota, pelanggan)', () => {
    const rows = [
      row({ amount: 5000 }),
      row({ source: 'PROMO', productId: 12, productName: 'WHISKAS POUCH TUNA', productSku: 'WSK-1', amount: 1000, reason: 'Promo Oktober' }),
      row({ source: 'NOTA', productId: null, productName: 'Diskon nota (tidak per barang)', amount: 7000, trxNumber: 'TRX-GROSIR-9', customerName: 'Bu Sari' }),
    ]
    expect(buildDiscountHistory(rows, { source: 'PROMO' }).summary).toMatchObject({ total: 1000, noteCount: 1 })
    expect(buildDiscountHistory(rows, { q: 'bolt ikan' }).products.map((p) => p.productName)).toEqual(['BOLT DRY IKAN 800GR'])
    expect(buildDiscountHistory(rows, { q: 'wsk-1' }).summary.total).toBe(1000)
    expect(buildDiscountHistory(rows, { q: 'sari' }).noteLevel).toHaveLength(1)
    expect(buildDiscountHistory(rows, { q: 'tidak ada' }).summary).toMatchObject({ total: 0, noteCount: 0 })
  })

  it('barang yang sudah dihapus dari master (tanpa id) dikelompokkan lewat nama di nota; potongan 0 diabaikan', () => {
    const view = buildDiscountHistory([
      row({ productId: null, productName: 'Barang Lama', amount: 1000 }),
      row({ productId: null, productName: 'barang lama ', amount: 2000 }),
      row({ productId: null, productName: 'Barang Lain', amount: 0 }),
    ])
    expect(view.products).toHaveLength(1)
    expect(view.products[0]).toMatchObject({ count: 2, total: 3000 })
  })
})

describe('isDiscountSource', () => {
  it('hanya menerima empat jenis yang dikenal', () => {
    expect(isDiscountSource('MANUAL')).toBe(true)
    expect(isDiscountSource('NOTA')).toBe(true)
    expect(isDiscountSource('manual')).toBe(false)
    expect(isDiscountSource(undefined)).toBe(false)
  })
})

describe('isCalendarDay', () => {
  it('menerima tanggal yang ada di kalender', () => {
    expect(isCalendarDay('2026-10-13')).toBe(true)
    expect(isCalendarDay('2028-02-29')).toBe(true)
  })

  it('menolak tanggal yang bentuknya benar tetapi tidak ada, dan isian kosong atau ngawur', () => {
    for (const bad of ['2026-13-99', '2026-02-31', '2026-00-10', 'abc', '2026-1-1', '', null, undefined]) {
      expect(isCalendarDay(bad)).toBe(false)
    }
  })
})
