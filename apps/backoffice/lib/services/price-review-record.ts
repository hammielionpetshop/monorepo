import { db, priceReviews, eq, and, sql } from '@/lib/db'
import type { PriceReviewSource } from '@petshop/db'

type Tx = any

/** Baris OPEN (cabang, produk), dikunci untuk diubah. */
export async function lockOpenPriceReview(tx: Tx, branchId: number, productId: number) {
  const [row] = await tx
    .select()
    .from(priceReviews)
    .where(and(eq(priceReviews.branchId, branchId), eq(priceReviews.productId, productId), eq(priceReviews.status, 'OPEN')))
    .for('update')
    .limit(1)
  return row as typeof priceReviews.$inferSelect | undefined
}

const sameSource = (a: PriceReviewSource, b: PriceReviewSource) => a.type === b.type && a.id === b.id && a.ref === b.ref

/**
 * Modal (cabang, produk) naik: buka Pemeriksaan Harga Jual, atau perbarui yang masih terbuka.
 * Modal lama pembanding tetap dari saat Pemeriksaan pertama dibuka — harga jual terakhir
 * ditetapkan terhadap modal itu. Dipanggil di dalam transaksi barang masuk.
 */
export async function recordPriceReviewInTx(
  tx: Tx,
  input: {
    branchId: number
    productId: number
    oldCostPerBase: number | null
    newCostPerBase: number
    costSyncId: number
    source: PriceReviewSource
  },
): Promise<void> {
  const { branchId, productId, source } = input
  let open = await lockOpenPriceReview(tx, branchId, productId)
  if (!open) {
    const inserted = await tx
      .insert(priceReviews)
      .values({
        branchId,
        productId,
        oldCostPerBase: input.oldCostPerBase,
        newCostPerBase: input.newCostPerBase,
        costSyncId: input.costSyncId,
        sources: [source],
      })
      .onConflictDoNothing({ target: [priceReviews.branchId, priceReviews.productId], where: sql`status = 'OPEN'` })
      .returning({ id: priceReviews.id })
    if (inserted.length > 0) return
    // Transaksi lain baru saja membuka baris yang sama — perbarui baris itu.
    open = await lockOpenPriceReview(tx, branchId, productId)
    if (!open) return
  }
  const sources = (open.sources ?? []).some(s => sameSource(s, source)) ? open.sources : [...(open.sources ?? []), source]
  await tx
    .update(priceReviews)
    .set({ newCostPerBase: input.newCostPerBase, costSyncId: input.costSyncId, sources, updatedAt: new Date() })
    .where(eq(priceReviews.id, open.id))
}

export async function resolvePriceReviewInTx(
  tx: Tx,
  input: { id: number; status: 'APPROVED' | 'KEPT' | 'CLOSED'; userId: number | null; note: string | null },
): Promise<void> {
  await tx
    .update(priceReviews)
    .set({ status: input.status, resolvedById: input.userId, resolvedAt: new Date(), note: input.note, updatedAt: new Date() })
    .where(and(eq(priceReviews.id, input.id), eq(priceReviews.status, 'OPEN')))
}

/** Jumlah Pemeriksaan terbuka yang berasal dari satu dokumen (tanda di detail PO / transfer). */
export async function countOpenPriceReviewsForSource(types: string[], id: number): Promise<number> {
  const containment = sql.join(
    types.map(type => sql`${priceReviews.sources} @> ${JSON.stringify([{ type, id }])}::jsonb`),
    sql` OR `,
  )
  const [row] = await db
    .select({ n: sql<number>`CAST(COUNT(*) AS INTEGER)` })
    .from(priceReviews)
    .where(and(eq(priceReviews.status, 'OPEN'), sql`(${containment})`))
  return Number(row?.n ?? 0)
}
