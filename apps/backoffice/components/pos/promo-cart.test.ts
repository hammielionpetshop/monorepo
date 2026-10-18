import { describe, expect, it } from 'vitest'
import type { PromoGift, PromoRule } from '@/lib/promo/promo-engine'
import { ONGKIR_KIND } from '@/lib/ongkir'
import type { CartItem } from './cart-store'
import { cartGiftLines, cartPromoAwards, cartPromoGrandTotal, cartPromoResult, cartPromoTotal, promoLineSubtotal } from './promo-cart'

const barang = (productId: number, unitPrice: string, qty: number, extra: Partial<CartItem> = {}): CartItem => ({
  productId,
  productName: `Barang ${productId}`,
  uomId: 1,
  uomCode: 'PCS',
  qty,
  unitPrice,
  priceTier: 'RETAIL',
  discountAmount: '0',
  subtotal: String(Number(unitPrice) * qty),
  tierPrices: { RETAIL: unitPrice },
  ...extra,
})

// Potongan Rp 2.000 / pcs untuk produk 1, sepanjang hari, satu cabang.
const promoPotongan: PromoRule = {
  id: 10,
  name: 'Diskon Spesial',
  kind: 'POTONGAN',
  branchIds: [1],
  startsAt: new Date('2026-10-01T00:00:00Z'),
  endsAt: new Date('2026-12-01T00:00:00Z'),
  dailyStartMinute: null,
  dailyEndMinute: null,
  isMultiple: true,
  maxPerNote: null,
  isActive: true,
  conditions: [{ productId: 1, uomId: 1, minQty: 1 }],
  rewards: [{ productId: 1, uomId: 1, type: 'POTONG_PER_PCS', value: 2000, qty: null }],
}

const now = new Date('2026-10-14T05:00:00Z').getTime()
const base = { enabled: true, rules: [promoPotongan], branchId: 1, nowMs: now }

describe('promo-cart — hitung promo keranjang di layar', () => {
  it('baris yang cocok kena potongan; baris lain tidak', () => {
    const items = [barang(1, '25000', 3), barang(2, '10000', 1)]
    const awards = cartPromoAwards(items, 'RETAIL', false, base)
    expect(awards[0]).toMatchObject({ promoId: 10, promoName: 'Diskon Spesial', units: 3, amount: 6000 })
    expect(awards[1]).toBeNull()
    expect(promoLineSubtotal(items[0], awards[0])).toBe('69000')
    expect(promoLineSubtotal(items[1], awards[1])).toBe('10000')
    expect(cartPromoGrandTotal(items, awards)).toBe('79000')
    expect(cartPromoTotal(awards)).toBe('6000')
  })

  it('pelanggan Reseller / Grosir tidak kena promo', () => {
    const items = [barang(1, '25000', 2)]
    expect(cartPromoAwards(items, 'RESELLER', false, base)[0]).toBeNull()
    // Tanpa pelanggan (umum) = Retail → tetap kena.
    expect(cartPromoAwards(items, null, false, base)[0]).toMatchObject({ amount: 4000 })
  })

  it('PO Internal (di luar jangkauan) & saklar darurat mati → tidak ada promo', () => {
    const items = [barang(1, '25000', 2)]
    expect(cartPromoAwards(items, 'RETAIL', true, base)[0]).toBeNull()
    expect(cartPromoAwards(items, 'RETAIL', false, { ...base, enabled: false })[0]).toBeNull()
  })

  it('ongkos kirim tidak pernah kena promo', () => {
    const ongkir = barang(1, '1000', 10, { productName: 'ONGKIR', productKind: ONGKIR_KIND })
    expect(cartPromoAwards([ongkir], 'RETAIL', false, base)[0]).toBeNull()
  })

  it('baris di luar jam promo tidak kena', () => {
    const malam: PromoRule = { ...promoPotongan, dailyStartMinute: 22 * 60, dailyEndMinute: 23 * 60 }
    const items = [barang(1, '25000', 1)]
    // now = 12.00 WIB → di luar 22.00–23.00.
    expect(cartPromoAwards(items, 'RETAIL', false, { ...base, rules: [malam] })[0]).toBeNull()
  })

  // P3d — sisa jatah & stok dari server membatasi promo di layar.
  it('kuota pcs: sisa jatah mepet memotong sebagian', () => {
    const berkuota: PromoRule = { ...promoPotongan, quotaKind: 'PCS', quotaPerBranch: 25 }
    const items = [barang(1, '25000', 5)]
    // Sisa jatah cabang ini tinggal 2 → hanya 2 pcs kena promo (2 × 2.000).
    const input = { ...base, rules: [berkuota], remainingQuota: new Map([[10, 2]]) }
    expect(cartPromoAwards(items, 'RETAIL', false, input)[0]).toMatchObject({ units: 2, amount: 4000 })
  })

  it('kuota pcs: jatah habis → promo berhenti di layar', () => {
    const berkuota: PromoRule = { ...promoPotongan, quotaKind: 'PCS', quotaPerBranch: 25 }
    const items = [barang(1, '25000', 3)]
    expect(cartPromoAwards(items, 'RETAIL', false, { ...base, rules: [berkuota], remainingQuota: new Map([[10, 0]]) })[0]).toBeNull()
  })

  it('kuota nota: sisa < 1 → promo tidak berlaku untuk nota ini', () => {
    const berkuota: PromoRule = { ...promoPotongan, quotaKind: 'NOTA', quotaPerBranch: 10 }
    const items = [barang(1, '25000', 3)]
    expect(cartPromoAwards(items, 'RETAIL', false, { ...base, rules: [berkuota], remainingQuota: new Map([[10, 0]]) })[0]).toBeNull()
    // Masih ada jatah nota → promo utuh.
    expect(cartPromoAwards(items, 'RETAIL', false, { ...base, rules: [berkuota], remainingQuota: new Map([[10, 1]]) })[0]).toMatchObject({ units: 3, amount: 6000 })
  })

  it('syarat stok: barang hadiah berstok 0 tidak kena promo', () => {
    const bersyarat: PromoRule = { ...promoPotongan, requireStock: true }
    const items = [barang(1, '25000', 2)]
    expect(cartPromoAwards(items, 'RETAIL', false, { ...base, rules: [bersyarat], stock: new Map([['1:1', 0]]) })[0]).toBeNull()
    // Stok ada → kena.
    expect(cartPromoAwards(items, 'RETAIL', false, { ...base, rules: [bersyarat], stock: new Map([['1:1', 5]]) })[0]).toMatchObject({ amount: 4000 })
  })

  // P4d — beli X gratis Y: baris hadiah muncul sebagai gift tambahan, bukan potongan baris syarat.
  const promoGratis: PromoRule = {
    ...promoPotongan,
    id: 20,
    name: 'Beli 2 Gratis 1',
    kind: 'BELI_GRATIS',
    isMultiple: false,
    conditions: [{ productId: 1, uomId: 1, minQty: 2 }],
    rewards: [{ productId: 2, uomId: 1, type: 'GRATIS', value: 0, qty: 1 }],
  }

  it('beli X gratis Y: hadiah jadi gift (barang syarat tidak dipotong, total tetap)', () => {
    const items = [barang(1, '25000', 2)]
    const input = { ...base, rules: [promoGratis], rewardPrices: new Map([['2:1', 10000]]) }
    const { awards, gifts } = cartPromoResult(items, 'RETAIL', false, input)
    expect(awards[0]).toBeNull()
    expect(gifts).toHaveLength(1)
    expect(gifts[0]).toMatchObject({ promoId: 20, productId: 2, uomId: 1, qty: 1, unitPrice: 10000, amount: 10000 })
    // Hadiah gratis tidak mengurangi total keranjang — barang syarat tetap ditagih penuh.
    expect(cartPromoGrandTotal(items, awards)).toBe('50000')
    expect(cartPromoTotal(awards)).toBe('0')
  })

  it('syarat belum cukup / tanpa harga hadiah → tidak ada hadiah', () => {
    const kurang = cartPromoResult([barang(1, '25000', 1)], 'RETAIL', false, { ...base, rules: [promoGratis], rewardPrices: new Map([['2:1', 10000]]) })
    expect(kurang.gifts).toHaveLength(0)
    // Harga hadiah tidak ada di cabang ini → mesin melewati hadiahnya.
    const tanpaHarga = cartPromoResult([barang(1, '25000', 2)], 'RETAIL', false, { ...base, rules: [promoGratis] })
    expect(tanpaHarga.gifts).toHaveLength(0)
  })

  it('cartGiftLines: baris hadiah terkunci (promoGift) dengan nama & satuan dari rewardInfo', () => {
    const gifts: PromoGift[] = [{ promoId: 20, promoName: 'Beli 2 Gratis 1', productId: 2, uomId: 1, unitPrice: 10000, qty: 1, amount: 10000 }]
    const [line] = cartGiftLines(gifts, new Map([['2:1', { name: 'Snack Kucing', uomCode: 'PCS' }]]))
    expect(line).toMatchObject({
      productId: 2, productName: 'Snack Kucing', uomId: 1, uomCode: 'PCS', qty: 1,
      unitPrice: '10000', discountAmount: '10000', subtotal: '0', priceTier: 'RETAIL',
      promoGift: { promoId: 20, promoName: 'Beli 2 Gratis 1' },
    })
  })

  it('cartGiftLines tanpa rewardInfo tetap aman (nama cadangan)', () => {
    const gifts: PromoGift[] = [{ promoId: 20, promoName: 'X', productId: 2, uomId: 1, unitPrice: 10000, qty: 1, amount: 10000 }]
    expect(cartGiftLines(gifts, new Map())[0]).toMatchObject({ productName: 'Barang hadiah', uomCode: '' })
  })
})
