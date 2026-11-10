import Big from 'big.js'

/**
 * Larangan jual di bawah modal (spec 2026-11-10 periksa harga jual, Tahap 1).
 * Kasir: nota ditolak. Bulk Sale: boleh setelah dua kali konfirmasi. Promo resmi dikecualikan.
 */

export interface BelowCostLineInput {
  productId: number
  productName: string
  uomId: number
  uomCode?: string | null
  qty: number | string
  unitPrice: number | string
  /** Potongan baris (diskon manual / bagian diskon nota). Potongan promo tidak dihitung. */
  discountAmount: number | string
  /** Baris berpromo resmi: yang dibandingkan harga sebelum potongan promo. */
  promo?: unknown
}

export interface BelowCostLine {
  productId: number
  productName: string
  uomId: number
  uomCode: string | null
  qty: number
  /** Harga bersih per satuan sesudah potongan, dibulatkan ke rupiah. */
  netUnitPrice: number
  unitCost: number
  /** Total rugi baris = (modal − harga bersih) × qty. */
  loss: number
}

export interface UomCostRow {
  uomId: number
  costPrice: number | string
}

/**
 * Modal satu satuan di cabang: baris modal satuan itu; bila kosong, modal satuan dasar × rasio
 * (rasio = isi satuan itu dalam satuan dasar). Null = modal tidak diketahui → tidak dicek.
 */
export function unitCostFor(
  costs: UomCostRow[],
  uomId: number,
  baseUomId: number | null,
  ratioOf: (uomId: number) => number | null,
): number | null {
  const direct = costs.find(c => c.uomId === uomId)
  if (direct && Number(direct.costPrice) > 0) return Number(direct.costPrice)
  if (baseUomId == null) return null
  const ratio = uomId === baseUomId ? 1 : ratioOf(uomId)
  if (!ratio || ratio <= 0) return null
  const base = costs.find(c => c.uomId === baseUomId)
  if (base && Number(base.costPrice) > 0) {
    return new Big(base.costPrice).times(ratio).round(0, Big.roundHalfUp).toNumber()
  }
  // Satuan dasar tanpa modal: turunkan dari satuan lain yang punya modal (rasio terbesar dulu).
  const others = costs
    .filter(c => Number(c.costPrice) > 0 && c.uomId !== uomId)
    .map(c => ({ c, r: c.uomId === baseUomId ? 1 : ratioOf(c.uomId) }))
    .filter((x): x is { c: UomCostRow; r: number } => x.r != null && x.r > 0)
    .sort((a, b) => b.r - a.r)
  if (others.length === 0) return null
  const perBase = new Big(others[0].c.costPrice).div(others[0].r)
  return perBase.times(ratio).round(0, Big.roundHalfUp).toNumber()
}

/** Harga bersih per satuan: harga dikurangi potongan baris dibagi qty. Promo: harga sebelum promo. */
export function netUnitPrice(line: BelowCostLineInput): Big {
  const price = new Big(line.unitPrice)
  if (line.promo != null) return price
  const qty = new Big(line.qty)
  if (qty.lte(0)) return price
  return price.times(qty).minus(line.discountAmount).div(qty)
}

/** Baris yang harga bersihnya di bawah modal. `costOf` null = modal tidak diketahui (dilewati). */
export function findBelowCostLines(
  lines: BelowCostLineInput[],
  costOf: (line: BelowCostLineInput) => number | null,
): BelowCostLine[] {
  const result: BelowCostLine[] = []
  for (const line of lines) {
    const cost = costOf(line)
    if (cost == null || cost <= 0) continue
    const net = netUnitPrice(line)
    if (net.gte(cost)) continue
    const qty = Number(line.qty)
    result.push({
      productId: line.productId,
      productName: line.productName,
      uomId: line.uomId,
      uomCode: line.uomCode ?? null,
      qty,
      netUnitPrice: net.round(0, Big.roundDown).toNumber(),
      unitCost: cost,
      loss: new Big(cost).minus(net).times(qty).round(0, Big.roundHalfUp).toNumber(),
    })
  }
  return result
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

export function describeBelowCostLine(l: BelowCostLine): string {
  const uom = l.uomCode ? `/${l.uomCode}` : ''
  return `${l.productName}: harga ${rupiah(l.netUnitPrice)}${uom}, modal ${rupiah(l.unitCost)}${uom}`
}

export function belowCostCashierMessage(lines: BelowCostLine[]): string {
  return `Harga di bawah modal — hubungi kantor untuk memeriksa harga. ${lines.map(describeBelowCostLine).join('; ')}`
}

export class BelowCostSaleError extends Error {
  readonly code = 'BELOW_COST'
  readonly status = 409
  constructor(readonly lines: BelowCostLine[], message = belowCostCashierMessage(lines)) {
    super(message)
    this.name = 'BelowCostSaleError'
  }
}

/** Cara transaksi menangani baris di bawah modal. */
export type BelowCostPolicy = 'REJECT' | 'CONFIRMED' | 'AUDIT_ONLY'
