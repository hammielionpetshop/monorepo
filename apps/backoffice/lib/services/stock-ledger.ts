import { db, sql } from '@/lib/db'

export const STOCK_LEDGER_MOVEMENT_TYPES = [
  'SALE_OUT', 'SALE_VOID', 'PO_IN', 'ADJUSTMENT',
  'OPNAME', 'BREAK_OUT', 'BREAK_IN', 'RETURN_IN',
  'TRANSFER_OUT', 'TRANSFER_IN', 'DAMAGED_OUT',
] as const

export type StockLedgerMovementType = (typeof STOCK_LEDGER_MOVEMENT_TYPES)[number]

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

export const STOCK_LEDGER_LIMIT = 300

// Jam & pelaku void. DISTINCT ON menjamin maksimal satu baris per transaksi,
// sehingga join ini tidak pernah menggandakan baris mutasi.
const voidAudit = sql`
  SELECT DISTINCT ON (al.record_id)
    al.record_id,
    al.user_id    AS actor_id,
    al.created_at AS voided_at
  FROM petshop.audit_logs al
  WHERE al.table_name = 'transactions'
    AND al.action IN ('VOID_TRANSACTION', 'VOID_REQUEST_APPROVED')
  ORDER BY al.record_id, al.created_at DESC
`

// Sumber tunggal buku besar mutasi stok. Dipakai halaman Mutasi Stok (render awal)
// dan endpoint filternya — jangan disalin ulang, dua salinan dijamin menyimpang.
const stockLedgerUnion = sql`
  -- SALE_OUT — setiap penjualan yang stoknya benar-benar dipotong.
  -- VOIDED ikut: void tidak menghapus penjualannya, hanya menambah baris
  -- pengembalian di cabang SALE_VOID. PENDING_VOID juga ikut karena
  -- pengajuan void baru mengubah status, stok masih terpotong.
  SELECT
    'SALE_' || ti.id::text  AS id,
    t.created_at,
    ti.product_id,
    t.branch_id,
    ti.uom_id,
    'SALE_OUT'              AS movement_type,
    -ti.qty                 AS qty_change,
    t.trx_number            AS reference_number,
    t.cashier_id            AS actor_id,
    ti.unit_price,
    ti.cogs,
    NULL::text              AS notes
  FROM petshop.transaction_items ti
  JOIN petshop.transactions t ON t.id = ti.transaction_id
  WHERE t.status IN ('COMPLETED', 'VOIDED', 'PENDING_VOID')

  UNION ALL

  -- SALE_VOID — pengembalian stok saat void, dicatat pada jam void (bukan jam jual)
  -- dan atas nama pelaku void (bukan kasir yang menjual).
  SELECT
    'SALEVOID_' || ti.id::text            AS id,
    COALESCE(va.voided_at, t.updated_at)  AS created_at,
    ti.product_id,
    t.branch_id,
    ti.uom_id,
    'SALE_VOID'                           AS movement_type,
    ti.qty                                AS qty_change,
    t.trx_number                          AS reference_number,
    COALESCE(va.actor_id, t.cashier_id)   AS actor_id,
    ti.unit_price,
    ti.cogs,
    NULL::text                            AS notes
  FROM petshop.transaction_items ti
  JOIN petshop.transactions t ON t.id = ti.transaction_id
  LEFT JOIN (${voidAudit}) va ON va.record_id = t.id::text
  WHERE t.status = 'VOIDED'

  UNION ALL

  -- DAMAGED_OUT — barang rusak/expired/hilang. Stoknya dipotong FIFO oleh
  -- POST /api/pos/damaged-goods, jadi wajib muncul di buku besar.
  SELECT
    'DMG_' || dgi.id::text                            AS id,
    dg.reported_at                                    AS created_at,
    dgi.product_id,
    dg.branch_id,
    dgi.uom_id,
    'DAMAGED_OUT'                                     AS movement_type,
    -dgi.qty                                          AS qty_change,
    'RUSAK-' || dg.id::text                           AS reference_number,
    dg.reported_by_id                                 AS actor_id,
    dgi.cost_price                                    AS unit_price,
    dgi.loss_value                                    AS cogs,
    dg.reason || COALESCE(' — ' || dg.notes, '')      AS notes
  FROM petshop.damaged_goods_items dgi
  JOIN petshop.damaged_goods dg ON dg.id = dgi.damaged_goods_id

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
    'ADJ_' || sa.id::text          AS id,
    sa.created_at,
    sa.product_id,
    sa.branch_id,
    p_adj.base_uom_id              AS uom_id,
    'ADJUSTMENT'                   AS movement_type,
    (sa.new_qty - sa.previous_qty) AS qty_change,
    'ADJ-' || sa.id::text          AS reference_number,
    sa.adjusted_by_id              AS actor_id,
    NULL::integer                  AS unit_price,
    NULL::integer                  AS cogs,
    sa.reason                      AS notes
  FROM petshop.stock_adjustments sa
  JOIN petshop.products p_adj ON p_adj.id = sa.product_id

  UNION ALL

  -- OPNAME (hanya yang sudah APPROVED dan ada selisih)
  SELECT
    'SO_' || soi.id::text                                     AS id,
    COALESCE(so.approved_at, so.completed_at, so.created_at)  AS created_at,
    soi.product_id,
    so.branch_id,
    soi.uom_id,
    'OPNAME'                                                  AS movement_type,
    soi.variance_qty                                          AS qty_change,
    so.so_number                                              AS reference_number,
    COALESCE(so.approved_by_id, so.created_by_id)             AS actor_id,
    NULL::integer                                             AS unit_price,
    NULL::integer                                             AS cogs,
    soi.variance_reason                                       AS notes
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

  UNION ALL

  -- TRANSFER_OUT (stok keluar dari cabang pengirim saat dikirim).
  -- Jam masih perkiraan: tidak ada kolom shipped_at, updated_at ikut berubah
  -- saat IBT diterima. Lihat SO13 di backlog.
  SELECT
    'IBTOUT_' || iti.id::text                          AS id,
    ibt.updated_at                                     AS created_at,
    iti.product_id,
    ibt.source_branch_id                               AS branch_id,
    iti.uom_id,
    'TRANSFER_OUT'                                     AS movement_type,
    -iti.qty_shipped                                   AS qty_change,
    ibt.ibt_number                                     AS reference_number,
    COALESCE(ibt.approved_by_id, ibt.requested_by_id)  AS actor_id,
    iti.cost_price_at_transfer                         AS unit_price,
    iti.cost_price_at_transfer                         AS cogs,
    ibt.notes                                          AS notes
  FROM petshop.inter_branch_transfer_items iti
  JOIN petshop.inter_branch_transfers ibt ON ibt.id = iti.transfer_id
  WHERE iti.qty_shipped > 0

  UNION ALL

  -- TRANSFER_IN (stok masuk ke cabang penerima saat diterima)
  SELECT
    'IBTIN_' || iti.id::text                            AS id,
    COALESCE(ibt.received_at, ibt.updated_at)           AS created_at,
    iti.product_id,
    ibt.destination_branch_id                           AS branch_id,
    iti.uom_id,
    'TRANSFER_IN'                                       AS movement_type,
    iti.qty_received                                    AS qty_change,
    ibt.ibt_number                                      AS reference_number,
    COALESCE(ibt.received_by_id, ibt.approved_by_id, ibt.requested_by_id) AS actor_id,
    iti.cost_price_at_transfer                          AS unit_price,
    iti.cost_price_at_transfer                          AS cogs,
    iti.receive_notes                                   AS notes
  FROM petshop.inter_branch_transfer_items iti
  JOIN petshop.inter_branch_transfers ibt ON ibt.id = iti.transfer_id
  WHERE iti.qty_received > 0
`

export function buildStockLedgerQuery(filters: ReturnType<typeof sql>[]) {
  const whereSQL =
    filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``

  return sql`
    WITH sm AS (${stockLedgerUnion})
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
    LIMIT ${STOCK_LEDGER_LIMIT}
  `
}

export function mapStockLogRow(row: Record<string, unknown>): StockLogEntry {
  return {
    id: String(row.id),
    createdAt:
      row.created_at instanceof Date
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
  }
}

export async function fetchStockLedger(
  filters: ReturnType<typeof sql>[],
): Promise<StockLogEntry[]> {
  const rows = (await db.execute(
    buildStockLedgerQuery(filters),
  )) as Record<string, unknown>[]
  return rows.map(mapStockLogRow)
}
