import { describe, expect, it } from 'vitest'
import { paginateRows } from './cart-preview-pdf'

describe('paginateRows (PDF rincian pesanan)', () => {
  it('semua baris masuk tepat satu kali, berurutan', () => {
    const heights = Array.from({ length: 95 }, (_, i) => (i % 7 === 0 ? 70 : 42))
    const pages = paginateRows(heights, { first: 1300, next: 1400 }, 130)
    expect(pages.flat()).toEqual(heights.map((_, i) => i))
    expect(pages.length).toBeGreaterThan(1)
  })

  it('tiap halaman tidak melebihi kapasitasnya', () => {
    const heights = Array.from({ length: 60 }, () => 42)
    const pages = paginateRows(heights, { first: 500, next: 600 }, 130)
    pages.forEach((page, p) => {
      const used = page.reduce((acc, i) => acc + heights[i], 0)
      expect(used).toBeLessThanOrEqual(p === 0 ? 500 : 600)
    })
  })

  it('total pindah ke halaman baru bila tidak muat di halaman terakhir', () => {
    const pages = paginateRows([200, 200], { first: 450, next: 450 }, 130)
    expect(pages).toEqual([[0, 1], []])
  })

  it('keranjang kosong tetap satu halaman', () => {
    expect(paginateRows([], { first: 500, next: 600 }, 130)).toEqual([[]])
  })
})
