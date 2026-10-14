import { describe, expect, it } from 'vitest'
import type { PromoRule } from '@/lib/promo/promo-engine'
import { ONGKIR_KIND } from '@/lib/ongkir'
import type { CartItem } from './cart-store'
import { cartPromoAwards, cartPromoGrandTotal, cartPromoTotal, promoLineSubtotal } from './promo-cart'

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
})
