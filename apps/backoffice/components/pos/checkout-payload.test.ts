import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { checkManualDiscountAllowed, checkManualDiscountLine, checkManualDiscountTotals } from '@/lib/manual-discount'
import { applyFreeShipping, ONGKIR_KIND } from '@/lib/ongkir'
import { calcGrandTotal, calcManualDiscountTotal, useCartStore, type CartItem } from './cart-store'
import { checkoutGrandTotal, checkoutTotals, toCheckoutItems } from './checkout-payload'
import { cartGiftLines, cartPromoAwards, cartPromoResult } from './promo-cart'
import { judgePromos } from '@/lib/promo/promo-judge'
import type { PromoRule } from '@/lib/promo/promo-engine'

const barang = (productId: number, unitPrice: string) => ({
  productId,
  productName: `Barang ${productId}`,
  uomId: 1,
  uomCode: 'PCS',
  unitPrice,
  priceTier: 'RETAIL',
  discountAmount: '0',
  tierPrices: { RETAIL: unitPrice },
})

function cart(): CartItem[] {
  return useCartStore.getState().items
}

/** Yang dilakukan layar bayar: susun kiriman dari isi keranjang. */
function payloadOf(items: CartItem[]) {
  return { items: toCheckoutItems(items), totals: checkoutTotals(items, Number(calcGrandTotal(items))) }
}

describe('kiriman layar bayar — diskon per barang', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('keranjang berdiskon → kiriman lolos pemeriksaan server (baris & total)', () => {
    const { addItem, setItemDiscount } = useCartStore.getState()
    addItem(barang(1, '25000'), 3)
    addItem(barang(2, '10000'), 1)
    setItemDiscount(1, 1, 'RETAIL', { mode: 'PER_PCS', value: 2000, reasonCode: 'LANGGANAN' })

    const { items, totals } = payloadOf(cart())
    const berdiskon = items.find((i) => i.productId === 1)!
    expect(berdiskon).toMatchObject({
      qty: 3, unitPrice: 25000, discountAmount: 6000, subtotal: 69000,
      manualDiscount: { amount: 6000, reasonCode: 'LANGGANAN' },
    })
    expect(items.find((i) => i.productId === 2)).not.toHaveProperty('manualDiscount')
    expect(totals).toEqual({ subtotal: 79000, discountTotal: 0, grandTotal: 79000, itemCount: 4 })

    for (const line of items) expect(checkManualDiscountLine(line)).toBeNull()
    expect(checkManualDiscountTotals(items, totals)).toBeNull()
    expect(checkManualDiscountAllowed(items, { internalPo: false })).toBeNull()
  })

  it('alasan "Lainnya" membawa ketikan kasir', () => {
    const { addItem, setItemDiscount } = useCartStore.getState()
    addItem(barang(1, '25000'), 1)
    setItemDiscount(1, 1, 'RETAIL', { mode: 'PER_BARIS', value: 5000, reasonCode: 'LAINNYA', reasonNote: '  sisa pajangan ' })

    const [line] = toCheckoutItems(cart())
    expect(line.manualDiscount).toEqual({ amount: 5000, reasonCode: 'LAINNYA', reasonNote: 'sisa pajangan' })
    expect(checkManualDiscountLine(line)).toBeNull()
  })

  it('TIDAK BISA DISKON GANDA: diskon total nota selalu 0, berapa pun isi keranjangnya', () => {
    const { addItem, setItemDiscount } = useCartStore.getState()
    addItem(barang(1, '25000'), 2)
    expect(payloadOf(cart()).totals.discountTotal).toBe(0)
    setItemDiscount(1, 1, 'RETAIL', { mode: 'PER_BARIS', value: 5000, reasonCode: 'KEMASAN_RUSAK' })
    expect(payloadOf(cart()).totals.discountTotal).toBe(0)
  })

  it('layar bayar tidak lagi punya tombol / isian diskon total nota', () => {
    const source = readFileSync(join(__dirname, 'checkout-modal.tsx'), 'utf8')
    expect(source).not.toMatch(/\+ Diskon/)
    expect(source).not.toMatch(/setDiscount|showDiscount|discountBig/)
    expect(source).not.toMatch(/discountTotal\s*:/)
    expect(source).toMatch(/checkoutTotals\(/)
  })

  it('gratis ongkir + barang berdiskon dalam satu nota → dua-duanya sah, diskon barang tidak ikut menghitung ongkir', () => {
    const { addItem, setItemDiscount } = useCartStore.getState()
    addItem(barang(1, '25000'), 2)
    addItem({ ...barang(9, '1000'), productName: 'ONGKIR', productKind: ONGKIR_KIND }, 15)
    setItemDiscount(1, 1, 'RETAIL', { mode: 'PER_BARIS', value: 5000, reasonCode: 'KEMASAN_RUSAK' })

    // Layar bayar: baris ongkir dijadikan gratis + membawa pengantar.
    const items = cart().map((i) =>
      i.productId === 9 ? { ...applyFreeShipping(i, 10000), delivery: { courierId: 3, freeShipping: true } } : i)
    expect(calcManualDiscountTotal(items)).toBe('5000')

    const payload = payloadOf(items)
    expect(payload.totals).toMatchObject({ subtotal: 45000, discountTotal: 0, grandTotal: 45000 })
    expect(payload.items.find((i) => i.productId === 9)).not.toHaveProperty('manualDiscount')
    expect(checkManualDiscountTotals(payload.items, payload.totals)).toBeNull()
  })

  it('keranjang berpromo → kiriman lolos pemeriksaan server (hakim promo)', () => {
    const promo: PromoRule = {
      id: 10, name: 'Diskon Spesial', kind: 'POTONGAN', branchIds: [1],
      startsAt: new Date('2026-10-01T00:00:00Z'), endsAt: new Date('2026-12-01T00:00:00Z'),
      dailyStartMinute: null, dailyEndMinute: null, isMultiple: true, maxPerNote: null, isActive: true,
      conditions: [{ productId: 1, uomId: 1, minQty: 1 }],
      rewards: [{ productId: 1, uomId: 1, type: 'POTONG_PER_PCS', value: 2000, qty: null }],
    }
    const now = new Date('2026-10-14T05:00:00Z')
    const { addItem } = useCartStore.getState()
    addItem(barang(1, '25000'), 3)
    addItem(barang(2, '10000'), 1)
    const items = cart()
    const awards = cartPromoAwards(items, 'RETAIL', false, { enabled: true, rules: [promo], branchId: 1, nowMs: now.getTime() })

    const payloadItems = toCheckoutItems(items, awards)
    const totals = checkoutTotals(items, checkoutGrandTotal(items, awards))
    const berpromo = payloadItems.find((i) => i.productId === 1)!
    expect(berpromo).toMatchObject({ qty: 3, unitPrice: 25000, discountAmount: 6000, subtotal: 69000, promo: { promoId: 10, amount: 6000 } })
    expect(berpromo).not.toHaveProperty('manualDiscount')
    expect(totals).toEqual({ subtotal: 79000, discountTotal: 0, grandTotal: 79000, itemCount: 4 })

    // Server menghitung ulang: kiriman harus diterima apa adanya.
    const judgement = judgePromos(
      payloadItems.map((i) => ({
        productId: i.productId, uomId: i.uomId, qty: i.qty, unitPrice: i.unitPrice, priceTier: i.priceTier,
        discountAmount: i.discountAmount, subtotal: i.subtotal, promo: i.promo ?? null, hasManualDiscount: false, excluded: false,
      })),
      [promo],
      { branchId: 1, customerTier: 'RETAIL', now, enabled: true },
      { subtotal: totals.subtotal, discountTotal: totals.discountTotal, grandTotal: totals.grandTotal },
    )
    expect(judgement.ok).toBe(true)
  })

  it('promo menang atas diskon manual pada baris yang sama (manual dilepas dari kiriman)', () => {
    const promo: PromoRule = {
      id: 10, name: 'Diskon Spesial', kind: 'POTONGAN', branchIds: [1],
      startsAt: new Date('2026-10-01T00:00:00Z'), endsAt: new Date('2026-12-01T00:00:00Z'),
      dailyStartMinute: null, dailyEndMinute: null, isMultiple: true, maxPerNote: null, isActive: true,
      conditions: [{ productId: 1, uomId: 1, minQty: 1 }],
      rewards: [{ productId: 1, uomId: 1, type: 'POTONG_PER_PCS', value: 2000, qty: null }],
    }
    const { addItem, setItemDiscount } = useCartStore.getState()
    addItem(barang(1, '25000'), 2)
    setItemDiscount(1, 1, 'RETAIL', { mode: 'PER_PCS', value: 1000, reasonCode: 'LANGGANAN' })
    const items = cart()
    const awards = cartPromoAwards(items, 'RETAIL', false, { enabled: true, rules: [promo], branchId: 1, nowMs: Date.parse('2026-10-14T05:00:00Z') })

    const [line] = toCheckoutItems(items, awards)
    expect(line).toMatchObject({ discountAmount: 4000, subtotal: 46000, promo: { promoId: 10, amount: 4000 } })
    expect(line).not.toHaveProperty('manualDiscount')
  })

  it('beli X gratis Y: baris hadiah dikirim bertanda promo.gift, total tetap, lolos hakim server', () => {
    const promo: PromoRule = {
      id: 20, name: 'Beli 2 Gratis 1', kind: 'BELI_GRATIS', branchIds: [1],
      startsAt: new Date('2026-10-01T00:00:00Z'), endsAt: new Date('2026-12-01T00:00:00Z'),
      dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null, isActive: true,
      conditions: [{ productId: 1, uomId: 1, minQty: 2 }],
      rewards: [{ productId: 2, uomId: 1, type: 'GRATIS', value: 0, qty: 1 }],
    }
    const now = new Date('2026-10-14T05:00:00Z')
    const rewardPrices = new Map([['2:1', 10000]])
    useCartStore.getState().addItem(barang(1, '25000'), 2)
    const items = cart()
    const { awards, gifts } = cartPromoResult(items, 'RETAIL', false, { enabled: true, rules: [promo], branchId: 1, nowMs: now.getTime(), rewardPrices })
    const giftLines = cartGiftLines(gifts, new Map([['2:1', { name: 'Snack', uomCode: 'PCS' }]]))
    const allItems = [...items, ...giftLines]
    const allAwards = [...awards, ...giftLines.map(() => null)]

    const payloadItems = toCheckoutItems(allItems, allAwards)
    const totals = checkoutTotals(allItems, checkoutGrandTotal(items, awards))
    const giftItem = payloadItems.find((i) => i.productId === 2)!
    expect(giftItem).toMatchObject({ qty: 1, unitPrice: 10000, discountAmount: 10000, subtotal: 0, promo: { promoId: 20, amount: 10000, gift: true } })
    expect(giftItem).not.toHaveProperty('manualDiscount')
    // Barang syarat ditagih penuh; hadiah gratis bernilai 0 → total nota tidak bertambah.
    expect(totals).toEqual({ subtotal: 50000, discountTotal: 0, grandTotal: 50000, itemCount: 3 })

    // Server menghitung ulang: baris hadiah dicocokkan dengan keluaran mesin, harus diterima.
    const judgement = judgePromos(
      payloadItems.map((i) => ({
        productId: i.productId, uomId: i.uomId, qty: i.qty, unitPrice: i.unitPrice, priceTier: i.priceTier,
        discountAmount: i.discountAmount, subtotal: i.subtotal, promo: i.promo ?? null, hasManualDiscount: false, excluded: false,
      })),
      [promo],
      { branchId: 1, customerTier: 'RETAIL', now, enabled: true, rewardPrices },
      { subtotal: totals.subtotal, discountTotal: totals.discountTotal, grandTotal: totals.grandTotal },
    )
    expect(judgement.ok).toBe(true)
  })

  it('daftar tunggu: keranjang yang disimpan lalu dibuka lagi tetap membawa diskonnya', () => {
    const { addItem, setItemDiscount, restoreCart } = useCartStore.getState()
    addItem(barang(1, '25000'), 2)
    setItemDiscount(1, 1, 'RETAIL', { mode: 'PER_PCS', value: 1000, reasonCode: 'HAMPIR_KEDALUWARSA' })

    const disimpan = JSON.parse(JSON.stringify(cart())) as CartItem[]
    useCartStore.getState().clearCart()
    restoreCart(disimpan)

    expect(cart()[0]).toMatchObject({ discountAmount: '2000', subtotal: '48000', manualDiscount: { mode: 'PER_PCS', value: 1000 } })
    // Qty diubah sesudah dibuka lagi → potongan per pcs ikut.
    useCartStore.getState().updateQty(1, 1, 'RETAIL', 3)
    const [line] = toCheckoutItems(cart())
    expect(line).toMatchObject({ discountAmount: 3000, subtotal: 72000 })
    expect(checkManualDiscountLine(line)).toBeNull()
  })
})
