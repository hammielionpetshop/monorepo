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
  /** Koreksi omzet Revisi Harga Beli kiriman internal dalam periode (tanggal disetujui) — SUDAH
   *  dikurangkan dari `revenue`; negatif = omzet bertambah karena harga direvisi naik. */
  priceRevisionRevenue: string
  /** Rincian apa adanya per satuan; menjumlahkan `qty`-nya lintas baris tidak bermakna. */
  uoms: SalesByProductUomRow[]
  /**
   * Satuan master produk (satuan dasar + semua konversi) untuk memecah qty dasar menjadi
   * satuan besar→kecil di tampilan (mis. 723 PCS → "28 SAK 23 PCS"). Kosong = hanya satuan dasar.
   */
  uomUnits: { uomId: number; code: string; ratio: number }[]
  /**
   * Rincian per kelas harga (Retail/Reseller/Grosir/Member) yang benar-benar dipakai nota.
   * Omzet & HPP di sini SUDAH dikurangi retur per tier, jadi penjumlahan tier = omzet produk
   * SEBELUM koreksi Revisi Harga Beli kiriman internal (lihat `priceRevisionRevenue` yang tetap
   * di tingkat produk karena tidak melekat ke satu tier).
   */
  tiers: SalesByProductTierRow[]
}

/** Satu baris rincian penjualan sebuah produk pada satu kelas harga. */
export interface SalesByProductTierRow {
  /** Kode tier apa adanya dari nota: RETAIL, RESELLER, GROSIR, MEMBER, dll. */
  tier: string
  tierLabel: string
  qtyBase: number
  transactionCount: number
  revenue: string
  cogs: string
  grossProfit: string
  /** Margin kotor = laba kotor ÷ omzet, dalam persen (2 desimal). Null bila omzet 0. */
  marginPercent: string | null
  /** Qty satuan dasar yang diretur pada tier ini — SUDAH dikurangkan dari `qtyBase`. */
  returnQtyBase: number
  /** Nilai refund retur pada tier ini — SUDAH dikurangkan dari `revenue`. */
  returnRevenue: string
}

export const TIER_LABELS: Record<string, string> = {
  RETAIL: 'Retail',
  RESELLER: 'Reseller',
  GROSIR: 'Grosir',
  MEMBER: 'Member',
}

const TIER_ORDER = ['RETAIL', 'RESELLER', 'GROSIR', 'MEMBER']

export function tierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? tier
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
  priceRevisionRevenue?: string | null
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

/** Baris mentah penjualan per produk × kelas harga. */
export interface SalesTierRawRow {
  productId: number | null
  priceTier: string
  qtyBase: number
  transactionCount: number
  revenue: string | null
  cogs: string | null
}

/** Baris mentah retur per produk × kelas harga (tier diambil dari baris nota asal). */
export interface ReturnTierRawRow {
  productId: number | null
  priceTier: string
  qtyBase: number
  revenue: string | null
  cogs: string | null
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

/** Margin kotor dalam persen = laba ÷ omzet × 100 (2 desimal). Null bila omzet 0 (bagi nol tak bermakna). */
function marginPercent(revenue: Big, cogs: Big): string | null {
  if (revenue.eq(0)) return null
  return revenue.minus(cogs).div(revenue).times(100).toFixed(2)
}

/**
 * Rakit rincian per kelas harga tiap produk: gabung penjualan per tier lalu kurangi retur per tier,
 * supaya angkanya setara dengan baris induk produk (sebelum koreksi Revisi Harga Beli). Tier diurutkan
 * Retail → Reseller → Grosir → Member, tier lain menyusul menurut abjad.
 */
export function buildProductTierRows(
  saleTiers: SalesTierRawRow[],
  returnTiers: ReturnTierRawRow[],
): Map<string, SalesByProductTierRow[]> {
  const byProduct = new Map<string, Map<string, SalesByProductTierRow>>()

  const ensure = (productId: number | null, tier: string): SalesByProductTierRow => {
    const pk = productKey(productId)
    let tierMap = byProduct.get(pk)
    if (!tierMap) {
      tierMap = new Map()
      byProduct.set(pk, tierMap)
    }
    let row = tierMap.get(tier)
    if (!row) {
      row = {
        tier,
        tierLabel: tierLabel(tier),
        qtyBase: 0,
        transactionCount: 0,
        revenue: '0',
        cogs: '0',
        grossProfit: '0',
        marginPercent: null,
        returnQtyBase: 0,
        returnRevenue: '0',
      }
      tierMap.set(tier, row)
    }
    return row
  }

  for (const sale of saleTiers) {
    const row = ensure(sale.productId, sale.priceTier)
    row.qtyBase += sale.qtyBase
    row.transactionCount += sale.transactionCount
    row.revenue = toBig(row.revenue).plus(toBig(sale.revenue)).toString()
    row.cogs = toBig(row.cogs).plus(toBig(sale.cogs)).toString()
  }

  for (const ret of returnTiers) {
    const row = ensure(ret.productId, ret.priceTier)
    row.qtyBase -= ret.qtyBase
    row.revenue = toBig(row.revenue).minus(toBig(ret.revenue)).toString()
    row.cogs = toBig(row.cogs).minus(toBig(ret.cogs)).toString()
    row.returnQtyBase += ret.qtyBase
    row.returnRevenue = toBig(row.returnRevenue).plus(toBig(ret.revenue)).toString()
  }

  const result = new Map<string, SalesByProductTierRow[]>()
  for (const [pk, tierMap] of byProduct) {
    const rows = [...tierMap.values()]
    for (const row of rows) {
      const revenue = toBig(row.revenue)
      const cogs = toBig(row.cogs)
      row.grossProfit = revenue.minus(cogs).toString()
      row.marginPercent = marginPercent(revenue, cogs)
    }
    rows.sort((a, b) => {
      const ai = TIER_ORDER.indexOf(a.tier)
      const bi = TIER_ORDER.indexOf(b.tier)
      const an = ai === -1 ? TIER_ORDER.length : ai
      const bn = bi === -1 ? TIER_ORDER.length : bi
      return an - bn || a.tier.localeCompare(b.tier)
    })
    result.set(pk, rows)
  }
  return result
}

export function buildSalesByProductItems(
  productRows: SalesProductRawRow[],
  uomRows: SalesUomRawRow[],
  tiersByProduct?: Map<string, SalesByProductTierRow[]>
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
      priceRevisionRevenue: toBig(row.priceRevisionRevenue).toString(),
      uoms: uomsByProduct.get(productKey(row.productId)) ?? [],
      tiers: tiersByProduct?.get(productKey(row.productId)) ?? [],
      uomUnits: [],
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

/** Koreksi omzet Revisi Harga Beli per produk × satuan (lihat `internal-return-report.ts`). */
export interface PriceRevisionRawRow {
  productId: number
  productName: string
  sku: string | null
  baseUomCode: string | null
  uomId: number
  uomCode: string | null
  uomName: string | null
  ratioToBase: number
  revenueCorrection: number
}

/**
 * Kurangkan koreksi omzet Revisi Harga Beli dari baris penjualan. Qty & HPP tidak berubah — barangnya
 * tidak bergerak, yang dibetulkan hanya harga nota. Produk yang hanya direvisi dalam periode ini
 * (dijual di periode sebelumnya) tetap muncul sebagai baris koreksi, supaya total laporan sama
 * dengan Laba Rugi.
 */
export function applyPriceRevisionsToSalesRows(
  productRows: SalesProductRawRow[],
  uomRows: SalesUomRawRow[],
  revisions: PriceRevisionRawRow[],
): { productRows: SalesProductRawRow[]; uomRows: SalesUomRawRow[] } {
  if (revisions.length === 0) return { productRows, uomRows }
  const products = productRows.map((r) => ({ ...r }))
  const byProduct = new Map(products.map((r) => [productKey(r.productId), r]))
  const uoms = uomRows.map((r) => ({ ...r }))
  const byUom = new Map(uoms.map((r) => [uomKey(r.productId, r.uomId), r]))

  for (const rev of revisions) {
    let row = byProduct.get(productKey(rev.productId))
    if (!row) {
      row = {
        productId: rev.productId,
        productName: rev.productName,
        sku: rev.sku,
        baseUomCode: rev.baseUomCode,
        qtyBase: 0,
        transactionCount: 0,
        revenue: '0',
        cogs: '0',
        masterBasePriceMin: null,
        masterBasePriceMax: null,
      }
      products.push(row)
      byProduct.set(productKey(rev.productId), row)
    }
    row.revenue = toBig(row.revenue).minus(rev.revenueCorrection).toString()
    row.priceRevisionRevenue = toBig(row.priceRevisionRevenue).plus(rev.revenueCorrection).toString()

    let uomRow = byUom.get(uomKey(rev.productId, rev.uomId))
    if (!uomRow) {
      uomRow = {
        productId: rev.productId,
        uomId: rev.uomId,
        uomCode: rev.uomCode,
        uomName: rev.uomName,
        ratioToBase: rev.ratioToBase,
        qty: 0,
        qtyBase: 0,
        transactionCount: 0,
        revenue: '0',
        cogs: '0',
        masterPriceMin: null,
        masterPriceMax: null,
      }
      uoms.push(uomRow)
      byUom.set(uomKey(rev.productId, rev.uomId), uomRow)
    }
    uomRow.revenue = toBig(uomRow.revenue).minus(rev.revenueCorrection).toString()
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
