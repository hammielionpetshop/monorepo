import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { checkManualDiscountAllowed, checkManualDiscountLine, checkManualDiscountTotals } from '@/lib/manual-discount'
import { applyFreeShipping, ONGKIR_KIND } from '@/lib/ongkir'
import { calcGrandTotal, calcManualDiscountTotal, useCartStore, type CartItem } from './cart-store'
import { checkoutTotals, toCheckoutItems } from './checkout-payload'

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
