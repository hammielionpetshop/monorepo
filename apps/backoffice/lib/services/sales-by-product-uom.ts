import Big from 'big.js'

/**
 * Perakitan baris laporan penjualan per produk yang sadar satuan.
 *
 * Aturan UOM repo ini: `products.base_uom_id` SELALU satuan terkecil, dan
 * `product_uom_conversions.ratio` dibaca **1 satuan itu = ratio × satuan dasar**.
 * Jadi konversi ke satuan dasar adalah `qty × ratio` (mengalikan, bukan membagi).
 * Salah arah di sini pernah menghasilkan HPP 24× lipat pada LOQY KLG TUNA.
 *
 * Berkas ini sengaja bebas dari akses DB supaya perhitungannya bisa diuji langsung.
 */

export interface SalesByProductUomRow {
  uomId: number | null
  uomCode: string
  uomName: string
  /** 1 satuan ini = ratioToBase × satuan dasar. Selalu 1 untuk satuan dasar itu sendiri. */
  ratioToBase: number
  /** Qty apa adanya dalam satuan ini — tidak dikonversi. */
  qty: number
  /** qty × ratioToBase. */
  qtyBase: number
  transactionCount: number
  revenue: string
  cogs: string
  grossProfit: string
  /** Pendapatan ÷ qty — harga yang benar-benar terjadi per 1 satuan ini, sudah termasuk diskon item. */
  realizedPrice: string
  /** Harga master tier RETAIL per 1 satuan ini, pada cabang-cabang yang menjualnya. */
  masterPriceMin: string | null
  masterPriceMax: string | null
}

export interface SalesByProductItem {
  productId: number | null
  productName: string
  sku: string | null
  baseUomCode: string | null
  /** Total penjualan produk ini dalam satuan dasar — inilah satu-satunya qty yang boleh dijumlahkan. */
  qtyBase: number
  transactionCount: number
  revenue: string
  cogs: string
  grossProfit: string
  /** Pendapatan ÷ qtyBase — rata-rata realisasi per 1 satuan dasar, campuran semua satuan & tier. */
  realizedPricePerBase: string
  masterPricePerBaseMin: string | null
  masterPricePerBaseMax: string | null
  /** Rincian apa adanya per satuan; menjumlahkan `qty`-nya lintas baris tidak bermakna. */
  uoms: SalesByProductUomRow[]
}

export interface SalesByProductData {
  startDate: string
  endDate: string
  productId: number | null
  branchId: number | null
  customerId: number | null
  items: SalesByProductItem[]
  totalRevenue: string
  totalCogs: string
  totalGrossProfit: string
}

/** Baris mentah hasil agregasi per produk. */
export interface SalesProductRawRow {
  productId: number | null
  productName: string
  sku: string | null
  baseUomCode: string | null
  qtyBase: number
  transactionCount: number
  revenue: string | null
  cogs: string | null
  masterBasePriceMin: string | number | null
  masterBasePriceMax: string | number | null
}

/** Baris mentah hasil agregasi per produk × satuan. */
export interface SalesUomRawRow {
  productId: number | null
  uomId: number | null
  uomCode: string | null
  uomName: string | null
  ratioToBase: number
  qty: number
  qtyBase: number
  transactionCount: number
  revenue: string | null
  cogs: string | null
  masterPriceMin: string | number | null
  masterPriceMax: string | number | null
}

/** Produk yang sudah dihapus tetap punya baris penjualan; productId-nya NULL dan dikelompokkan jadi satu. */
function productKey(productId: number | null): string {
  return productId == null ? 'NULL' : String(productId)
}

function toBig(value: string | null | undefined): Big {
  try {
    return new Big(value ?? '0')
  } catch {
    return new Big(0)
  }
}

function toPriceString(value: string | number | null | undefined): string | null {
  if (value == null) return null
  try {
    return new Big(value).toString()
  } catch {
    return null
  }
}

/** Harga per satuan boleh pecahan (diskon, campuran tier) — dibulatkan 2 desimal, bukan ke rupiah bulat. */
function pricePerUnit(revenue: Big, qty: number): string {
  if (qty <= 0) return '0'
  return revenue.div(qty).toFixed(2)
}

export function buildSalesByProductItems(
  productRows: SalesProductRawRow[],
  uomRows: SalesUomRawRow[]
): SalesByProductItem[] {
  const uomsByProduct = new Map<string, SalesByProductUomRow[]>()

  for (const row of uomRows) {
    const revenue = toBig(row.revenue)
    const cogs = toBig(row.cogs)
    const list = uomsByProduct.get(productKey(row.productId)) ?? []
    list.push({
      uomId: row.uomId,
      uomCode: row.uomCode ?? '—',
      uomName: row.uomName ?? '—',
      ratioToBase: row.ratioToBase,
      qty: row.qty,
      qtyBase: row.qtyBase,
      transactionCount: row.transactionCount,
      revenue: revenue.toString(),
      cogs: cogs.toString(),
      grossProfit: revenue.minus(cogs).toString(),
      realizedPrice: pricePerUnit(revenue, row.qty),
      masterPriceMin: toPriceString(row.masterPriceMin),
      masterPriceMax: toPriceString(row.masterPriceMax),
    })
    uomsByProduct.set(productKey(row.productId), list)
  }

  for (const list of uomsByProduct.values()) {
    list.sort((a, b) => b.ratioToBase - a.ratioToBase || a.uomCode.localeCompare(b.uomCode))
  }

  return productRows.map((row) => {
    const revenue = toBig(row.revenue)
    const cogs = toBig(row.cogs)
    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      baseUomCode: row.baseUomCode,
      qtyBase: row.qtyBase,
      transactionCount: row.transactionCount,
      revenue: revenue.toString(),
      cogs: cogs.toString(),
      grossProfit: revenue.minus(cogs).toString(),
      realizedPricePerBase: pricePerUnit(revenue, row.qtyBase),
      masterPricePerBaseMin: toPriceString(row.masterBasePriceMin),
      masterPricePerBaseMax: toPriceString(row.masterBasePriceMax),
      uoms: uomsByProduct.get(productKey(row.productId)) ?? [],
    }
  })
}

export function sumSalesTotals(items: SalesByProductItem[]): {
  totalRevenue: string
  totalCogs: string
  totalGrossProfit: string
} {
  let totalRevenue = new Big(0)
  let totalCogs = new Big(0)

  for (const item of items) {
    totalRevenue = totalRevenue.plus(item.revenue)
    totalCogs = totalCogs.plus(item.cogs)
  }

  return {
    totalRevenue: totalRevenue.toString(),
    totalCogs: totalCogs.toString(),
    totalGrossProfit: totalRevenue.minus(totalCogs).toString(),
  }
}

/**
 * Baris induk sudah cukup mewakili kalau produk hanya terjual dalam satuan dasar;
 * selain itu rinciannya perlu bisa dibuka karena angkanya berbeda dari induk.
 */
export function hasMeaningfulUomBreakdown(item: SalesByProductItem): boolean {
  if (item.uoms.length > 1) return true
  return item.uoms.some((u) => u.ratioToBase !== 1)
}

/** Rentang harga master: satu angka bila semua cabang sama, rentang bila berbeda. */
export function formatPriceRange(
  min: string | null,
  max: string | null,
  format: (value: string) => string
): string {
  if (min == null || max == null) return '—'
  if (new Big(min).eq(new Big(max))) return format(min)
  return `${format(min)} – ${format(max)}`
}
