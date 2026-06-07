import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const VALID_MOVEMENT_TYPES = [
  'SALE_OUT', 'SALE_VOID', 'PO_IN', 'ADJUSTMENT',
  'OPNAME', 'BREAK_OUT', 'BREAK_IN', 'RETURN_IN',
] as const

const querySchema = z.object({
  startDate: z.string().regex(ISO_DATE_RE).refine(v => !isNaN(new Date(v).getTime())).optional(),
  endDate: z.string().regex(ISO_DATE_RE).refine(v => !isNaN(new Date(v).getTime())).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  movementType: z.enum(VALID_MOVEMENT_TYPES).optional(),
  q: z.string().max(100).optional(),
}).refine(data => {
  if (!data.startDate || !data.endDate) return true
  return data.startDate <= data.endDate
}, { message: 'startDate tidak boleh lebih besar dari endDate' })

export interface StockLogEntry {
  id: string
  createdAt: string
  movementType: string
  qtyChange: number
  referenceNumber: string
  unitPrice: number | null
  cogs: number | null
  notes: string | null
  productName: string
  productSku: string | null
  branchName: string
  uomCode: string
  actorName: string
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      branchId: searchParams.get('branchId') ?? undefined,
      movementType: searchParams.get('movementType') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' },
        { status: 400 }
      )
    }

    const { startDate, endDate, movementType, q } = parsed.data
    const isOwner = payload.role === 'OWNER'
    const branchId = isOwner ? parsed.data.branchId : payload.branchId

    // Build dynamic WHERE conditions
    const filters: ReturnType<typeof sql>[] = []
    if (!isOwner) {
      filters.push(sql`sm.branch_id = ${payload.branchId}`)
    } else if (branchId) {
      filters.push(sql`sm.branch_id = ${branchId}`)
    }
    if (movementType) filters.push(sql`sm.movement_type = ${movementType}`)
    if (startDate) filters.push(sql`sm.created_at >= ${new Date(startDate + 'T00:00:00.000Z')}`)
    if (endDate) filters.push(sql`sm.created_at <= ${new Date(endDate + 'T23:59:59.999Z')}`)
    if (q) {
      const qLike = `%${q}%`
      filters.push(sql`(p.name ILIKE ${qLike} OR p.sku ILIKE ${qLike})`)
    }

    const whereSQL = filters.length > 0
      ? sql`WHERE ${sql.join(filters, sql` AND `)}`
      : sql``

    const rows = await db.execute(sql`
      WITH sm AS (
        -- SALE_OUT / SALE_VOID
        SELECT
          'SALE_' || ti.id::text                                             AS id,
          t.created_at,
          ti.product_id,
          t.branch_id,
          ti.uom_id,
          CASE WHEN t.status = 'VOIDED' THEN 'SALE_VOID' ELSE 'SALE_OUT' END AS movement_type,
          CASE WHEN t.status = 'VOIDED' THEN ti.qty      ELSE -ti.qty     END AS qty_change,
          t.trx_number                                                        AS reference_number,
          t.cashier_id                                                        AS actor_id,
          ti.unit_price,
          ti.cogs,
          NULL::text                                                          AS notes
        FROM petshop.transaction_items ti
        JOIN petshop.transactions t ON t.id = ti.transaction_id
        WHERE t.status IN ('COMPLETED', 'VOIDED')

        UNION ALL

        -- PO_IN
        SELECT
          'PO_' || pri.id::text  AS id,
          prl.received_at        AS created_at,
          poi.product_id,
          po.branch_id,
          poi.uom_id,
          'PO_IN'                AS movement_type,
          pri.qty_received       AS qty_change,
          po.po_number           AS reference_number,
          prl.received_by_id     AS actor_id,
          poi.unit_cost          AS unit_price,
          poi.unit_cost          AS cogs,
          prl.note               AS notes
        FROM petshop.po_receiving_items pri
        JOIN petshop.po_receiving_logs prl ON prl.id = pri.log_id
        JOIN petshop.purchase_order_items poi ON poi.id = pri.po_item_id
        JOIN petshop.purchase_orders po ON po.id = prl.po_id

        UNION ALL

        -- ADJUSTMENT
        SELECT
          'ADJ_' || sa.id::text         AS id,
          sa.created_at,
          sa.product_id,
          sa.branch_id,
          p_adj.base_uom_id             AS uom_id,
          'ADJUSTMENT'                  AS movement_type,
          (sa.new_qty - sa.previous_qty) AS qty_change,
          'ADJ-' || sa.id::text         AS reference_number,
          sa.adjusted_by_id             AS actor_id,
          NULL::integer                 AS unit_price,
          NULL::integer                 AS cogs,
          sa.reason                     AS notes
        FROM petshop.stock_adjustments sa
        JOIN petshop.products p_adj ON p_adj.id = sa.product_id

        UNION ALL

        -- OPNAME (hanya yang sudah APPROVED dan ada selisih)
        SELECT
          'SO_' || soi.id::text                                       AS id,
          COALESCE(so.approved_at, so.completed_at, so.created_at)   AS created_at,
          soi.product_id,
          so.branch_id,
          soi.uom_id,
          'OPNAME'                                                     AS movement_type,
          soi.variance_qty                                             AS qty_change,
          so.so_number                                                 AS reference_number,
          COALESCE(so.approved_by_id, so.created_by_id)              AS actor_id,
          NULL::integer                                                AS unit_price,
          NULL::integer                                                AS cogs,
          soi.variance_reason                                          AS notes
        FROM petshop.stock_opname_items soi
        JOIN petshop.stock_opnames so ON so.id = soi.so_id
        WHERE so.status = 'APPROVED' AND soi.variance_qty != 0

        UNION ALL

        -- BREAK_OUT (satuan besar berkurang)
        SELECT
          'BRKOUT_' || sab.id::text AS id,
          sab.created_at,
          sab.product_id,
          sab.branch_id,
          sab.from_uom_id           AS uom_id,
          'BREAK_OUT'               AS movement_type,
          -sab.qty_broken           AS qty_change,
          'BREAK-' || sab.id::text  AS reference_number,
          NULL::integer             AS actor_id,
          NULL::integer             AS unit_price,
          NULL::integer             AS cogs,
          NULL::text                AS notes
        FROM petshop.stock_auto_breaks sab

        UNION ALL

        -- BREAK_IN (satuan kecil bertambah)
        SELECT
          'BRKIN_' || sab.id::text AS id,
          sab.created_at,
          sab.product_id,
          sab.branch_id,
          sab.to_uom_id            AS uom_id,
          'BREAK_IN'               AS movement_type,
          sab.qty_gained           AS qty_change,
          'BREAK-' || sab.id::text AS reference_number,
          NULL::integer            AS actor_id,
          NULL::integer            AS unit_price,
          NULL::integer            AS cogs,
          NULL::text               AS notes
        FROM petshop.stock_auto_breaks sab

        UNION ALL

        -- RETURN_IN
        SELECT
          'RET_' || ri.id::text AS id,
          r.created_at,
          ri.product_id,
          r.branch_id,
          ri.uom_id,
          'RETURN_IN'           AS movement_type,
          ri.qty                AS qty_change,
          r.return_number       AS reference_number,
          r.processed_by_id     AS actor_id,
          ri.unit_price,
          ri.cogs,
          r.reason              AS notes
        FROM petshop.return_items ri
        JOIN petshop.returns r ON r.id = ri.return_id
      )
      SELECT
        sm.id,
        sm.created_at,
        sm.movement_type,
        sm.qty_change,
        sm.reference_number,
        sm.unit_price,
        sm.cogs,
        sm.notes,
        p.name        AS product_name,
        p.sku         AS product_sku,
        b.name        AS branch_name,
        u.code        AS uom_code,
        COALESCE(usr.name, 'Sistem') AS actor_name
      FROM sm
      JOIN petshop.products p ON p.id = sm.product_id
      JOIN petshop.branches b ON b.id = sm.branch_id
      JOIN petshop.units_of_measure u ON u.id = sm.uom_id
      LEFT JOIN petshop.users usr ON usr.id = sm.actor_id
      ${whereSQL}
      ORDER BY sm.created_at DESC
      LIMIT 300
    `) as Record<string, unknown>[]

    const data: StockLogEntry[] = rows.map(row => ({
      id: String(row.id),
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
      movementType: String(row.movement_type),
      qtyChange: Number(row.qty_change),
      referenceNumber: String(row.reference_number ?? '-'),
      unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
      cogs: row.cogs != null ? Number(row.cogs) : null,
      notes: row.notes != null ? String(row.notes) : null,
      productName: String(row.product_name),
      productSku: row.product_sku != null ? String(row.product_sku) : null,
      branchName: String(row.branch_name),
      uomCode: String(row.uom_code),
      actorName: String(row.actor_name),
    }))

    return NextResponse.json({ data, total: data.length })
  } catch (error) {
    console.error('[stock-logs] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data mutasi stok' }, { status: 500 })
  }
}
