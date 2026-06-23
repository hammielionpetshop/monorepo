import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, eq, sql } from '@/lib/db'
import StockLogsClient from './_components/stock-logs-client'
import type { StockLogEntry } from '@/app/api/bo/inventory/stock-logs/route'

export const dynamic = 'force-dynamic'

export type BranchOption = { id: number; name: string }

export default async function StockLogsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  const isOwner = payload.role === 'OWNER'

  const branchOptions: BranchOption[] = isOwner
    ? await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    : []

  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)
  const defaultFrom = sevenDaysAgo.toISOString().split('T')[0]
  const defaultTo = today.toISOString().split('T')[0]

  const fromDate = defaultFrom + 'T00:00:00.000Z'
  const toDate = defaultTo + 'T23:59:59.999Z'

  const branchFilter = isOwner
    ? sql``
    : sql`AND sm.branch_id = ${payload.branchId}`

  let initialData: StockLogEntry[] = []
  let initialError: string | null = null

  try {
    const rows = await db.execute(sql`
      WITH sm AS (
        SELECT 'SALE_' || ti.id::text AS id, t.created_at, ti.product_id, t.branch_id, ti.uom_id,
          CASE WHEN t.status = 'VOIDED' THEN 'SALE_VOID' ELSE 'SALE_OUT' END AS movement_type,
          CASE WHEN t.status = 'VOIDED' THEN ti.qty ELSE -ti.qty END AS qty_change,
          t.trx_number AS reference_number, t.cashier_id AS actor_id,
          ti.unit_price, ti.cogs, NULL::text AS notes
        FROM petshop.transaction_items ti
        JOIN petshop.transactions t ON t.id = ti.transaction_id
        WHERE t.status IN ('COMPLETED', 'VOIDED')
        UNION ALL
        SELECT 'PO_' || pri.id::text, prl.received_at, poi.product_id, po.branch_id, poi.uom_id,
          'PO_IN', pri.qty_received, po.po_number, prl.received_by_id,
          poi.unit_cost, poi.unit_cost, prl.note
        FROM petshop.po_receiving_items pri
        JOIN petshop.po_receiving_logs prl ON prl.id = pri.log_id
        JOIN petshop.purchase_order_items poi ON poi.id = pri.po_item_id
        JOIN petshop.purchase_orders po ON po.id = prl.po_id
        UNION ALL
        SELECT 'ADJ_' || sa.id::text, sa.created_at, sa.product_id, sa.branch_id, p_adj.base_uom_id,
          'ADJUSTMENT', (sa.new_qty - sa.previous_qty), 'ADJ-' || sa.id::text, sa.adjusted_by_id,
          NULL::integer, NULL::integer, sa.reason
        FROM petshop.stock_adjustments sa
        JOIN petshop.products p_adj ON p_adj.id = sa.product_id
        UNION ALL
        SELECT 'SO_' || soi.id::text, COALESCE(so.approved_at, so.completed_at, so.created_at),
          soi.product_id, so.branch_id, soi.uom_id, 'OPNAME', soi.variance_qty,
          so.so_number, COALESCE(so.approved_by_id, so.created_by_id),
          NULL::integer, NULL::integer, soi.variance_reason
        FROM petshop.stock_opname_items soi
        JOIN petshop.stock_opnames so ON so.id = soi.so_id
        WHERE so.status = 'APPROVED' AND soi.variance_qty != 0
        UNION ALL
        SELECT 'BRKOUT_' || sab.id::text, sab.created_at, sab.product_id, sab.branch_id, sab.from_uom_id,
          'BREAK_OUT', -sab.qty_broken, 'BREAK-' || sab.id::text,
          NULL::integer, NULL::integer, NULL::integer, NULL::text
        FROM petshop.stock_auto_breaks sab
        UNION ALL
        SELECT 'BRKIN_' || sab.id::text, sab.created_at, sab.product_id, sab.branch_id, sab.to_uom_id,
          'BREAK_IN', sab.qty_gained, 'BREAK-' || sab.id::text,
          NULL::integer, NULL::integer, NULL::integer, NULL::text
        FROM petshop.stock_auto_breaks sab
        UNION ALL
        SELECT 'RET_' || ri.id::text, r.created_at, ri.product_id, r.branch_id, ri.uom_id,
          'RETURN_IN', ri.qty, r.return_number, r.processed_by_id,
          ri.unit_price, ri.cogs, r.reason
        FROM petshop.return_items ri
        JOIN petshop.returns r ON r.id = ri.return_id
        UNION ALL
        SELECT 'IBTOUT_' || iti.id::text, ibt.updated_at, iti.product_id, ibt.source_branch_id, iti.uom_id,
          'TRANSFER_OUT', -iti.qty_shipped, ibt.ibt_number, COALESCE(ibt.approved_by_id, ibt.requested_by_id),
          iti.cost_price_at_transfer, iti.cost_price_at_transfer, ibt.notes
        FROM petshop.inter_branch_transfer_items iti
        JOIN petshop.inter_branch_transfers ibt ON ibt.id = iti.transfer_id
        WHERE iti.qty_shipped > 0
        UNION ALL
        SELECT 'IBTIN_' || iti.id::text, ibt.updated_at, iti.product_id, ibt.destination_branch_id, iti.uom_id,
          'TRANSFER_IN', iti.qty_received, ibt.ibt_number, COALESCE(ibt.approved_by_id, ibt.requested_by_id),
          iti.cost_price_at_transfer, iti.cost_price_at_transfer, iti.receive_notes
        FROM petshop.inter_branch_transfer_items iti
        JOIN petshop.inter_branch_transfers ibt ON ibt.id = iti.transfer_id
        WHERE iti.qty_received > 0
      )
      SELECT sm.id, sm.created_at, sm.movement_type, sm.qty_change, sm.reference_number,
        sm.unit_price, sm.cogs, sm.notes,
        p.name AS product_name, p.sku AS product_sku, b.name AS branch_name,
        u.code AS uom_code, COALESCE(usr.name, 'Sistem') AS actor_name
      FROM sm
      JOIN petshop.products p ON p.id = sm.product_id
      JOIN petshop.branches b ON b.id = sm.branch_id
      JOIN petshop.units_of_measure u ON u.id = sm.uom_id
      LEFT JOIN petshop.users usr ON usr.id = sm.actor_id
      WHERE sm.created_at >= ${fromDate} AND sm.created_at <= ${toDate}
      ${branchFilter}
      ORDER BY sm.created_at DESC
      LIMIT 300
    `) as Record<string, unknown>[]

    initialData = rows.map(row => ({
      id: String(row.id),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
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
  } catch (e) {
    console.error('StockLogsPage error:', e)
    initialError = 'Terjadi kesalahan saat memuat data mutasi stok'
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground mb-1">Mutasi Stok</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Riwayat semua pergerakan stok: penjualan, penerimaan PO, penyesuaian, stock opname, pecah satuan, retur, dan transfer antar cabang.
      </p>
      <StockLogsClient
        initialData={initialData}
        initialError={initialError}
        branches={branchOptions}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
        isOwner={isOwner}
      />
    </div>
  )
}
