import { describe, expect, it } from 'vitest'
import { netLineAmount, netRefundAmount, noteHeaderDiscount } from './line-net-value'
import { netLineAmount as netLineAmountBonus } from './grooming-bonus'

describe('mesin nilai bersih baris', () => {
  it('bonus jasa memakai rumus yang sama (bukan rumus kembar)', () => {
    expect(netLineAmountBonus).toBe(netLineAmount)
  })

  it('nota tanpa diskon total: nilai bersih = nilai baris', () => {
    expect(netLineAmount(50000, 120000, 120000)).toBe(50000)
  })

  it('nota baru berdiskon per barang: nilai baris sudah dipotong, tidak dipotong lagi', () => {
    // baris 60.000 dipotong 10.000 → tersimpan 50.000; baris lain 70.000; dibayar 120.000
    expect(netLineAmount(50000, 120000, 120000)).toBe(50000)
    expect(netLineAmount(70000, 120000, 120000)).toBe(70000)
  })

  it('nota lama berdiskon total: dibagi sebanding nilai baris', () => {
    // 60.000 + 140.000 = 200.000, diskon nota 20.000 → dibayar 180.000
    expect(netLineAmount(60000, 180000, 200000)).toBe(54000)
    expect(netLineAmount(140000, 180000, 200000)).toBe(126000)
  })

  it('pembulatan ke bawah: jumlah bagian tidak pernah melebihi yang dibayar', () => {
    const lines = [33333, 33333, 33334]
    const nets = lines.map((l) => netLineAmount(l, 89999, 100000))
    expect(nets.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(89999)
  })

  it('baris gratis (dipotong penuh) dan angka tidak wajar bernilai 0', () => {
    expect(netLineAmount(0, 50000, 50000)).toBe(0)
    expect(netLineAmount(50000, 0, 50000)).toBe(0)
    expect(netLineAmount(50000, -10, 50000)).toBe(0)
    expect(netLineAmount(50000, 50000, 0)).toBe(0)
  })
})

describe('uang kembali retur dari nilai bersih', () => {
  it('retur seluruh baris mengembalikan seluruh nilai bersih', () => {
    expect(netRefundAmount({ netAmount: 54000, qty: 3, returnQty: 3 })).toBe(54000)
  })

  it('retur sebagian = bagian sebanding qty', () => {
    expect(netRefundAmount({ netAmount: 54000, qty: 3, returnQty: 1 })).toBe(18000)
    expect(netRefundAmount({ netAmount: 54000, qty: 3, returnQty: 2 })).toBe(36000)
  })

  it('contoh celah lama: 2 pcs @25.000 didiskon 10.000 → retur 1 pcs kembali 20.000, bukan 25.000', () => {
    const net = netLineAmount(40000, 40000, 40000)
    expect(netRefundAmount({ netAmount: net, qty: 2, returnQty: 1 })).toBe(20000)
  })

  it('retur bertahap: totalnya tepat sama dengan nilai bersih walau tidak habis dibagi', () => {
    const net = 10000
    const pertama = netRefundAmount({ netAmount: net, qty: 3, returnQty: 1 })
    const kedua = netRefundAmount({ netAmount: net, qty: 3, returnQty: 1, returnedQtyBefore: 1, refundedBefore: pertama })
    const ketiga = netRefundAmount({ netAmount: net, qty: 3, returnQty: 1, returnedQtyBefore: 2, refundedBefore: pertama + kedua })
    expect([pertama, kedua, ketiga]).toEqual([3333, 3333, 3334])
    expect(pertama + kedua + ketiga).toBe(net)
  })

  it('tidak pernah mengembalikan lebih dari sisa nilai baris', () => {
    expect(netRefundAmount({ netAmount: 10000, qty: 4, returnQty: 1, returnedQtyBefore: 1, refundedBefore: 9000 })).toBe(1000)
    expect(netRefundAmount({ netAmount: 10000, qty: 2, returnQty: 1, returnedQtyBefore: 1, refundedBefore: 12000 })).toBe(0)
  })

  it('baris gratis atau qty tidak wajar → 0', () => {
    expect(netRefundAmount({ netAmount: 0, qty: 2, returnQty: 1 })).toBe(0)
    expect(netRefundAmount({ netAmount: 5000, qty: 0, returnQty: 1 })).toBe(0)
    expect(netRefundAmount({ netAmount: 5000, qty: 2, returnQty: 0 })).toBe(0)
  })
})

describe('noteHeaderDiscount — memisahkan diskon nota dari potongan baris', () => {
  it('nota tanpa potongan baris: diskon kepala nota apa adanya', () => {
    expect(noteHeaderDiscount({ totalAmount: 50000, discountAmount: 3000 }, [{ totalPrice: 50000, discountAmount: 0 }]))
      .toEqual({ headerOnly: 3000, netHeader: false })
  })

  it('nota kasir berdiskon per barang: kepala nota = jumlah baris sesudah potongan, diskon nota 0', () => {
    expect(noteHeaderDiscount({ totalAmount: 45000, discountAmount: 0 }, [{ totalPrice: 45000, discountAmount: 5000 }]))
      .toEqual({ headerOnly: 0, netHeader: true })
  })

  it('nota kasir lama: gratis ongkir + diskon total nota → diskon nota TIDAK hilang', () => {
    const lines = [{ totalPrice: 0, discountAmount: 10000 }, { totalPrice: 50000, discountAmount: 0 }]
    expect(noteHeaderDiscount({ totalAmount: 50000, discountAmount: 3000 }, lines)).toEqual({ headerOnly: 3000, netHeader: true })
  })

  it('Penjualan Grosir: diskon kepala nota sudah memuat potongan baris → hanya sisanya yang diskon nota', () => {
    const lines = [{ totalPrice: 90000, discountAmount: 10000 }]
    expect(noteHeaderDiscount({ totalAmount: 100000, discountAmount: 12000 }, lines)).toEqual({ headerOnly: 2000, netHeader: false })
    expect(noteHeaderDiscount({ totalAmount: 100000, discountAmount: 10000 }, lines)).toEqual({ headerOnly: 0, netHeader: false })
  })
})
