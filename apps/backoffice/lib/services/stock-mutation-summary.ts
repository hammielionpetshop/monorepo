import { db, sql } from '@/lib/db'
import { stockLedgerUnion, type StockLedgerMovementType } from './stock-ledger'

export type StockMutationMovements = Partial<Record<StockLedgerMovementType, number>>

export interface StockMutationBranchSummary {
  branchId: number
  branchName: string
  openingQty: number
  closingQty: number
  currentQty: number
  movements: StockMutationMovements
}

export interface StockMutationSummary {
  productId: number
  baseUomCode: string | null
  startDate: string
  endDate: string
  branches: StockMutationBranchSummary[]
  total: Omit<StockMutationBranchSummary, 'branchId' | 'branchName'>
}

export interface MovementAggregateRow {
  branchId: number
  movementType: string
  inPeriod: number
  afterPeriod: number
}

export interface CurrentStockRow {
  branchId: number
  qty: number
}

function sumMovements(movements: StockMutationMovements): number {
  return Object.values(movements).reduce((acc, qty) => acc + (qty ?? 0), 0)
}

/**
 * Tidak ada snapshot stok historis, jadi stok akhir periode dihitung mundur dari stok
 * sistem saat ini dikurangi mutasi sesudah periode, lalu stok awal = stok akhir −
 * mutasi dalam periode. Mutasi yang tidak tercatat di buku besar ikut "terserap" ke
 * stok awal — itulah sebabnya UI menandainya sebagai hasil hitung mundur.
 */
export function summarizeStockMutations(
  movementRows: MovementAggregateRow[],
  currentStocks: CurrentStockRow[],
  branchNames: Map<number, string>,
): Pick<StockMutationSummary, 'branches' | 'total'> {
  const byBranch = new Map<number, { movements: StockMutationMovements; after: number; current: number }>()
  const ensure = (branchId: number) => {
    let entry = byBranch.get(branchId)
    if (!entry) {
      entry = { movements: {}, after: 0, current: 0 }
      byBranch.set(branchId, entry)
    }
    return entry
  }

  for (const row of currentStocks) ensure(row.branchId).current += row.qty
  for (const row of movementRows) {
    const entry = ensure(row.branchId)
    entry.after += row.afterPeriod
    if (row.inPeriod !== 0) {
      const type = row.movementType as StockLedgerMovementType
      entry.movements[type] = (entry.movements[type] ?? 0) + row.inPeriod
    }
  }

  const branches: StockMutationBranchSummary[] = [...byBranch.entries()]
    .map(([branchId, entry]) => {
      const closingQty = entry.current - entry.after
      return {
        branchId,
        branchName: branchNames.get(branchId) ?? `Cabang #${branchId}`,
        openingQty: closingQty - sumMovements(entry.movements),
        closingQty,
        currentQty: entry.current,
        movements: entry.movements,
      }
    })
    .filter((b) => b.openingQty !== 0 || b.closingQty !== 0 || b.currentQty !== 0 || Object.keys(b.movements).length > 0)
    .sort((a, b) => a.branchName.localeCompare(b.branchName, 'id'))

  const totalMovements: StockMutationMovements = {}
  for (const b of branches) {
    for (const [type, qty] of Object.entries(b.movements) as [StockLedgerMovementType, number][]) {
      totalMovements[type] = (totalMovements[type] ?? 0) + qty
    }
  }

  return {
    branches,
    total: {
      openingQty: branches.reduce((acc, b) => acc + b.openingQty, 0),
      closingQty: branches.reduce((acc, b) => acc + b.closingQty, 0),
      currentQty: branches.reduce((acc, b) => acc + b.currentQty, 0),
      movements: totalMovements,
    },
  }
}

export async function getStockMutationSummary(params: {
  productId: number
  startDate: string
  endDate: string
  branchId?: number | null
}): Promise<StockMutationSummary | null> {
  const { productId, startDate, endDate, branchId } = params

  const [product] = (await db.execute(sql`
    SELECT p.id, u.code AS base_uom_code
    FROM petshop.products p
    LEFT JOIN petshop.units_of_measure u ON u.id = p.base_uom_id
    WHERE p.id = ${productId}
  `)) as Record<string, unknown>[]
  if (!product) return null

  const ledgerBranchFilter = branchId != null ? sql`AND sm.branch_id = ${branchId}` : sql``
  const stockBranchFilter = branchId != null ? sql`AND ps.branch_id = ${branchId}` : sql``

  // qty_change dalam satuan baris (uom_id) → dikali rasio ke satuan dasar.
  // product_stocks sudah satuan dasar, jadi tidak dikonversi.
  const [movementRows, stockRows, branchRows] = await Promise.all([
    db.execute(sql`
      WITH sm AS (${stockLedgerUnion}),
      mv AS (
        SELECT
          sm.branch_id,
          sm.movement_type,
          (sm.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS d,
          sm.qty_change * CASE WHEN sm.uom_id = p.base_uom_id THEN 1 ELSE COALESCE(c.ratio, 1) END AS qty_base
        FROM sm
        JOIN petshop.products p ON p.id = sm.product_id
        LEFT JOIN petshop.product_uom_conversions c
          ON c.product_id = sm.product_id AND c.uom_id = sm.uom_id
        WHERE sm.product_id = ${productId} ${ledgerBranchFilter}
      )
      SELECT
        branch_id,
        movement_type,
        COALESCE(SUM(qty_base) FILTER (WHERE d BETWEEN ${startDate}::date AND ${endDate}::date), 0)::float8 AS in_period,
        COALESCE(SUM(qty_base) FILTER (WHERE d > ${endDate}::date), 0)::float8 AS after_period
      FROM mv
      GROUP BY branch_id, movement_type
    `) as Promise<Record<string, unknown>[]>,
    db.execute(sql`
      SELECT ps.branch_id, SUM(ps.qty)::float8 AS qty
      FROM petshop.product_stocks ps
      WHERE ps.product_id = ${productId} ${stockBranchFilter}
      GROUP BY ps.branch_id
    `) as Promise<Record<string, unknown>[]>,
    db.execute(sql`SELECT id, name FROM petshop.branches`) as Promise<Record<string, unknown>[]>,
  ])

  const summary = summarizeStockMutations(
    movementRows.map((r) => ({
      branchId: Number(r.branch_id),
      movementType: String(r.movement_type),
      inPeriod: Number(r.in_period),
      afterPeriod: Number(r.after_period),
    })),
    stockRows.map((r) => ({ branchId: Number(r.branch_id), qty: Number(r.qty) })),
    new Map(branchRows.map((r) => [Number(r.id), String(r.name)])),
  )

  return {
    productId,
    baseUomCode: product.base_uom_code != null ? String(product.base_uom_code) : null,
    startDate,
    endDate,
    ...summary,
  }
}
