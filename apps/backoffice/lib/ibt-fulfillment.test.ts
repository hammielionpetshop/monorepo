import { describe, expect, it } from 'vitest'
import { countUnfulfilled, isUnfulfilled } from './ibt-fulfillment'

describe('isUnfulfilled', () => {
  it('true saat diminta >0 tapi tidak jadi dikirim (ship 0)', () => {
    expect(isUnfulfilled({ qtyRequested: 1, qtyShipped: 0 })).toBe(true)
  })

  it('false saat terkirim sebagian (req 2, ship 1) — stok memang berpindah sebagian', () => {
    expect(isUnfulfilled({ qtyRequested: 2, qtyShipped: 1 })).toBe(false)
  })

  it('false saat terkirim penuh', () => {
    expect(isUnfulfilled({ qtyRequested: 3, qtyShipped: 3 })).toBe(false)
  })

  it('false saat req 0 (tambahan di nota)', () => {
    expect(isUnfulfilled({ qtyRequested: 0, qtyShipped: 0 })).toBe(false)
  })
})

describe('countUnfulfilled', () => {
  it('menghitung item ship 0 & req >0 pada status FULLY_RECEIVED', () => {
    const items = [
      { qtyRequested: 1, qtyShipped: 0 },
      { qtyRequested: 2, qtyShipped: 2 },
    ]
    expect(countUnfulfilled(items, 'FULLY_RECEIVED')).toBe(1)
  })

  it('tidak menghitung item terkirim sebagian', () => {
    const items = [{ qtyRequested: 2, qtyShipped: 1 }]
    expect(countUnfulfilled(items, 'PARTIALLY_RECEIVED')).toBe(0)
  })

  it('tidak menghitung item req 0 (tambahan di nota)', () => {
    const items = [{ qtyRequested: 0, qtyShipped: 0 }]
    expect(countUnfulfilled(items, 'FULLY_RECEIVED')).toBe(0)
  })

  it('0 pada status pra-kirim walau semua ship 0 (belum waktunya)', () => {
    const items = [
      { qtyRequested: 1, qtyShipped: 0 },
      { qtyRequested: 2, qtyShipped: 0 },
    ]
    expect(countUnfulfilled(items, 'APPROVED')).toBe(0)
    expect(countUnfulfilled(items, 'PREPARING')).toBe(0)
  })

  it('menghitung jumlah benar untuk campuran banyak item', () => {
    const items = [
      { qtyRequested: 1, qtyShipped: 0 }, // unfulfilled
      { qtyRequested: 2, qtyShipped: 1 }, // sebagian
      { qtyRequested: 3, qtyShipped: 3 }, // penuh
      { qtyRequested: 0, qtyShipped: 0 }, // tambahan di nota
      { qtyRequested: 5, qtyShipped: 0 }, // unfulfilled
    ]
    expect(countUnfulfilled(items, 'IN_TRANSIT')).toBe(2)
  })
})
