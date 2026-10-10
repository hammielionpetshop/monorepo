import { db, sql } from '@/lib/db'
import { stockLedgerUnion, wibDateRangeFilters, type StockLedgerMovementType } from './stock-ledger'

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

export const TIMELINE_PAGE_SIZE = 100

export type StockMutationLinkKind = 'TRANSACTION' | 'PURCHASE_ORDER' | 'INTERNAL_TRANSFER' | 'STOCK_OPNAME'

export interface StockMutationTimelineEntry {
  seq: number
  id: string
  createdAt: string
  movementType: StockLedgerMovementType
  referenceNumber: string
  link: { kind: StockMutationLinkKind; id: string; number: string } | null
  counterparty: string | null
  actorName: string
  notes: string | null
  qtyBase: number
  qtyOriginal: number
  uomCode: string
  isBaseUom: boolean
  balance: number
}

export interface StockMutationDailyEntry {
  date: string
  qtyIn: number
  qtyOut: number
  movementCount: number
  balance: number
}

interface TimelineHeader {
  productId: number
  productName: string
  baseUomCode: string | null
  branchId: number
  branchName: string
  startDate: string
  endDate: string
  openingQty: number
  closingQty: number
}

export type StockMutationTimeline =
  | (TimelineHeader & { mode: 'transaction'; total: number; entries: StockMutationTimelineEntry[]; nextCursor: number | null })
  | (TimelineHeader & { mode: 'daily'; entries: StockMutationDailyEntry[] })

/**
 * Tautan dipilih dari prefiks id baris buku besar, bukan dari movement_type: Bulk Sale PO
 * Internal ber-movement TRANSFER_OUT tapi sumbernya transaksi, bukan IBT.
 */
export function resolveTimelineLink(
  rowId: string,
  referenceId: string | null,
  referenceNumber: string,
): StockMutationTimelineEntry['link'] {
  if (referenceId == null) return null
  const prefix = rowId.slice(0, rowId.indexOf('_'))
  const kind: Record<string, StockMutationLinkKind> = {
    SALE: 'TRANSACTION',
    TRXEDIT: 'TRANSACTION',
    SALEVOID: 'TRANSACTION',
    PO: 'PURCHASE_ORDER',
    IBTOUT: 'INTERNAL_TRANSFER',
    IBTIN: 'INTERNAL_TRANSFER',
    SO: 'STOCK_OPNAME',
  }
  return kind[prefix] ? { kind: kind[prefix], id: referenceId, number: referenceNumber } : null
}

const SALE_PREFIXES = new Set(['SALE', 'TRXEDIT', 'SALEVOID', 'RET'])
const PARTY_PREFIXES = new Set(['PO', 'IBTOUT', 'IBTIN'])

/**
 * Pihak lawan mutasi untuk penelusuran barang: pelanggan nota (penjualan, void, koreksi,
 * retur — nota tanpa pelanggan = "Umum"), supplier/cabang asal PO, dan cabang tujuan/asal
 * transfer. Opname, penyesuaian, rusak, dan pecah satuan tidak punya pihak lawan → null.
 */
export function resolveCounterparty(rowId: string, name: string | null): string | null {
  const prefix = rowId.slice(0, rowId.indexOf('_'))
  if (SALE_PREFIXES.has(prefix)) return name ?? 'Umum'
  if (PARTY_PREFIXES.has(prefix)) return name
  return null
}

export async function getStockMutationTimeline(params: {
  productId: number
  branchId: number
  startDate: string
  endDate: string
  mode: 'transaction' | 'daily'
  types?: StockLedgerMovementType[]
  cursor?: number | null
}): Promise<StockMutationTimeline | null> {
  const { productId, branchId, startDate, endDate, mode, types, cursor } = params

  const summary = await getStockMutationSummary({ productId, startDate, endDate, branchId })
  if (!summary) return null

  const [info] = (await db.execute(sql`
    SELECT p.name AS product_name, b.name AS branch_name
    FROM petshop.products p, petshop.branches b
    WHERE p.id = ${productId} AND b.id = ${branchId}
  `)) as Record<string, unknown>[]
  if (!info) return null

  const branch = summary.branches.find((b) => b.branchId === branchId)
  const header: TimelineHeader = {
    productId,
    productName: String(info.product_name),
    baseUomCode: summary.baseUomCode,
    branchId,
    branchName: String(info.branch_name),
    startDate,
    endDate,
    openingQty: branch?.openingQty ?? 0,
    closingQty: branch?.closingQty ?? 0,
  }

  // Saldo dihitung atas SEMUA mutasi periode (sebelum filter jenis & halaman), jadi saldo
  // tiap baris tetap benar walau yang ditampilkan cuma sebagian.
  const period = sql`
    WITH sm AS (${stockLedgerUnion}),
    mv AS (
      SELECT
        sm.*,
        (sm.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') AS wib,
        sm.uom_id = p.base_uom_id AS is_base_uom,
        sm.qty_change * CASE WHEN sm.uom_id = p.base_uom_id THEN 1 ELSE COALESCE(c.ratio, 1) END AS qty_base
      FROM sm
      JOIN petshop.products p ON p.id = sm.product_id
      LEFT JOIN petshop.product_uom_conversions c
        ON c.product_id = sm.product_id AND c.uom_id = sm.uom_id
      WHERE sm.product_id = ${productId} AND sm.branch_id = ${branchId}
        AND ${sql.join(wibDateRangeFilters(startDate, endDate), sql` AND `)}
    )
  `
  const typeFilter = types && types.length > 0
    ? sql`movement_type IN (${sql.join(types.map((t) => sql`${t}`), sql`, `)})`
    : sql`TRUE`

  if (mode === 'daily') {
    const rows = (await db.execute(sql`
      ${period},
      days AS (
        SELECT
          wib::date AS d,
          SUM(qty_base) AS net_all,
          COALESCE(SUM(qty_base) FILTER (WHERE qty_base > 0 AND ${typeFilter}), 0) AS qty_in,
          COALESCE(SUM(qty_base) FILTER (WHERE qty_base < 0 AND ${typeFilter}), 0) AS qty_out,
          COUNT(*) FILTER (WHERE ${typeFilter}) AS movement_count
        FROM mv
        GROUP BY wib::date
      )
      SELECT
        d::text AS date,
        qty_in::float8, qty_out::float8, movement_count::int,
        (${header.openingQty} + SUM(net_all) OVER (ORDER BY d))::float8 AS balance
      FROM days
      ORDER BY d
    `)) as Record<string, unknown>[]

    return {
      ...header,
      mode: 'daily',
      entries: rows
        .map((r) => ({
          date: String(r.date),
          qtyIn: Number(r.qty_in),
          qtyOut: Number(r.qty_out),
          movementCount: Number(r.movement_count),
          balance: Number(r.balance),
        }))
        .filter((r) => r.movementCount > 0),
    }
  }

  const rows = (await db.execute(sql`
    ${period},
    bal AS (
      SELECT
        mv.*,
        ROW_NUMBER() OVER (ORDER BY created_at, id) AS seq,
        ${header.openingQty} + SUM(qty_base) OVER (ORDER BY created_at, id ROWS UNBOUNDED PRECEDING) AS balance
      FROM mv
    ),
    filtered AS (SELECT * FROM bal WHERE ${typeFilter})
    SELECT
      f.seq::int, f.id, f.movement_type, f.reference_number, f.reference_id, f.notes,
      to_char(f.wib, 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"') AS created_at,
      f.qty_change::float8 AS qty_original, f.qty_base::float8, f.is_base_uom,
      f.balance::float8,
      u.code AS uom_code,
      COALESCE(usr.name, 'Sistem') AS actor_name,
      CASE split_part(f.id, '_', 1)
        WHEN 'SALE' THEN trx_c.name
        WHEN 'TRXEDIT' THEN trx_c.name
        WHEN 'SALEVOID' THEN trx_c.name
        WHEN 'RET' THEN (SELECT c.name FROM petshop.returns r
          JOIN petshop.transactions t ON t.id = r.transaction_id
          JOIN petshop.customers c ON c.id = t.customer_id
          WHERE r.id = f.reference_id::uuid)
        WHEN 'PO' THEN (SELECT COALESCE(s.name, sb.name) FROM petshop.purchase_orders po
          LEFT JOIN petshop.suppliers s ON s.id = po.supplier_id
          LEFT JOIN petshop.branches sb ON sb.id = po.source_branch_id
          WHERE po.id = f.reference_id::int)
        WHEN 'IBTOUT' THEN (SELECT b.name FROM petshop.inter_branch_transfers ibt
          JOIN petshop.branches b ON b.id = ibt.destination_branch_id
          WHERE ibt.id = f.reference_id::int)
        WHEN 'IBTIN' THEN (SELECT b.name FROM petshop.inter_branch_transfers ibt
          JOIN petshop.branches b ON b.id = ibt.source_branch_id
          WHERE ibt.id = f.reference_id::int)
      END AS counterparty_name,
      (SELECT COUNT(*) FROM filtered)::int AS total
    FROM filtered f
    JOIN petshop.units_of_measure u ON u.id = f.uom_id
    LEFT JOIN petshop.users usr ON usr.id = f.actor_id
    -- reference_id baris SALE/TRXEDIT/SALEVOID = id transaksi (lihat stockLedgerUnion). Cast
    -- dibungkus CASE supaya reference_id jenis lain (mis. uuid retur) tidak pernah di-cast ke int.
    LEFT JOIN petshop.transactions trx ON trx.id = CASE
      WHEN split_part(f.id, '_', 1) IN ('SALE', 'TRXEDIT', 'SALEVOID') THEN f.reference_id::int
    END
    LEFT JOIN petshop.customers trx_c ON trx_c.id = trx.customer_id
    WHERE f.seq > ${cursor ?? 0}
    ORDER BY f.seq
    LIMIT ${TIMELINE_PAGE_SIZE + 1}
  `)) as Record<string, unknown>[]

  const page = rows.slice(0, TIMELINE_PAGE_SIZE)
  return {
    ...header,
    mode: 'transaction',
    total: rows.length > 0 ? Number(rows[0].total) : 0,
    nextCursor: rows.length > TIMELINE_PAGE_SIZE ? Number(page[page.length - 1].seq) : null,
    entries: page.map((r) => {
      const referenceNumber = String(r.reference_number ?? '-')
      return {
        seq: Number(r.seq),
        id: String(r.id),
        createdAt: String(r.created_at),
        movementType: String(r.movement_type) as StockLedgerMovementType,
        referenceNumber,
        link: resolveTimelineLink(String(r.id), r.reference_id != null ? String(r.reference_id) : null, referenceNumber),
        counterparty: resolveCounterparty(String(r.id), r.counterparty_name != null ? String(r.counterparty_name) : null),
        actorName: String(r.actor_name),
        notes: r.notes != null ? String(r.notes) : null,
        qtyBase: Number(r.qty_base),
        qtyOriginal: Number(r.qty_original),
        uomCode: String(r.uom_code),
        isBaseUom: Boolean(r.is_base_uom),
        balance: Number(r.balance),
      }
    }),
  }
}
