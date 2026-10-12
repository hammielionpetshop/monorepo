import { describe, expect, it } from 'vitest'
import { bonusOf, netLineAmount, GROOMER_BONUS_PERCENT, COURIER_BONUS_PERCENT } from './grooming-bonus'

describe('bonus jasa grooming', () => {
  it('tanpa diskon: bonus groomer 10% dari harga jasa', () => {
    const net = netLineAmount(100000, 100000, 100000)
    expect(net).toBe(100000)
    expect(bonusOf(net, GROOMER_BONUS_PERCENT)).toBe(10000)
  })

  it('contoh owner: jasa 100 ribu didiskon jadi 80 ribu → bonus 8 ribu', () => {
    const net = netLineAmount(100000, 80000, 100000)
    expect(net).toBe(80000)
    expect(bonusOf(net, GROOMER_BONUS_PERCENT)).toBe(8000)
  })

  it('nota campuran: diskon nota dibagi sebanding ke jasa dan barang', () => {
    // jasa 60.000 + pakan 140.000 = 200.000, diskon nota 20.000 → dibayar 180.000
    expect(netLineAmount(60000, 180000, 200000)).toBe(54000)
    expect(netLineAmount(140000, 180000, 200000)).toBe(126000)
    expect(bonusOf(54000, GROOMER_BONUS_PERCENT)).toBe(5400)
  })

  it('pembulatan selalu ke bawah, dan jumlah bagian tidak pernah melebihi yang dibayar', () => {
    const lines = [33333, 33333, 33334]
    const nets = lines.map((l) => netLineAmount(l, 89999, 100000))
    expect(nets).toEqual([29999, 29999, 30000])
    expect(nets.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(89999)
    expect(bonusOf(29999, GROOMER_BONUS_PERCENT)).toBe(2999)
  })

  it('bonus pengantar 50% dari ongkir sesudah diskon', () => {
    expect(bonusOf(netLineAmount(15000, 135000, 135000), COURIER_BONUS_PERCENT)).toBe(7500)
    expect(bonusOf(netLineAmount(15000, 121500, 135000), COURIER_BONUS_PERCENT)).toBe(6750)
  })

  it('nilai tidak wajar tidak menghasilkan bonus minus atau berlebih', () => {
    expect(netLineAmount(0, 5000, 5000)).toBe(0)
    expect(netLineAmount(50000, 0, 50000)).toBe(0)
    expect(netLineAmount(50000, -10, 50000)).toBe(0)
    expect(netLineAmount(50000, 70000, 50000)).toBe(50000)
    expect(netLineAmount(50000, 50000, 0)).toBe(0)
    expect(bonusOf(-1, 10)).toBe(0)
  })
})
