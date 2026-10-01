import Big from 'big.js'

export interface AutoCostUom {
  uomId: number
  // Isi 1 satuan ini dalam satuan dasar (satuan dasar = 1); null = konversi belum ada
  ratio: number | null
  // true = boleh diisi otomatis (modal kosong, atau sebelumnya hasil isian otomatis)
  fillable: boolean
}

// Modal satuan lain = modal sumber / rasio sumber × rasio satuan itu.
// Berlaku dua arah: SAK → KG dibagi, KG → SAK dikali.
export function deriveCosts(
  sourceCost: number,
  sourceRatio: number | null,
  siblings: AutoCostUom[],
): Record<number, number> {
  const result: Record<number, number> = {}
  if (!sourceRatio || sourceRatio <= 0 || sourceCost <= 0) return result

  const perBase = new Big(sourceCost).div(sourceRatio)
  for (const s of siblings) {
    if (!s.fillable || !s.ratio || s.ratio <= 0) continue
    const cost = perBase.times(s.ratio).round(0, Big.roundHalfUp).toNumber()
    if (cost > 0) result[s.uomId] = cost
  }
  return result
}

export interface ProductCostUom {
  uomId: number
  ratio: number | null
  // Modal saat ini (tersimpan atau sedang diketik); null/0 = kosong
  cost: number | null
  isAuto: boolean
}

// Saran modal untuk satuan yang kosong dari modal yang sudah ada di produk yang sama.
// Sumbernya satuan terbesar yang bermodal (biasanya satuan beli, mis. SAK) — membagi
// lebih kecil galat pembulatannya daripada mengalikan.
export function suggestCosts(uoms: ProductCostUom[]): Record<number, number> {
  const source = uoms
    .filter(u => !u.isAuto && u.cost && u.cost > 0 && u.ratio && u.ratio > 0)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]
  if (!source) return {}

  return deriveCosts(
    source.cost!,
    source.ratio,
    uoms
      .filter(u => u.uomId !== source.uomId)
      .map(u => ({ uomId: u.uomId, ratio: u.ratio, fillable: !u.cost })),
  )
}
