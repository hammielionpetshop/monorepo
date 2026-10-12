'use client'

import { create } from 'zustand'
import Big from 'big.js'
import { FALLBACK_TIER } from './price-tier'
import { resolveManualDiscount, type ManualDiscountEntry } from '@/lib/manual-discount'

export interface SelectedCustomer {
  id: number
  name: string
  // Tier harga pelanggan (customers.default_tier_type). Menentukan harga yang
  // dipakai POS; produk yang tidak punya harga di tier ini jatuh ke RETAIL.
  tierType: string
}

// Tautan ke PO Internal (IBT) yang sedang diproses lewat keranjang ini. Diisi saat kasir
// menekan "Proses" di drawer PO Internal; dikirim ke checkout supaya transaksinya tertaut
// (sourceIbtId) dan IBT-nya otomatis naik status APPROVED + convertedTransactionId.
export interface CartSourceIbt {
  id: number
  ibtNumber: string
}

export interface CartItem {
  productId: number
  productName: string
  uomId: number
  uomCode: string
  qty: number
  unitPrice: string
  priceTier: string
  discountAmount: string
  subtotal: string
  // Diskon per barang yang diketik kasir (popup Diskon). `discountAmount` baris ini selalu
  // dihitung ulang dari isian ini oleh `priceLine` — jangan diisi tangan.
  manualDiscount?: ManualDiscountEntry
  // Peta tier harga yang tersedia untuk produk+UOM ini (tierType -> harga).
  // Dipakai untuk ganti tier harga secara massal tanpa fetch ulang.
  tierPrices: Record<string, string>
  // Jenis produk (products.product_kind). Layar bayar memakainya untuk mengenali baris ongkir
  // yang wajib memilih pengantar. Kosong pada daftar tunggu lama.
  productKind?: string
  // Ongkir gratis pada nota yang dicetak ulang dari riwayat (lihat lib/ongkir.ts ongkirCartFields).
  ongkirFree?: boolean
  // Baris jasa dari tab Grooming (diteruskan apa adanya ke server oleh layar bayar):
  // kucing, groomer & kondisi; atau pengantar & alamat pada baris ongkir delivery.
  grooming?: { petId: number; groomerId: number; condition: string }
  delivery?: { courierId: number; address?: string; freeShipping?: boolean }
}

interface CartStore {
  items: CartItem[]
  selectedCustomer: SelectedCustomer | null
  // Non-null hanya saat keranjang berasal dari "Proses" PO Internal. Ikut dibersihkan oleh
  // clearCart & restoreCart — daftar tunggu (open bill) tidak membawa tautan ini.
  sourceIbt: CartSourceIbt | null
  addItem: (item: Omit<CartItem, 'qty' | 'subtotal'>, qty?: number) => void
  updateQty: (productId: number, uomId: number, priceTier: string, qty: number) => void
  removeItem: (productId: number, uomId: number, priceTier: string) => void
  setBulkTier: (tier: string) => void
  // Ganti tier satu baris saja, bukan seluruh keranjang (lihat setBulkTier). Kalau hasilnya
  // bentrok dengan baris lain yang produk+satuan+tier-nya sudah sama, qty-nya digabung —
  // sama seperti addItem, supaya keranjang tidak punya dua baris kembar.
  setItemTier: (productId: number, uomId: number, priceTier: string, newTier: string) => void
  // Pasang / ganti / lepas (null) diskon per barang pada satu baris barang. Baris jasa diatur
  // dari tab Grooming; keranjang PO Internal tidak boleh didiskon (keputusan owner 2026-10-12).
  setItemDiscount: (productId: number, uomId: number, priceTier: string, discount: ManualDiscountEntry | null) => void
  clearCart: () => void
  // Dipakai saat melanjutkan daftar tunggu (open bill). Item dipulihkan APA ADANYA —
  // tidak pernah lewat repriceItems — supaya harga/tier yang sudah diedit kasir sebelum
  // ditahan (mis. lewat "Ubah Tier") tidak diam-diam dihitung ulang saat dibuka kembali.
  // Pelanggan ikut dipulihkan langsung (bukan lewat setSelectedCustomer) dengan alasan
  // yang sama: setSelectedCustomer memicu repriceItems.
  // Satu-satunya yang dihitung ulang adalah potongan baris berdiskon per barang (dari qty &
  // harga baris itu sendiri, lewat mesin diskon) — isian yang tidak sah lagi dilepas.
  restoreCart: (items: CartItem[], customer?: SelectedCustomer | null) => void
  // Impor PO Internal ke keranjang: set item + pelanggan (customer internal cabang tujuan) +
  // tautan IBT sekaligus, TANPA reprice — harga sudah ditetapkan pemanggil (tier RETAIL,
  // kasir menyesuaikan manual). Alasan sama seperti restoreCart.
  importInternalPo: (items: CartItem[], customer: SelectedCustomer | null, sourceIbt: CartSourceIbt) => void
  // "Tambah belanja" dari tab Grooming: baris jasa (grooming + ongkir delivery) masuk keranjang
  // Kasir supaya jadi SATU nota dengan barang. Baris jasa lama di keranjang diganti; barang yang
  // sudah ada dipertahankan dan dihargai ulang ke golongan pemilik kucing (pemilik = pelanggan nota).
  addServiceLines: (serviceItems: CartItem[], customer: SelectedCustomer) => void
  removeServiceLines: () => void
  setSelectedCustomer: (customer: SelectedCustomer | null) => void
  grandTotal: (items: CartItem[]) => string
  subtotalItems: (items: CartItem[]) => string
  discountTotal: (items: CartItem[]) => string
  itemCount: (items: CartItem[]) => number
}

function calcSubtotal(unitPrice: string, qty: number, discountAmount: string): string {
  return new Big(unitPrice).times(qty).minus(discountAmount).round(0).toString()
}

/**
 * Hitung ulang potongan & tagihan satu baris. Baris berdiskon manual dihitung lewat mesin
 * diskon manual; bila isiannya tidak sah lagi (mis. qty dikurangi sampai potongan melebihi
 * harga barangnya) diskonnya DILEPAS — kasir mengisinya ulang. Potongan lain di baris itu
 * (gratis ongkir) dibiarkan apa adanya.
 */
export function priceLine(item: CartItem): CartItem {
  if (!item.manualDiscount) {
    return { ...item, subtotal: calcSubtotal(item.unitPrice, item.qty, item.discountAmount) }
  }
  const { amount, error } = resolveManualDiscount(item.manualDiscount, item.qty, item.unitPrice)
  const discountAmount = error ? '0' : String(amount)
  return {
    ...item,
    manualDiscount: error ? undefined : item.manualDiscount,
    discountAmount,
    subtotal: calcSubtotal(item.unitPrice, item.qty, discountAmount),
  }
}

/** Jumlah diskon per barang (ketikan kasir) di keranjang — gratis ongkir tidak dihitung. */
export function calcManualDiscountTotal(items: CartItem[]): string {
  return items
    .reduce((acc, item) => (item.manualDiscount ? acc.plus(item.discountAmount) : acc), new Big(0))
    .round(0)
    .toString()
}

/**
 * Baris jasa dari tab Grooming (satu baris = satu kucing + satu groomer, atau ongkir delivery).
 * Baris ini TIDAK PERNAH digabung dengan baris lain dan tidak bisa diubah dari tab Kasir —
 * qty, tier, dan hapus per baris hanya berlaku untuk barang biasa.
 */
export function isServiceLine(item: Pick<CartItem, 'grooming' | 'delivery'>): boolean {
  return Boolean(item.grooming || item.delivery)
}

export function hasServiceLines(items: CartItem[]): boolean {
  return items.some(isServiceLine)
}

/** Barang biasa dengan kunci baris produk+satuan+tier ini (baris jasa tidak pernah cocok). */
function isLine(item: CartItem, productId: number, uomId: number, priceTier: string): boolean {
  return !isServiceLine(item) && item.productId === productId && item.uomId === uomId && item.priceTier === priceTier
}

/**
 * Hargai ulang seluruh isi keranjang ke satu tier. Item yang tidak punya tier
 * tersebut dibiarkan apa adanya — sejalan dengan keputusan "produk tidak ditolak
 * hanya karena tier pelanggannya belum diisi". Baris yang jadi identik
 * (produk+satuan+tier sama) digabung supaya keranjang tidak punya dua baris kembar.
 */
function repriceItems(items: CartItem[], tier: string): CartItem[] {
  const merged: CartItem[] = []
  for (const item of items) {
    const price = item.tierPrices?.[tier]
    const next: CartItem = price == null
      ? item
      : priceLine({ ...item, priceTier: tier, unitPrice: price })

    // Baris jasa ikut dihargai ulang (harga jasa mengikuti golongan pelanggan) tapi tidak digabung.
    const existing = isServiceLine(next)
      ? undefined
      : merged.find((m) => isLine(m, next.productId, next.uomId, next.priceTier))
    if (existing) {
      Object.assign(existing, mergeLine(existing, next))
    } else {
      merged.push({ ...next })
    }
  }
  return merged
}

/** Dua baris kembar digabung: qty dijumlah, diskon baris tujuan dipertahankan (atau diwarisi). */
function mergeLine(target: CartItem, incoming: Pick<CartItem, 'qty' | 'manualDiscount'>): CartItem {
  return priceLine({
    ...target,
    qty: target.qty + incoming.qty,
    manualDiscount: target.manualDiscount ?? incoming.manualDiscount,
  })
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  selectedCustomer: null,
  sourceIbt: null,

  // Kunci baris = produk + UOM + tier, sama seperti updateQty/removeItem/setBulkTier.
  // Satu produk boleh muncul lebih dari sekali dengan satuan berbeda dalam satu nota —
  // mis. Jagung TT 4.5 kg dijual sebagai 4 × KG + 1 × GRAM(500gr), karena satuan
  // terkecilnya memang bukan pecahan bebas. Sebelumnya pencocokan hanya lewat productId
  // dan UOM baris lama ditimpa, sehingga baris kedua mustahil dibuat.
  addItem: (item, qty = 1) =>
    set((state) => {
      const idx = state.items.findIndex((i) => isLine(i, item.productId, item.uomId, item.priceTier))
      if (idx >= 0) {
        // Produk+UOM+tier yang sama ditambahkan lagi → qty diakumulasi.
        // Diskon baris yang sudah ada dipertahankan, jangan tertimpa nilai default.
        return {
          items: state.items.map((i, n) =>
            n === idx ? priceLine({ ...i, qty: i.qty + qty }) : i
          ),
        }
      }
      return {
        items: [
          priceLine({ ...item, qty, subtotal: '0' }),
          ...state.items,
        ],
      }
    }),

  updateQty: (productId, uomId, priceTier, qty) =>
    set((state) => {
      if (qty <= 0) {
        return { items: state.items.filter((i) => !isLine(i, productId, uomId, priceTier)) }
      }
      return {
        items: state.items.map((i) =>
          isLine(i, productId, uomId, priceTier) ? priceLine({ ...i, qty }) : i
        ),
      }
    }),

  removeItem: (productId, uomId, priceTier) =>
    set((state) => ({ items: state.items.filter((i) => !isLine(i, productId, uomId, priceTier)) })),

  setBulkTier: (tier) => set((state) => ({ items: repriceItems(state.items, tier) })),

  setItemTier: (productId, uomId, priceTier, newTier) =>
    set((state) => {
      if (priceTier === newTier) return state
      const idx = state.items.findIndex((i) => isLine(i, productId, uomId, priceTier))
      if (idx === -1) return state

      const item = state.items[idx]
      const price = item.tierPrices?.[newTier]
      if (price == null) return state

      const updated = priceLine({ ...item, priceTier: newTier, unitPrice: price })

      const rest = state.items.filter((_, n) => n !== idx)
      const dupIdx = rest.findIndex((i) => isLine(i, updated.productId, updated.uomId, updated.priceTier))
      if (dupIdx === -1) {
        const items = [...rest]
        items.splice(idx, 0, updated)
        return { items }
      }

      return {
        items: rest.map((i, n) => (n === dupIdx ? mergeLine(i, updated) : i)),
      }
    }),

  setItemDiscount: (productId, uomId, priceTier, discount) =>
    set((state) => {
      if (state.sourceIbt) return state
      return {
        items: state.items.map((i) =>
          isLine(i, productId, uomId, priceTier) ? priceLine({ ...i, manualDiscount: discount ?? undefined, discountAmount: '0' }) : i
        ),
      }
    }),

  clearCart: () => set({ items: [], selectedCustomer: null, sourceIbt: null }),

  restoreCart: (items, customer = null) =>
    set({ items: items.map((i) => (i.manualDiscount ? priceLine(i) : i)), selectedCustomer: customer, sourceIbt: null }),

  importInternalPo: (items, customer, sourceIbt) => set({ items, selectedCustomer: customer, sourceIbt }),

  addServiceLines: (serviceItems, customer) =>
    set((state) => {
      // Keranjang PO Internal tidak boleh dicampur jasa (server menolaknya) — pemanggil sudah
      // mencegahnya; ini penjaga terakhir.
      if (state.sourceIbt) return state
      const goods = state.items.filter((i) => !isServiceLine(i))
      return {
        selectedCustomer: customer,
        items: [...serviceItems, ...repriceItems(goods, customer.tierType || FALLBACK_TIER)],
      }
    }),

  removeServiceLines: () => set((state) => ({ items: state.items.filter((i) => !isServiceLine(i)) })),

  // Harga mengikuti pelanggan. Memilih pelanggan RESELLER menghargai ulang seluruh
  // keranjang ke RESELLER; melepas pelanggan mengembalikannya ke RETAIL. Satu aturan
  // dua arah — supaya tidak ada keranjang yang tertinggal di harga pelanggan sebelumnya.
  // Penyetelan manual lewat "Ubah Tier" tetap bisa dilakukan sesudahnya.
  // Selama keranjang berisi baris grooming, pelanggan = pemilik kucing dan tidak bisa diganti
  // (server menolak kucing yang bukan milik pelanggan nota). Lepas grooming-nya dulu.
  setSelectedCustomer: (customer) =>
    set((state) => {
      if (hasServiceLines(state.items) && customer?.id !== state.selectedCustomer?.id) return state
      return {
        selectedCustomer: customer,
        items: repriceItems(state.items, customer?.tierType || FALLBACK_TIER),
      }
    }),

  grandTotal: (items) => calcGrandTotal(items),
  subtotalItems: (items) => calcSubtotalItems(items),
  discountTotal: (items) => calcDiscountTotal(items),
  itemCount: (items) => calcItemCount(items),
}))


export function calcGrandTotal(items: CartItem[]): string {
  if (items.length === 0) return '0'
  return items.reduce((acc, item) => acc.plus(item.subtotal), new Big(0)).round(0).toString()
}

export function calcSubtotalItems(items: CartItem[]): string {
  if (items.length === 0) return '0'
  return items.reduce((acc, item) => acc.plus(new Big(item.unitPrice).times(item.qty)), new Big(0)).round(0).toString()
}

export function calcDiscountTotal(items: CartItem[]): string {
  if (items.length === 0) return '0'
  return items.reduce((acc, item) => acc.plus(item.discountAmount), new Big(0)).round(0).toString()
}

export function calcItemCount(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.qty, 0)
}

export function formatRupiah(value: string): string {
  const num = new Big(value).toNumber()
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
}

