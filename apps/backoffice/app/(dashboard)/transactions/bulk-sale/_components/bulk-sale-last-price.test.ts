import { describe, expect, it } from 'vitest'
import { differsFromLastPrice, formatLastPriceDate, parseLastBulkPrices } from './bulk-sale-last-price'

const last = { productId: 1, uomId: 2, unitPrice: 125000, discountAmount: 0, qty: 3, trxNumber: 'TRX-1', soldAt: '2026-09-30T18:30:00Z' }

describe('differsFromLastPrice', () => {
  it('false bila belum ada riwayat', () => {
    expect(differsFromLastPrice(120000, null)).toBe(false)
  })

  it('false bila harga sama', () => {
    expect(differsFromLastPrice(125000, last)).toBe(false)
  })

  it('true bila harga berbeda', () => {
    expect(differsFromLastPrice(120000, last)).toBe(true)
  })

  it('false bila harga masih kosong', () => {
    expect(differsFromLastPrice(0, last)).toBe(false)
  })
})

describe('formatLastPriceDate', () => {
  it('memakai tanggal WIB, bukan UTC', () => {
    expect(formatLastPriceDate('2026-09-30T18:30:00Z')).toContain('1')
    expect(formatLastPriceDate('2026-09-30T18:30:00Z')).toMatch(/Okt|Oct/)
  })

  it('kosong bila tanggal rusak', () => {
    expect(formatLastPriceDate('bukan-tanggal')).toBe('')
  })
})

describe('parseLastBulkPrices', () => {
  it('membuang entri yang bentuknya salah', () => {
    expect(parseLastBulkPrices({ prices: [last, { productId: 'x' }, null] })).toEqual([last])
    expect(parseLastBulkPrices(null)).toEqual([])
  })
})
