import { describe, expect, it } from 'vitest'
import { bonusOf, netLineAmount } from './grooming-bonus'

// Kasus tes yang sama dengan apps/backoffice/lib/grooming-bonus.test.ts (spec HRIS L4d §8).
describe('rumus bonus jasa bersama POS dan HRIS', () => {
  it('tanpa diskon: bonus groomer 10% dari harga jasa', () => {
    expect(bonusOf(netLineAmount(100000, 100000, 100000), 10)).toBe(10000)
  })
  it('jasa 100 ribu didiskon jadi 80 ribu → bonus 8 ribu', () => {
    expect(netLineAmount(100000, 80000, 100000)).toBe(80000)
    expect(bonusOf(80000, 10)).toBe(8000)
  })
  it('nota campuran: diskon nota dibagi sebanding', () => {
    expect(netLineAmount(60000, 180000, 200000)).toBe(54000)
    expect(netLineAmount(140000, 180000, 200000)).toBe(126000)
    expect(bonusOf(54000, 10)).toBe(5400)
  })
  it('pembulatan ke bawah', () => {
    expect([33333, 33333, 33334].map((l) => netLineAmount(l, 89999, 100000))).toEqual([29999, 29999, 30000])
    expect(bonusOf(29999, 10)).toBe(2999)
  })
  it('bonus pengantar 50% dari ongkir sesudah diskon', () => {
    expect(bonusOf(netLineAmount(15000, 135000, 135000), 50)).toBe(7500)
    expect(bonusOf(netLineAmount(15000, 121500, 135000), 50)).toBe(6750)
  })
  it('nilai tidak wajar tidak menghasilkan bonus minus', () => {
    expect(netLineAmount(0, 5000, 5000)).toBe(0)
    expect(netLineAmount(50000, 0, 50000)).toBe(0)
    expect(netLineAmount(50000, -10, 50000)).toBe(0)
    expect(bonusOf(-100, 10)).toBe(0)
  })
})
