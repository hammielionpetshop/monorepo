import { db, sql } from '../db'

export interface LastBulkPrice {
  productId: number
  uomId: number
  unitPrice: number
  discountAmount: number
  qty: number
  trxNumber: string
  soldAt: string
}

/**
 * Harga Bulk Sale terakhir per (produk, satuan) untuk satu customer di satu cabang (kanban #57).
 * Hanya nota COMPLETED: VOIDED dan PENDING_VOID dilewati supaya harga dari nota yang
 * dibatalkan tidak muncul sebagai patokan. Baris yang dihapus lewat koreksi (qty 0) juga dilewati.
 */
export async function getLastBulkPrices(
  branchId: number,
  customerId: number,
  productIds: number[],
): Promise<LastBulkPrice[]> {
  if (productIds.length === 0) return []

  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (ti.product_id, ti.uom_id)
      ti.product_id      AS "productId",
      ti.uom_id          AS "uomId",
      ti.unit_price      AS "unitPrice",
      ti.discount_amount AS "discountAmount",
      ti.qty             AS "qty",
      t.trx_number       AS "trxNumber",
      -- created_at disimpan UTC tanpa zona; diformat di sini supaya driver tidak
      -- menafsirkannya sebagai jam lokal server.
      to_char(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "soldAt"
    FROM petshop.transaction_items ti
    JOIN petshop.transactions t ON t.id = ti.transaction_id
    WHERE t.customer_id = ${customerId}
      AND t.branch_id = ${branchId}
      AND t.sale_type = 'BULK'
      AND t.status = 'COMPLETED'
      AND ti.is_removed = false
      AND ti.qty > 0
      AND ti.product_id IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})
    ORDER BY ti.product_id, ti.uom_id, t.created_at DESC, t.id DESC
  `)) as unknown as Record<string, unknown>[]

  return rows.map((row) => ({
    productId: Number(row.productId),
    uomId: Number(row.uomId),
    unitPrice: Number(row.unitPrice),
    discountAmount: Number(row.discountAmount),
    qty: Number(row.qty),
    trxNumber: String(row.trxNumber),
    soldAt: String(row.soldAt),
  }))
}
