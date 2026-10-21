import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MANUAL_DISCOUNT_POLICY,
  MANUAL_DISCOUNT_REASONS,
  checkManualDiscount,
  checkManualDiscountAllowed,
  checkManualDiscountLine,
  checkManualDiscountPercent,
  checkManualDiscountTotals,
  isManualDiscountReason,
  lineGrossAmount,
  manualDiscountAmount,
  manualDiscountPercentLabel,
  manualDiscountReasonLabel,
  resolveManualDiscount,
  toManualDiscountInput,
  maxManualDiscount,
} from './manual-discount'

const sah = { lineGross: 50000, amount: 5000, reasonCode: 'KEMASAN_RUSAK' }

describe('mesin diskon manual — hitungan', () => {
  it('nilai baris = qty × harga', () => {
    expect(lineGrossAmount(3, 25000)).toBe(75000)
    expect(lineGrossAmount(2, '12500')).toBe(25000)
  })

  it('potongan per pcs dikali qty; potongan per baris apa adanya', () => {
    expect(manualDiscountAmount('PER_PCS', 2000, 3)).toBe(6000)
    expect(manualDiscountAmount('PER_BARIS', 2000, 3)).toBe(2000)
    expect(manualDiscountAmount('PER_PCS', Number.NaN, 3)).toBe(0)
  })

  it('potongan persen = persen dari nilai baris, dibulatkan KE BAWAH (favor toko)', () => {
    expect(manualDiscountAmount('PERSEN', 10, 1, 2500)).toBe(250)
    expect(manualDiscountAmount('PERSEN', 10, 3, 2500)).toBe(750) // 10% dari 7.500
    expect(manualDiscountAmount('PERSEN', 7, 1, 2550)).toBe(178) // 178,5 → 178
    expect(manualDiscountAmount('PERSEN', 100, 2, 25000)).toBe(50000)
    expect(manualDiscountAmount('PERSEN', 10, 1)).toBe(0) // tanpa harga → 0
  })
})

describe('mesin diskon manual — pemeriksaan', () => {
  it('potongan wajar dengan alasan pilihan → sah', () => {
    expect(checkManualDiscount(sah)).toBeNull()
  })

  it('boleh sampai seharga barangnya, tidak boleh lebih', () => {
    expect(checkManualDiscount({ ...sah, amount: 50000 })).toBeNull()
    expect(checkManualDiscount({ ...sah, amount: 50001 })).toMatch(/melebihi harga/)
  })

  it('potongan nol, minus, atau pecahan ditolak', () => {
    for (const amount of [0, -1000, 1500.5, Number.NaN]) {
      expect(checkManualDiscount({ ...sah, amount })).toMatch(/lebih dari 0/)
    }
  })

  it('baris yang sudah kena promo tidak bisa didiskon manual', () => {
    expect(checkManualDiscount({ ...sah, hasOtherDiscount: true })).toMatch(/promo/)
  })

  it('alasan wajib dari daftar', () => {
    expect(checkManualDiscount({ ...sah, reasonCode: null })).toBe('Pilih alasan diskon')
    expect(checkManualDiscount({ ...sah, reasonCode: 'ASAL' })).toBe('Pilih alasan diskon')
  })

  it('"Lainnya" wajib diketik', () => {
    expect(checkManualDiscount({ ...sah, reasonCode: 'LAINNYA' })).toMatch(/wajib diketik/)
    expect(checkManualDiscount({ ...sah, reasonCode: 'LAINNYA', reasonNote: '  a ' })).toMatch(/wajib diketik/)
    expect(checkManualDiscount({ ...sah, reasonCode: 'LAINNYA', reasonNote: 'teman owner' })).toBeNull()
  })

  it('catatan terlalu panjang ditolak', () => {
    expect(checkManualDiscount({ ...sah, reasonNote: 'x'.repeat(201) })).toMatch(/paling panjang/)
  })
})

describe('mesin diskon manual — batas diskon', () => {
  it('bawaan: tanpa batas (owner belum menetapkan)', () => {
    expect(DEFAULT_MANUAL_DISCOUNT_POLICY).toEqual({ maxPercentOfLine: null, maxAmountPerLine: null })
    expect(maxManualDiscount(50000)).toBe(50000)
  })

  it('batas persen dan batas rupiah: yang paling ketat berlaku', () => {
    expect(maxManualDiscount(50000, { maxPercentOfLine: 10, maxAmountPerLine: null })).toBe(5000)
    expect(maxManualDiscount(50000, { maxPercentOfLine: null, maxAmountPerLine: 3000 })).toBe(3000)
    expect(maxManualDiscount(50000, { maxPercentOfLine: 10, maxAmountPerLine: 3000 })).toBe(3000)
    expect(maxManualDiscount(33333, { maxPercentOfLine: 10, maxAmountPerLine: null })).toBe(3333)
  })

  it('potongan di atas batas ditolak dengan menyebut batasnya', () => {
    const policy = { maxPercentOfLine: 10, maxAmountPerLine: null }
    expect(checkManualDiscount({ ...sah, amount: 5000, policy })).toBeNull()
    expect(checkManualDiscount({ ...sah, amount: 5001, policy })).toMatch(/batas diskon.*5\.000/)
  })
})

describe('mesin diskon manual — alasan', () => {
  it('daftar alasan memuat "Lainnya" dan kodenya tidak kembar', () => {
    const codes = MANUAL_DISCOUNT_REASONS.map((r) => r.code)
    expect(codes).toContain('LAINNYA')
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every((c) => c.length <= 30)).toBe(true)
    expect(isManualDiscountReason('LANGGANAN')).toBe(true)
    expect(isManualDiscountReason(undefined)).toBe(false)
  })

  it('tulisan alasan: pilihan, atau ketikan kasir bila "Lainnya"', () => {
    expect(manualDiscountReasonLabel('KEMASAN_RUSAK')).toBe('Kemasan rusak')
    expect(manualDiscountReasonLabel('LAINNYA', ' teman owner ')).toBe('teman owner')
    expect(manualDiscountReasonLabel('LAINNYA')).toBe('Lainnya')
    expect(manualDiscountReasonLabel('KODE_LAMA')).toBe('-')
  })
})

describe('mesin diskon manual — pemeriksaan server per baris', () => {
  const baris = { qty: 2, unitPrice: 25000, discountAmount: 5000, subtotal: 45000, manualDiscount: { amount: 5000, reasonCode: 'KEMASAN_RUSAK' } }

  it('baris tanpa diskon manual tidak diperiksa (cara lama tetap lewat)', () => {
    expect(checkManualDiscountLine({ qty: 1, unitPrice: 10000, discountAmount: 0, subtotal: 10000 })).toBeNull()
    expect(checkManualDiscountLine({ qty: 1, unitPrice: 10000, discountAmount: 10000, subtotal: 0, hasOtherDiscount: true })).toBeNull()
  })

  it('angka layar cocok dengan mesin → sah', () => {
    expect(checkManualDiscountLine(baris)).toBeNull()
  })

  it('potongan baris atau tagihan berbeda dari diskon manual → ditolak', () => {
    expect(checkManualDiscountLine({ ...baris, discountAmount: 4000 })).toMatch(/tidak cocok/)
    expect(checkManualDiscountLine({ ...baris, subtotal: 40000 })).toMatch(/tidak cocok/)
    expect(checkManualDiscountLine({ ...baris, discountAmount: 0, subtotal: 50000 })).toMatch(/tidak cocok/)
  })

  it('aturan mesin tetap berlaku: alasan, melebihi harga, baris berpotongan lain, batas', () => {
    expect(checkManualDiscountLine({ ...baris, manualDiscount: { amount: 5000, reasonCode: 'ASAL' } })).toBe('Pilih alasan diskon')
    expect(checkManualDiscountLine({ ...baris, discountAmount: 60000, subtotal: 0, manualDiscount: { amount: 60000, reasonCode: 'LANGGANAN' } })).toMatch(/melebihi harga/)
    expect(checkManualDiscountLine({ ...baris, hasOtherDiscount: true })).toMatch(/sudah mendapat promo/)
    expect(checkManualDiscountLine(baris, { maxPercentOfLine: 5, maxAmountPerLine: null })).toMatch(/batas diskon/)
  })
})

describe('mesin diskon manual — nota PO Internal', () => {
  const berdiskon = { qty: 2, unitPrice: 25000, discountAmount: 5000, subtotal: 45000, manualDiscount: { amount: 5000, reasonCode: 'LANGGANAN' } }
  const polos = { qty: 1, unitPrice: 10000, discountAmount: 0, subtotal: 10000 }

  it('nota PO Internal berdiskon per barang → ditolak; tanpa diskon atau nota biasa → sah', () => {
    expect(checkManualDiscountAllowed([berdiskon, polos], { internalPo: true })).toMatch(/PO Internal/)
    expect(checkManualDiscountAllowed([polos], { internalPo: true })).toBeNull()
    expect(checkManualDiscountAllowed([berdiskon, polos], { internalPo: false })).toBeNull()
  })
})

describe('mesin diskon manual — pemeriksaan total nota', () => {
  const berdiskon = { qty: 2, unitPrice: 25000, discountAmount: 5000, subtotal: 45000, manualDiscount: { amount: 5000, reasonCode: 'LANGGANAN' } }
  const polos = { qty: 1, unitPrice: 10000, discountAmount: 0, subtotal: 10000 }

  it('nota tanpa diskon per barang tidak diperiksa — diskon total nota cara lama masih diterima', () => {
    expect(checkManualDiscountTotals([polos], { subtotal: 10000, discountTotal: 3000, grandTotal: 7000 })).toBeNull()
  })

  it('total = jumlah tagihan baris, tanpa diskon total nota → sah', () => {
    expect(checkManualDiscountTotals([berdiskon, polos], { subtotal: 55000, discountTotal: 0, grandTotal: 55000 })).toBeNull()
  })

  it('digabung diskon total nota → ditolak', () => {
    expect(checkManualDiscountTotals([berdiskon, polos], { subtotal: 55000, discountTotal: 5000, grandTotal: 50000 })).toMatch(/tidak bisa digabung/)
  })

  it('total tidak sama dengan isi keranjang → ditolak', () => {
    expect(checkManualDiscountTotals([berdiskon, polos], { subtotal: 60000, discountTotal: 0, grandTotal: 60000 })).toMatch(/tidak cocok/)
    expect(checkManualDiscountTotals([berdiskon, polos], { subtotal: 55000, discountTotal: 0, grandTotal: 50000 })).toMatch(/tidak cocok/)
  })
})

describe('mesin diskon manual — mode persen', () => {
  it('persen wajib bilangan bulat 1–100', () => {
    expect(checkManualDiscountPercent({ mode: 'PERSEN', value: 10 })).toBeNull()
    expect(checkManualDiscountPercent({ mode: 'PERSEN', value: 1 })).toBeNull()
    expect(checkManualDiscountPercent({ mode: 'PERSEN', value: 100 })).toBeNull()
    expect(checkManualDiscountPercent({ mode: 'PERSEN', value: 0 })).toMatch(/1–100/)
    expect(checkManualDiscountPercent({ mode: 'PERSEN', value: 101 })).toMatch(/1–100/)
    expect(checkManualDiscountPercent({ mode: 'PERSEN', value: 7.5 })).toMatch(/1–100/)
    // mode rupiah tidak diperiksa persen
    expect(checkManualDiscountPercent({ mode: 'PER_PCS', value: 2000 })).toBeNull()
  })

  it('tulisan persen untuk struk & laporan', () => {
    expect(manualDiscountPercentLabel(10)).toBe('Diskon 10%')
    expect(manualDiscountPercentLabel(null)).toBeNull()
    expect(manualDiscountPercentLabel(undefined)).toBeNull()
  })

  it('isian layar persen → potongan dibulatkan ke bawah, sah', () => {
    expect(resolveManualDiscount({ mode: 'PERSEN', value: 10, reasonCode: 'LANGGANAN' }, 3, 2500)).toEqual({ amount: 750, error: null })
    expect(resolveManualDiscount({ mode: 'PERSEN', value: 7, reasonCode: 'LANGGANAN' }, 1, 2550)).toEqual({ amount: 178, error: null })
    expect(resolveManualDiscount({ mode: 'PERSEN', value: 0, reasonCode: 'LANGGANAN' }, 1, 2500).error).toMatch(/1–100/)
    expect(resolveManualDiscount({ mode: 'PERSEN', value: 150, reasonCode: 'LANGGANAN' }, 1, 2500).error).toMatch(/1–100/)
  })

  it('bentuk kiriman ke server membawa persen hanya saat mode PERSEN', () => {
    expect(toManualDiscountInput({ mode: 'PERSEN', value: 10, reasonCode: 'LANGGANAN' }, 750)).toEqual({ amount: 750, reasonCode: 'LANGGANAN', percent: 10 })
    expect(toManualDiscountInput({ mode: 'PER_PCS', value: 2000, reasonCode: 'LANGGANAN' }, 2000)).toEqual({ amount: 2000, reasonCode: 'LANGGANAN' })
  })

  it('server: persen & rupiah harus konsisten', () => {
    const baris = { qty: 3, unitPrice: 2500, discountAmount: 750, subtotal: 6750, manualDiscount: { amount: 750, reasonCode: 'LANGGANAN', percent: 10 } }
    expect(checkManualDiscountLine(baris)).toBeNull()
    expect(checkManualDiscountLine({ ...baris, manualDiscount: { amount: 800, reasonCode: 'LANGGANAN', percent: 10 } })).toMatch(/tidak cocok/)
    expect(checkManualDiscountLine({ ...baris, manualDiscount: { amount: 750, reasonCode: 'LANGGANAN', percent: 0 } })).toMatch(/1–100/)
  })
})

describe('mesin diskon manual — isian layar', () => {
  it('per pcs dikali qty, per baris apa adanya; pemeriksaan sama dengan mesin', () => {
    expect(resolveManualDiscount({ mode: 'PER_PCS', value: 1500, reasonCode: 'LANGGANAN' }, 4, '25000')).toEqual({ amount: 6000, error: null })
    expect(resolveManualDiscount({ mode: 'PER_BARIS', value: 1500, reasonCode: 'LANGGANAN' }, 4, 25000)).toEqual({ amount: 1500, error: null })
    expect(resolveManualDiscount({ mode: 'PER_PCS', value: 30000, reasonCode: 'LANGGANAN' }, 2, 25000).error).toMatch(/melebihi/)
    expect(resolveManualDiscount({ mode: 'PER_PCS', value: 0, reasonCode: 'LANGGANAN' }, 2, 25000).error).toMatch(/lebih dari 0/)
    expect(resolveManualDiscount({ mode: 'PER_BARIS', value: 1000, reasonCode: '' }, 2, 25000).error).toMatch(/alasan/i)
    expect(resolveManualDiscount({ mode: 'PER_BARIS', value: 1000, reasonCode: 'LAINNYA', reasonNote: ' ' }, 2, 25000).error).toMatch(/Lainnya/)
    expect(resolveManualDiscount({ mode: 'PER_BARIS', value: 1000, reasonCode: 'LANGGANAN' }, 2, 25000, { hasOtherDiscount: true }).error).toMatch(/promo/)
  })

  it('bentuk kiriman ke server: catatan kosong tidak dikirim', () => {
    expect(toManualDiscountInput({ mode: 'PER_PCS', value: 1000, reasonCode: 'LANGGANAN', reasonNote: '  ' }, 3000)).toEqual({ amount: 3000, reasonCode: 'LANGGANAN' })
    expect(toManualDiscountInput({ mode: 'PER_BARIS', value: 1000, reasonCode: 'LAINNYA', reasonNote: ' rusak ' }, 1000)).toEqual({ amount: 1000, reasonCode: 'LAINNYA', reasonNote: 'rusak' })
  })
})
