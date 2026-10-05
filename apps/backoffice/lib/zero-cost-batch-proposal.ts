/**
 * Usulan modal per satuan dasar untuk batch stok yang tercatat bermodal 0.
 *
 * Urutan sumber sama dengan HPP fallback penjualan (`resolveFallbackCostPerBase`): modal satuan
 * dasar cabang itu → modal satuan terbesar cabang itu ÷ rasio → modal default produk. Sumber
 * keempat, modal cabang lain, hanya ditawarkan (tidak dicentang otomatis): modal antar-cabang
 * bisa berbeda dan tidak pernah dipakai sistem untuk HPP.
 *
 * `batch.qty_remaining` & `cost_price` sudah dalam satuan dasar — jangan kalikan qty dengan rasio.
 * Rasio hanya dipakai untuk menurunkan modal satuan besar ke satuan dasar.
 */

export type ProposalSource = 'BASE' | 'BIG_UOM' | 'DEFAULT' | 'OTHER_BRANCH'
export type ProposalFlag = 'MODAL_MELEBIHI_HARGA_JUAL' | 'JAUH_DI_ATAS_BATCH_LAIN'

export interface UomCostRow {
  branchId: number
  uomId: number
  uomCode: string
  costPrice: number
  /** null untuk satuan dasar (tidak punya baris konversi). */
  ratio: number | null
}

export interface ProposalInput {
  branchId: number
  baseUomId: number
  defaultCostPrice: number | null
  uomCosts: UomCostRow[]
  branchNames: Map<number, string>
  /** Harga jual tertinggi satuan dasar — cabang itu, atau cabang mana pun bila cabang itu tidak menjual. */
  baseSellingPrice: number | null
  /** Modal batch lain (> 0) produk yang sama di cabang itu, terendah. */
  minOtherBatchCost: number | null
}

export interface CostProposal {
  costPerBase: number
  source: ProposalSource
  /** Penjelasan singkat asal angka, mis. "SAK Rp 462.520 ÷ 20". */
  detail: string
  flags: ProposalFlag[]
  /** Dicentang otomatis di pratinjau. */
  recommended: boolean
}

/** Batas "jauh di atas batch lain" — sama dengan ambang guard modal batch (audit HPP Fase 4). */
export const OTHER_BATCH_FACTOR = 4

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

function fromBranch(rows: UomCostRow[], baseUomId: number): { cost: number; detail: string; source: 'BASE' | 'BIG_UOM' } | null {
  const valid = rows.filter((r) => r.costPrice > 0)
  const base = valid.find((r) => r.uomId === baseUomId)
  if (base) return { cost: base.costPrice, detail: `${base.uomCode} ${rupiah(base.costPrice)}`, source: 'BASE' }

  const big = valid.filter((r) => r.uomId !== baseUomId && (r.ratio ?? 0) > 0)
  if (big.length === 0) return null
  const best = big.reduce((a, b) => ((b.ratio ?? 0) > (a.ratio ?? 0) ? b : a))
  return {
    cost: Math.round(best.costPrice / (best.ratio as number)),
    detail: `${best.uomCode} ${rupiah(best.costPrice)} ÷ ${best.ratio}`,
    source: 'BIG_UOM',
  }
}

export function proposeBatchCost(input: ProposalInput): CostProposal | null {
  let picked: { cost: number; detail: string; source: ProposalSource } | null = fromBranch(
    input.uomCosts.filter((r) => r.branchId === input.branchId),
    input.baseUomId,
  )

  if (!picked && (input.defaultCostPrice ?? 0) > 0) {
    picked = { cost: input.defaultCostPrice as number, detail: `Modal default produk ${rupiah(input.defaultCostPrice as number)}`, source: 'DEFAULT' }
  }

  if (!picked) {
    const otherBranchIds = Array.from(new Set(input.uomCosts.map((r) => r.branchId))).filter((id) => id !== input.branchId).sort((a, b) => a - b)
    for (const id of otherBranchIds) {
      const found = fromBranch(input.uomCosts.filter((r) => r.branchId === id), input.baseUomId)
      if (found) {
        picked = { cost: found.cost, detail: `${found.detail} (${input.branchNames.get(id) ?? `cabang ${id}`})`, source: 'OTHER_BRANCH' }
        break
      }
    }
  }

  if (!picked || picked.cost <= 0) return null

  const flags: ProposalFlag[] = []
  if (input.baseSellingPrice != null && input.baseSellingPrice > 0 && picked.cost >= input.baseSellingPrice) {
    flags.push('MODAL_MELEBIHI_HARGA_JUAL')
  }
  if (input.minOtherBatchCost != null && input.minOtherBatchCost > 0 && picked.cost > input.minOtherBatchCost * OTHER_BATCH_FACTOR) {
    flags.push('JAUH_DI_ATAS_BATCH_LAIN')
  }

  return {
    costPerBase: picked.cost,
    source: picked.source,
    detail: picked.detail,
    flags,
    recommended: picked.source !== 'OTHER_BRANCH' && flags.length === 0,
  }
}
