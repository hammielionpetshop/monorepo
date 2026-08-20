import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore, type CartItem } from './cart-store'

const KG = { uomId: 1, uomCode: 'KG' }
const GRAM = { uomId: 2, uomCode: 'GRAM' }

function jagung(uom: { uomId: number; uomCode: string }, unitPrice: string, priceTier = 'RETAIL') {
  return {
    productId: 10,
    productName: 'Jagung TT',
    uomId: uom.uomId,
    uomCode: uom.uomCode,
    unitPrice,
    priceTier,
    discountAmount: '0',
    tierPrices: { RETAIL: unitPrice },
  }
}

function items(): CartItem[] {
  return useCartStore.getState().items
}

describe('cart-store addItem', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('memisahkan baris untuk produk sama dengan satuan berbeda', () => {
    const { addItem } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 4)
    addItem(jagung(GRAM, '6000'), 1)

    expect(items()).toHaveLength(2)
    expect(items()[0]).toMatchObject({ uomCode: 'KG', qty: 4, subtotal: '48000' })
    expect(items()[1]).toMatchObject({ uomCode: 'GRAM', qty: 1, subtotal: '6000' })
  })

  it('tidak menimpa satuan baris yang sudah ada', () => {
    const { addItem } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 4)
    addItem(jagung(GRAM, '6000'), 1)

    expect(items().map((i) => i.uomCode)).toEqual(['KG', 'GRAM'])
  })

  it('mengakumulasi qty bila produk, satuan, dan tier sama persis', () => {
    const { addItem } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 4)
    addItem(jagung(KG, '12000'), 2)

    expect(items()).toHaveLength(1)
    expect(items()[0]).toMatchObject({ qty: 6, subtotal: '72000' })
  })

  it('mempertahankan diskon baris saat qty diakumulasi', () => {
    const { addItem, updateQty } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 2)
    // Simulasi diskon yang sudah menempel di baris
    useCartStore.setState((s) => ({
      items: s.items.map((i) => ({ ...i, discountAmount: '5000', subtotal: '19000' })),
    }))

    addItem(jagung(KG, '12000'), 1)

    expect(items()).toHaveLength(1)
    expect(items()[0].discountAmount).toBe('5000')
    expect(items()[0].qty).toBe(3)
    expect(items()[0].subtotal).toBe('31000')

    updateQty(10, KG.uomId, 'RETAIL', 0)
    expect(items()).toHaveLength(0)
  })

  it('memisahkan baris bila tier harga berbeda walau satuan sama', () => {
    const { addItem } = useCartStore.getState()
    addItem(jagung(KG, '12000', 'RETAIL'), 1)
    addItem(jagung(KG, '10000', 'GROSIR'), 1)

    expect(items()).toHaveLength(2)
    expect(items().map((i) => i.priceTier)).toEqual(['RETAIL', 'GROSIR'])
  })

  it('updateQty & removeItem hanya mengenai baris dengan satuan yang dimaksud', () => {
    const { addItem, updateQty, removeItem } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 4)
    addItem(jagung(GRAM, '6000'), 1)

    updateQty(10, KG.uomId, 'RETAIL', 5)
    expect(items().find((i) => i.uomCode === 'KG')?.qty).toBe(5)
    expect(items().find((i) => i.uomCode === 'GRAM')?.qty).toBe(1)

    removeItem(10, GRAM.uomId, 'RETAIL')
    expect(items()).toHaveLength(1)
    expect(items()[0].uomCode).toBe('KG')
  })
})

describe('cart-store harga mengikuti tier pelanggan', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  function produk(unitPrice: string, tierPrices: Record<string, string>, priceTier = 'RETAIL') {
    return {
      productId: 20,
      productName: 'Pakan Ayam',
      uomId: KG.uomId,
      uomCode: KG.uomCode,
      unitPrice,
      priceTier,
      discountAmount: '0',
      tierPrices,
    }
  }

  it('menghargai ulang keranjang saat pelanggan bertier RESELLER dipilih', () => {
    const { addItem, setSelectedCustomer } = useCartStore.getState()
    addItem(produk('10000', { RETAIL: '10000', RESELLER: '9000' }), 3)

    setSelectedCustomer({ id: 1, name: 'Toko Jaya', tierType: 'RESELLER' })

    expect(items()[0]).toMatchObject({ priceTier: 'RESELLER', unitPrice: '9000', subtotal: '27000' })
  })

  it('membiarkan item yang belum punya harga di tier pelanggan', () => {
    const { addItem, setSelectedCustomer } = useCartStore.getState()
    addItem(produk('10000', { RETAIL: '10000' }), 2)

    setSelectedCustomer({ id: 1, name: 'Toko Jaya', tierType: 'RESELLER' })

    expect(items()[0]).toMatchObject({ priceTier: 'RETAIL', unitPrice: '10000', subtotal: '20000' })
  })

  it('mengembalikan harga ke RETAIL saat pelanggan dilepas', () => {
    const { addItem, setSelectedCustomer } = useCartStore.getState()
    addItem(produk('10000', { RETAIL: '10000', RESELLER: '9000' }), 1)
    setSelectedCustomer({ id: 1, name: 'Toko Jaya', tierType: 'RESELLER' })

    setSelectedCustomer(null)

    expect(items()[0]).toMatchObject({ priceTier: 'RETAIL', unitPrice: '10000' })
  })

  it('mempertahankan diskon baris saat harga mengikuti tier pelanggan', () => {
    const { addItem, setSelectedCustomer } = useCartStore.getState()
    addItem(produk('10000', { RETAIL: '10000', RESELLER: '9000' }), 2)
    useCartStore.setState((s) => ({
      items: s.items.map((i) => ({ ...i, discountAmount: '1000', subtotal: '19000' })),
    }))

    setSelectedCustomer({ id: 1, name: 'Toko Jaya', tierType: 'RESELLER' })

    expect(items()[0]).toMatchObject({ discountAmount: '1000', subtotal: '17000' })
  })
})

describe('cart-store restoreCart (lanjutkan daftar tunggu)', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('memulihkan item apa adanya tanpa menghitung ulang harga', () => {
    const { restoreCart } = useCartStore.getState()
    const heldItems: CartItem[] = [
      {
        productId: 10,
        productName: 'Jagung TT',
        uomId: KG.uomId,
        uomCode: KG.uomCode,
        qty: 4,
        // Harga hasil "Ubah Tier" manual sebelum ditahan — beda dari tierPrices default.
        unitPrice: '9999',
        priceTier: 'GROSIR',
        discountAmount: '0',
        subtotal: '39996',
        tierPrices: { RETAIL: '12000', GROSIR: '9999' },
      },
    ]

    restoreCart(heldItems, { id: 1, name: 'Toko Jaya', tierType: 'RESELLER' })

    expect(items()).toEqual(heldItems)
    expect(useCartStore.getState().selectedCustomer).toEqual({
      id: 1,
      name: 'Toko Jaya',
      tierType: 'RESELLER',
    })
  })

  it('melepas pelanggan bila daftar tunggu tidak punya pelanggan', () => {
    const { restoreCart, setSelectedCustomer } = useCartStore.getState()
    setSelectedCustomer({ id: 1, name: 'Toko Jaya', tierType: 'RESELLER' })

    restoreCart([
      {
        productId: 10,
        productName: 'Jagung TT',
        uomId: KG.uomId,
        uomCode: KG.uomCode,
        qty: 4,
        unitPrice: '12000',
        priceTier: 'RETAIL',
        discountAmount: '0',
        subtotal: '48000',
        tierPrices: { RETAIL: '12000' },
      },
    ])

    expect(useCartStore.getState().selectedCustomer).toBeNull()
  })
})
