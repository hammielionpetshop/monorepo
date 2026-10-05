import { suggestCosts } from '../../master-data/prices/_components/auto-cost'

export interface PoProductUom {
  uomId: number
  code: string
  /** Isi 1 satuan ini dalam satuan dasar; satuan dasar = 1. */
  ratio: number
  isBase: boolean
  /** Modal tersimpan di Manajemen Harga cabang tujuan untuk satuan ini; null = belum ada. */
  cost: number | null
}

/** Satuan default baris PO = satuan terbesar (satuan beli dari supplier, mis. SAK/DUS). */
export function pickDefaultUom(uoms: PoProductUom[]): PoProductUom | null {
  if (uoms.length === 0) return null
  return uoms.reduce((best, u) => (u.ratio > best.ratio ? u : best))
}

/**
 * Harga satuan default = modal terakhir satuan itu di cabang tujuan. Modal di Manajemen Harga
 * diperbarui dari penerimaan barang terakhir (sinkron modal), jadi itulah "modal terakhir".
 * Kalau satuan itu belum bermodal, diturunkan dari satuan lain lewat rasio.
 */
export function defaultUnitCost(uoms: PoProductUom[], uomId: number): number | null {
  const own = uoms.find((u) => u.uomId === uomId)
  if (own?.cost && own.cost > 0) return own.cost
  const derived = suggestCosts(
    uoms.map((u) => ({ uomId: u.uomId, ratio: u.ratio, cost: u.cost, isAuto: false })),
  )
  return derived[uomId] ?? null
}
