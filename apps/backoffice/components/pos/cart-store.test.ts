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
    expect(items()[0]).toMatchObject({ uomCode: 'GRAM', qty: 1, subtotal: '6000' })
    expect(items()[1]).toMatchObject({ uomCode: 'KG', qty: 4, subtotal: '48000' })
  })

  it('tidak menimpa satuan baris yang sudah ada', () => {
    const { addItem } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 4)
    addItem(jagung(GRAM, '6000'), 1)

    expect(items().map((i) => i.uomCode)).toEqual(['GRAM', 'KG'])
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
    expect(items().map((i) => i.priceTier)).toEqual(['GROSIR', 'RETAIL'])
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

describe('cart-store setItemTier', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  function produk(productId: number, unitPrice: string, tierPrices: Record<string, string>, priceTier = 'RETAIL') {
    return {
      productId,
      productName: `Produk ${productId}`,
      uomId: KG.uomId,
      uomCode: KG.uomCode,
      unitPrice,
      priceTier,
      discountAmount: '0',
      tierPrices,
    }
  }

  it('mengganti tier & harga satu item saja, item lain tidak ikut berubah', () => {
    const { addItem, setItemTier } = useCartStore.getState()
    addItem(produk(1, '10000', { RETAIL: '10000', RESELLER: '9000' }), 3)
    addItem(produk(2, '5000', { RETAIL: '5000', RESELLER: '4500' }), 1)

    setItemTier(1, KG.uomId, 'RETAIL', 'RESELLER')

    expect(items()).toHaveLength(2)
    expect(items().find((i) => i.productId === 1)).toMatchObject({
      priceTier: 'RESELLER',
      unitPrice: '9000',
      subtotal: '27000',
    })
    expect(items().find((i) => i.productId === 2)).toMatchObject({ priceTier: 'RETAIL', unitPrice: '5000' })
  })

  it('tidak melakukan apa-apa kalau tier tujuan belum punya harga', () => {
    const { addItem, setItemTier } = useCartStore.getState()
    addItem(produk(1, '10000', { RETAIL: '10000' }), 1)

    setItemTier(1, KG.uomId, 'RETAIL', 'RESELLER')

    expect(items()[0]).toMatchObject({ priceTier: 'RETAIL', unitPrice: '10000' })
  })

  it('menggabungkan qty kalau hasil ganti tier bentrok dengan baris yang sudah ada', () => {
    const { addItem, setItemTier } = useCartStore.getState()
    addItem(produk(1, '10000', { RETAIL: '10000', RESELLER: '9000' }), 2)
    addItem(produk(1, '9000', { RETAIL: '10000', RESELLER: '9000' }, 'RESELLER'), 1)

    setItemTier(1, KG.uomId, 'RETAIL', 'RESELLER')

    expect(items()).toHaveLength(1)
    expect(items()[0]).toMatchObject({ priceTier: 'RESELLER', qty: 3, subtotal: '27000' })
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

  it('diskon per barang ikut dipulihkan; potongannya dihitung ulang oleh mesin, isian tak sah dilepas', () => {
    const { restoreCart } = useCartStore.getState()
    const base = {
      productName: 'Jagung TT', uomId: KG.uomId, uomCode: KG.uomCode, unitPrice: '10000', priceTier: 'RETAIL',
      tierPrices: { RETAIL: '10000' },
    }
    restoreCart([
      // Angka tersimpan sengaja salah — yang dipercaya hanya isian diskonnya.
      { ...base, productId: 10, qty: 3, discountAmount: '999', subtotal: '1',
        manualDiscount: { mode: 'PER_PCS', value: 1000, reasonCode: 'LANGGANAN', reasonNote: null } },
      // Potongan melebihi nilai baris → dilepas, baris kembali harga penuh.
      { ...base, productId: 11, qty: 1, discountAmount: '50000', subtotal: '0',
        manualDiscount: { mode: 'PER_BARIS', value: 50000, reasonCode: 'LANGGANAN', reasonNote: null } },
    ] as CartItem[])

    expect(items()[0]).toMatchObject({ discountAmount: '3000', subtotal: '27000' })
    expect(items()[0].manualDiscount).toMatchObject({ mode: 'PER_PCS', value: 1000 })
    expect(items()[1]).toMatchObject({ discountAmount: '0', subtotal: '10000' })
    expect(items()[1].manualDiscount).toBeUndefined()
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

  it('membersihkan tautan PO Internal saat daftar tunggu dilanjutkan', () => {
    const { importInternalPo, restoreCart } = useCartStore.getState()
    importInternalPo([], null, { id: 5, ibtNumber: 'IBT-1' })
    expect(useCartStore.getState().sourceIbt).not.toBeNull()

    restoreCart([])
    expect(useCartStore.getState().sourceIbt).toBeNull()
  })
})

describe('cart-store importInternalPo (proses PO Internal)', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  const poItem: CartItem = {
    productId: 10,
    productName: 'Jagung TT',
    uomId: KG.uomId,
    uomCode: KG.uomCode,
    qty: 3,
    unitPrice: '12000',
    priceTier: 'RETAIL',
    discountAmount: '0',
    subtotal: '36000',
    tierPrices: { RETAIL: '12000' },
  }

  it('mengeset item, pelanggan internal, dan tautan IBT sekaligus tanpa reprice', () => {
    const { importInternalPo } = useCartStore.getState()
    importInternalPo(
      [poItem],
      { id: 77, name: 'Cabang Toko Depan', tierType: 'RETAIL' },
      { id: 5, ibtNumber: 'IBT-20260910-0001' },
    )

    expect(items()).toEqual([poItem])
    expect(useCartStore.getState().selectedCustomer).toMatchObject({ id: 77 })
    expect(useCartStore.getState().sourceIbt).toEqual({ id: 5, ibtNumber: 'IBT-20260910-0001' })
  })

  it('clearCart membersihkan item, pelanggan, dan tautan IBT', () => {
    const { importInternalPo, clearCart } = useCartStore.getState()
    importInternalPo([poItem], { id: 77, name: 'Cabang', tierType: 'RETAIL' }, { id: 5, ibtNumber: 'IBT-1' })

    clearCart()

    expect(items()).toHaveLength(0)
    expect(useCartStore.getState().selectedCustomer).toBeNull()
    expect(useCartStore.getState().sourceIbt).toBeNull()
  })
})

describe('cart-store baris jasa dari tab Grooming (Tambah belanja)', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  const pemilik = { id: 7, name: 'Bu Rina', tierType: 'RETAIL' }

  function grooming(petId: number): CartItem {
    return {
      productId: 50,
      productName: `GROOMING SEHAT - kucing ${petId}`,
      uomId: 9,
      uomCode: 'EKOR',
      qty: 1,
      unitPrice: '60000',
      priceTier: 'RETAIL',
      discountAmount: '0',
      subtotal: '60000',
      tierPrices: { RETAIL: '60000', RESELLER: '50000' },
      grooming: { petId, groomerId: 3, condition: 'sehat' },
    }
  }

  function ongkirDelivery(): CartItem {
    return {
      productId: 60,
      productName: 'Ongkos kirim (antar-jemput)',
      uomId: 4,
      uomCode: 'METER',
      qty: 15,
      unitPrice: '1000',
      priceTier: 'RETAIL',
      discountAmount: '0',
      subtotal: '15000',
      tierPrices: { RETAIL: '1000' },
      delivery: { courierId: 5, address: 'Jl. Mawar 1' },
    }
  }

  const ongkirBiasa = {
    productId: 60,
    productName: 'ONGKIR',
    uomId: 4,
    uomCode: 'METER',
    unitPrice: '1000',
    priceTier: 'RETAIL',
    discountAmount: '0',
    tierPrices: { RETAIL: '1000' },
  }

  it('dua kucing dengan jasa yang sama tetap dua baris, barang yang sudah ada dipertahankan', () => {
    const { addItem, addServiceLines } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 2)
    addServiceLines([grooming(1), grooming(2)], pemilik)

    expect(items()).toHaveLength(3)
    expect(items().filter((i) => i.grooming)).toHaveLength(2)
    expect(items()[2]).toMatchObject({ productName: 'Jagung TT', qty: 2 })
    expect(useCartStore.getState().selectedCustomer).toEqual(pemilik)
  })

  it('ongkir dari daftar produk tidak menumpang ke baris ongkir delivery', () => {
    const { addItem, addServiceLines } = useCartStore.getState()
    addServiceLines([grooming(1), ongkirDelivery()], pemilik)
    addItem(ongkirBiasa, 10)

    const ongkir = items().filter((i) => i.productId === 60)
    expect(ongkir).toHaveLength(2)
    expect(ongkir.find((i) => i.delivery)).toMatchObject({ qty: 15, subtotal: '15000' })
    expect(ongkir.find((i) => !i.delivery)).toMatchObject({ qty: 10, subtotal: '10000' })
  })

  it('ubah qty, hapus baris, dan ubah tier dari tab Kasir tidak menyentuh baris jasa', () => {
    const { addItem, addServiceLines, updateQty, removeItem, setItemTier } = useCartStore.getState()
    addServiceLines([grooming(1), ongkirDelivery()], pemilik)
    addItem(ongkirBiasa, 10)

    updateQty(60, 4, 'RETAIL', 3)
    updateQty(50, 9, 'RETAIL', 5)
    setItemTier(50, 9, 'RETAIL', 'RESELLER')
    removeItem(50, 9, 'RETAIL')

    expect(items().find((i) => i.grooming)).toMatchObject({ qty: 1, unitPrice: '60000', priceTier: 'RETAIL' })
    expect(items().find((i) => i.delivery)).toMatchObject({ qty: 15 })
    expect(items().find((i) => i.productId === 60 && !i.delivery)).toMatchObject({ qty: 3 })

    removeItem(60, 4, 'RETAIL')
    expect(items().filter((i) => i.productId === 60)).toHaveLength(1)
    expect(items()[0].grooming ?? items()[1].grooming).toBeTruthy()
  })

  it('pelanggan terkunci ke pemilik kucing selama ada baris jasa', () => {
    const { addServiceLines, setSelectedCustomer, removeServiceLines } = useCartStore.getState()
    addServiceLines([grooming(1)], pemilik)

    setSelectedCustomer({ id: 99, name: 'Orang lain', tierType: 'RESELLER' })
    setSelectedCustomer(null)
    expect(useCartStore.getState().selectedCustomer).toEqual(pemilik)
    expect(items()[0]).toMatchObject({ unitPrice: '60000', priceTier: 'RETAIL' })

    removeServiceLines()
    setSelectedCustomer(null)
    expect(useCartStore.getState().selectedCustomer).toBeNull()
  })

  it('Tambah belanja kedua kali mengganti baris jasa lama dan menghargai ulang barang ke golongan pemilik', () => {
    const { addItem, addServiceLines, removeServiceLines } = useCartStore.getState()
    addItem({ ...jagung(KG, '12000'), tierPrices: { RETAIL: '12000', RESELLER: '11000' } }, 1)
    addServiceLines([grooming(1), grooming(2)], pemilik)
    addServiceLines([{ ...grooming(3), unitPrice: '50000', priceTier: 'RESELLER', subtotal: '50000' }], { id: 8, name: 'Pak Adi', tierType: 'RESELLER' })

    expect(items().filter((i) => i.grooming)).toHaveLength(1)
    expect(items()[0].grooming?.petId).toBe(3)
    expect(items().find((i) => i.productId === 10)).toMatchObject({ priceTier: 'RESELLER', unitPrice: '11000' })

    removeServiceLines()
    expect(items()).toHaveLength(1)
    expect(items()[0].productId).toBe(10)
  })

  it('ubah tier seluruh keranjang menghargai ulang baris jasa tanpa menggabungnya', () => {
    const { addServiceLines, setBulkTier } = useCartStore.getState()
    addServiceLines([grooming(1), grooming(2)], pemilik)
    setBulkTier('RESELLER')

    expect(items()).toHaveLength(2)
    expect(items().every((i) => i.unitPrice === '50000' && i.qty === 1)).toBe(true)
  })

  it('keranjang PO Internal tidak menerima baris jasa', () => {
    const { importInternalPo, addServiceLines } = useCartStore.getState()
    importInternalPo([], null, { id: 1, ibtNumber: 'IBT-1' })
    addServiceLines([grooming(1)], pemilik)
    expect(items()).toHaveLength(0)
  })
})

describe('cart-store diskon per barang', () => {
  const langganan = { mode: 'PER_PCS', value: 2000, reasonCode: 'LANGGANAN' } as const

  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('potongan per pcs ikut qty; potongan per baris tetap', () => {
    const { addItem, setItemDiscount, updateQty } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 2)
    setItemDiscount(10, 1, 'RETAIL', langganan)
    expect(items()[0]).toMatchObject({ discountAmount: '4000', subtotal: '20000' })

    updateQty(10, 1, 'RETAIL', 5)
    expect(items()[0]).toMatchObject({ discountAmount: '10000', subtotal: '50000' })
    addItem(jagung(KG, '12000'), 1)
    expect(items()[0]).toMatchObject({ qty: 6, discountAmount: '12000', subtotal: '60000' })

    setItemDiscount(10, 1, 'RETAIL', { mode: 'PER_BARIS', value: 5000, reasonCode: 'KEMASAN_RUSAK' })
    updateQty(10, 1, 'RETAIL', 2)
    expect(items()[0]).toMatchObject({ discountAmount: '5000', subtotal: '19000' })
  })

  it('melepas diskon mengembalikan harga penuh', () => {
    const { addItem, setItemDiscount } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 2)
    setItemDiscount(10, 1, 'RETAIL', langganan)
    setItemDiscount(10, 1, 'RETAIL', null)
    expect(items()[0]).toMatchObject({ discountAmount: '0', subtotal: '24000' })
    expect(items()[0].manualDiscount).toBeUndefined()
  })

  it('isian tidak sah (tanpa alasan / melebihi harga) tidak pernah terpasang', () => {
    const { addItem, setItemDiscount } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 1)
    setItemDiscount(10, 1, 'RETAIL', { mode: 'PER_BARIS', value: 5000, reasonCode: '' })
    expect(items()[0]).toMatchObject({ discountAmount: '0', subtotal: '12000' })
    setItemDiscount(10, 1, 'RETAIL', { mode: 'PER_BARIS', value: 13000, reasonCode: 'LANGGANAN' })
    expect(items()[0]).toMatchObject({ discountAmount: '0', subtotal: '12000' })
    expect(items()[0].manualDiscount).toBeUndefined()
  })

  it('qty dikurangi sampai potongan melebihi harga barangnya → diskon dilepas, bukan jadi minus', () => {
    const { addItem, setItemDiscount, updateQty } = useCartStore.getState()
    addItem(jagung(KG, '12000'), 3)
    setItemDiscount(10, 1, 'RETAIL', { mode: 'PER_BARIS', value: 30000, reasonCode: 'KEMASAN_RUSAK' })
    expect(items()[0].subtotal).toBe('6000')
    updateQty(10, 1, 'RETAIL', 2)
    expect(items()[0]).toMatchObject({ discountAmount: '0', subtotal: '24000' })
    expect(items()[0].manualDiscount).toBeUndefined()
  })

  it('ganti golongan harga: diskon dihitung ulang di harga baru', () => {
    const { addItem, setItemDiscount, setSelectedCustomer } = useCartStore.getState()
    addItem({ ...jagung(KG, '12000'), tierPrices: { RETAIL: '12000', RESELLER: '10000' } }, 2)
    setItemDiscount(10, 1, 'RETAIL', langganan)
    setSelectedCustomer({ id: 7, name: 'Toko Ani', tierType: 'RESELLER' })
    expect(items()[0]).toMatchObject({ priceTier: 'RESELLER', unitPrice: '10000', discountAmount: '4000', subtotal: '16000' })
  })

  it('keranjang PO Internal tidak bisa didiskon', () => {
    const { importInternalPo, setItemDiscount } = useCartStore.getState()
    importInternalPo([{ ...jagung(KG, '12000'), qty: 2, subtotal: '24000' }], null, { id: 5, ibtNumber: 'IBT-5' })
    setItemDiscount(10, 1, 'RETAIL', langganan)
    expect(items()[0]).toMatchObject({ discountAmount: '0', subtotal: '24000' })
    expect(items()[0].manualDiscount).toBeUndefined()
  })
})
