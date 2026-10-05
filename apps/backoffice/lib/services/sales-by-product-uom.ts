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
  /** Qty satuan dasar yang diretur dalam periode — SUDAH dikurangkan dari `qtyBase`. */
  returnQtyBase: number
  /** Nilai refund retur dalam periode — SUDAH dikurangkan dari `revenue`. */
  returnRevenue: string
  /** Rincian apa adanya per satuan; menjumlahkan `qty`-nya lintas baris tidak bermakna. */
  uoms: SalesByProductUomRow[]
}

export interface SalesByProductData {
  startDate: string
  endDate: string
  productIds: number[]
  categoryId: number | null
  brandId: number | null
  priceTier: string | null
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
  returnQtyBase?: number
  returnRevenue?: string | null
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
      returnQtyBase: row.returnQtyBase ?? 0,
      returnRevenue: toBig(row.returnRevenue).toString(),
      uoms: uomsByProduct.get(productKey(row.productId)) ?? [],
    }
  })
}

/** Agregat retur per produk dalam periode (tanggal retur), retur yang dibatalkan tidak ikut. */
export interface ReturnProductRawRow {
  productId: number | null
  productName: string
  sku: string | null
  baseUomCode: string | null
  qtyBase: number
  revenue: string | null
  cogs: string | null
}

/** Agregat retur per produk × satuan dalam periode. */
export interface ReturnUomRawRow {
  productId: number | null
  uomId: number | null
  uomCode: string | null
  uomName: string | null
  ratioToBase: number
  qty: number
  qtyBase: number
  revenue: string | null
  cogs: string | null
}

const uomKey = (productId: number | null, uomId: number | null) => `${productKey(productId)}:${uomId ?? 'NULL'}`

/**
 * Kurangkan retur dari baris penjualan mentah — retur adalah pengurang penjualan (retur
 * penjualan), bukan sekadar pemotong piutang. Produk yang hanya diretur dalam periode ini
 * (dijual di periode sebelumnya) tetap muncul sebagai baris bernilai negatif, supaya total
 * laporan sama dengan Laba Rugi.
 */
export function applyReturnsToSalesRows(
  productRows: SalesProductRawRow[],
  uomRows: SalesUomRawRow[],
  returnProducts: ReturnProductRawRow[],
  returnUoms: ReturnUomRawRow[],
): { productRows: SalesProductRawRow[]; uomRows: SalesUomRawRow[] } {
  const products = productRows.map((r) => ({ ...r }))
  const byProduct = new Map(products.map((r) => [productKey(r.productId), r]))
  for (const ret of returnProducts) {
    let row = byProduct.get(productKey(ret.productId))
    if (!row) {
      row = {
        productId: ret.productId,
        productName: ret.productName,
        sku: ret.sku,
        baseUomCode: ret.baseUomCode,
        qtyBase: 0,
        transactionCount: 0,
        revenue: '0',
        cogs: '0',
        masterBasePriceMin: null,
        masterBasePriceMax: null,
      }
      products.push(row)
      byProduct.set(productKey(ret.productId), row)
    }
    row.qtyBase -= ret.qtyBase
    row.revenue = toBig(row.revenue).minus(toBig(ret.revenue)).toString()
    row.cogs = toBig(row.cogs).minus(toBig(ret.cogs)).toString()
    row.returnQtyBase = (row.returnQtyBase ?? 0) + ret.qtyBase
    row.returnRevenue = toBig(row.returnRevenue).plus(toBig(ret.revenue)).toString()
  }

  const uoms = uomRows.map((r) => ({ ...r }))
  const byUom = new Map(uoms.map((r) => [uomKey(r.productId, r.uomId), r]))
  for (const ret of returnUoms) {
    let row = byUom.get(uomKey(ret.productId, ret.uomId))
    if (!row) {
      row = {
        productId: ret.productId,
        uomId: ret.uomId,
        uomCode: ret.uomCode,
        uomName: ret.uomName,
        ratioToBase: ret.ratioToBase,
        qty: 0,
        qtyBase: 0,
        transactionCount: 0,
        revenue: '0',
        cogs: '0',
        masterPriceMin: null,
        masterPriceMax: null,
      }
      uoms.push(row)
      byUom.set(uomKey(ret.productId, ret.uomId), row)
    }
    row.qty -= ret.qty
    row.qtyBase -= ret.qtyBase
    row.revenue = toBig(row.revenue).minus(toBig(ret.revenue)).toString()
    row.cogs = toBig(row.cogs).minus(toBig(ret.cogs)).toString()
  }

  products.sort((a, b) => toBig(b.revenue).cmp(toBig(a.revenue)))
  return { productRows: products, uomRows: uoms }
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
