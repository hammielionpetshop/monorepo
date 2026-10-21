import {
  db,
  sql,
  eq,
  and,
  inArray,
  stockOpnames,
  productUomConversions,
} from '@/lib/db'
import { stockLedgerUnion } from './stock-ledger'

// SO yang belum tuntas — satu cabang tidak boleh punya dua sekaligus (termasuk dokumen
// hitung ulang), supaya dua penghitungan tidak sama-sama menggeser stok pembanding.
const ACTIVE_SO_STATUSES = ['DRAFT', 'PENDING']

function generateRecountSONumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `SOR-${dateStr}-${random}`
}

export class RecountError extends Error {}

/**
 * Buat dokumen "Hitung Ulang": SO Besar verifikasi yang tertaut ke SO induk yang sudah
 * disetujui. Dokumen dibuat kosong (tanpa item) berstatus PENDING — owner mengisi qty
 * fisik ke-2 lewat tabel input SO Besar yang sudah ada, dan `recount_of_so_id` menandai
 * tautannya ke induk. Kandidat produknya dibatasi ke item SO induk (lihat
 * getSOFullCandidates), dan stok pembanding dibaca live saat tiap item dikunci.
 */
export async function createRecountDoc(params: {
  parentSoId: number
  userId: number
  branchScope: string | undefined
  userBranchId: number
  notes: string
}): Promise<{ id: number; soNumber: string; parentSoNumber: string }> {
  const { parentSoId, userId, branchScope, userBranchId, notes } = params

  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select({
        id: stockOpnames.id,
        soNumber: stockOpnames.soNumber,
        type: stockOpnames.type,
        status: stockOpnames.status,
        branchId: stockOpnames.branchId,
        recountOfSoId: stockOpnames.recountOfSoId,
      })
      .from(stockOpnames)
      .where(eq(stockOpnames.id, parentSoId))
      .for('update')
      .limit(1)

    if (!parent) throw new RecountError('PARENT_NOT_FOUND')
    if (parent.type !== 'FULL') throw new RecountError('PARENT_NOT_FULL')
    if (parent.status !== 'APPROVED') throw new RecountError('PARENT_NOT_APPROVED')
    // Hitung ulang dari hitung ulang tidak diizinkan — selalu tautkan ke SO asli.
    if (parent.recountOfSoId != null) throw new RecountError('PARENT_IS_RECOUNT')
    if (branchScope !== 'ALL' && parent.branchId !== userBranchId) {
      throw new RecountError('BRANCH_FORBIDDEN')
    }

    const active = await tx
      .select({ id: stockOpnames.id })
      .from(stockOpnames)
      .where(and(eq(stockOpnames.branchId, parent.branchId), inArray(stockOpnames.status, ACTIVE_SO_STATUSES)))
      .limit(1)
    if (active.length > 0) throw new RecountError('ACTIVE_SO_EXISTS')

    const [inserted] = await tx
      .insert(stockOpnames)
      .values({
        soNumber: generateRecountSONumber(),
        branchId: parent.branchId,
        type: 'FULL',
        status: 'PENDING',
        createdById: userId,
        recountOfSoId: parent.id,
        notes,
      })
      .returning({ id: stockOpnames.id, soNumber: stockOpnames.soNumber })

    return { id: inserted.id, soNumber: inserted.soNumber, parentSoNumber: parent.soNumber }
  })
}

/**
 * Mutasi stok bersih per produk antara SO induk disetujui dan sekarang — dipakai kolom
 * "Mutasi sejak SO induk" supaya owner melihat kenapa stok sistem kini berbeda dari
 * hitungan SO induk (penjualan, PO masuk, retur, transfer sudah tercatat & otomatis
 * diperhitungkan). Memakai `stockLedgerUnion` (satu sumber tunggal mutasi stok — jangan
 * disalin). Baris OPNAME milik dokumen hitung ulang itu sendiri dikecualikan supaya
 * koreksi hasil hitung ulang tidak ikut terhitung sebagai "mutasi".
 *
 * Mengembalikan Map productId → selisih qty dalam SATUAN DASAR (pemanggil mengonversi
 * ke satuan item memakai rasio UOM).
 */
export async function getMovementSinceParent(
  branchId: number,
  since: Date,
  productIds: number[],
  excludeSoId: number,
): Promise<Map<number, number>> {
  if (productIds.length === 0) return new Map()

  const rows = (await db.execute(sql`
    WITH sm AS (${stockLedgerUnion})
    SELECT sm.product_id AS product_id, sm.uom_id AS uom_id, SUM(sm.qty_change)::int AS qty
    FROM sm
    WHERE sm.branch_id = ${branchId}
      AND sm.product_id IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})
      AND sm.created_at > ${since.toISOString()}::timestamp
      AND NOT (sm.movement_type = 'OPNAME' AND sm.reference_id = ${String(excludeSoId)})
    GROUP BY sm.product_id, sm.uom_id
  `)) as Record<string, unknown>[]

  const pairs = rows.map((r) => ({
    productId: Number(r.product_id),
    uomId: Number(r.uom_id),
    qty: Number(r.qty),
  }))
  if (pairs.length === 0) return new Map()

  const uomIds = [...new Set(pairs.map((p) => p.uomId))]
  const ratioRows = await db
    .select({
      productId: productUomConversions.productId,
      uomId: productUomConversions.uomId,
      ratio: productUomConversions.ratio,
    })
    .from(productUomConversions)
    .where(and(inArray(productUomConversions.productId, productIds), inArray(productUomConversions.uomId, uomIds)))
  const ratioByKey = new Map(ratioRows.map((r) => [`${r.productId}:${r.uomId}`, r.ratio]))

  const baseByProduct = new Map<number, number>()
  for (const p of pairs) {
    const ratio = ratioByKey.get(`${p.productId}:${p.uomId}`) ?? 1
    baseByProduct.set(p.productId, (baseByProduct.get(p.productId) ?? 0) + p.qty * ratio)
  }
  return baseByProduct
}
