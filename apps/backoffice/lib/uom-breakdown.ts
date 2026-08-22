export interface UomUnit {
  uomId: number
  code: string
  ratio: number // 1 unit ini = ratio x satuan dasar
}

export interface QtyBreakdownPart {
  uomId: number
  code: string
  qty: number
}

export interface QtyBreakdown {
  negative: boolean
  parts: QtyBreakdownPart[]
}

/**
 * Pecah qty satuan dasar menjadi kombinasi satuan terbesar->terkecil (mis. 500 PCS dengan
 * satuan Dus=100pcs, Box=10pcs, Pcs=1 -> 5 Dus 0 Box 0 Pcs). Greedy dari ratio terbesar.
 * `units` wajib menyertakan satuan dasar (ratio 1) supaya sisa selalu habis dibagi.
 */
export function breakdownQty(qtyBase: number, units: UomUnit[]): QtyBreakdown {
  const negative = qtyBase < 0
  let remaining = Math.abs(Math.round(qtyBase))
  const sorted = [...units].sort((a, b) => b.ratio - a.ratio)

  const parts = sorted.map((u) => {
    const qty = Math.floor(remaining / u.ratio)
    remaining -= qty * u.ratio
    return { uomId: u.uomId, code: u.code, qty }
  })

  return { negative, parts }
}

export function formatQtyBreakdown(breakdown: QtyBreakdown): string {
  const str = breakdown.parts.map((p) => `${p.qty} ${p.code}`).join(' ')
  const hasNonZero = breakdown.parts.some((p) => p.qty !== 0)
  return breakdown.negative && hasNonZero ? `-${str}` : str
}
