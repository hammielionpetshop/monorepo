import { alias } from 'drizzle-orm/pg-core'
import {
  db,
  internalReturns,
  internalReturnItems,
  interBranchTransfers,
  interBranchPayables,
  transactions,
  branches,
  users,
  products,
  unitsOfMeasure,
  eq,
  and,
  or,
  asc,
  desc,
  inArray,
} from '@/lib/db'

export type InternalReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'CANCELLED'

export const INTERNAL_RETURN_STATUSES: InternalReturnStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED']

export interface InternalReturnItemView {
  id: number
  productId: number
  productName: string
  productSku: string | null
  uomCode: string
  qty: number
  /** Harga per satuan saat diajukan (harga nota, atau harga hasil revisi sebelumnya). */
  unitPrice: number
  lineValue: number
  photoUrl: string | null
  /** Revisi Harga Beli: harga usulan pemohon & harga final penyetuju (null sebelum disetujui). */
  proposedUnitPrice: number | null
  finalUnitPrice: number | null
  /** Revisi Harga Beli, setelah disetujui: Penyesuaian Modal baris ini (barang yang sudah terpakai). */
  cogsAdjustment: number | null
}

export interface InternalReturnView {
  id: number
  returnNumber: string
  kind: string
  status: InternalReturnStatus
  reason: string
  notes: string
  source: string
  transferId: number
  ibtNumber: string
  saleTrxNumber: string
  requestBranchId: number
  requestBranchName: string
  receiverBranchId: number
  receiverBranchName: string
  senderBranchId: number
  senderBranchName: string
  totalValue: number
  payableDeduction: number
  creditAmount: number
  /** Revisi Harga Beli: total Penyesuaian Modal (barang yang sudah terpakai) — masuk Laba Rugi cabang penerima. */
  cogsAdjustment: number
  /**
   * Sisa hutang internal kiriman itu SAAT INI (total − terbayar). Dipakai popup penyetuju untuk
   * memperkirakan berapa yang memotong hutang dan berapa yang jadi Saldo Internal. Null = kiriman
   * belum punya catatan hutang.
   */
  payableRemaining: number | null
  requestedAt: string
  requestedById: number
  requestedByName: string
  resolvedAt: string | null
  resolvedByName: string | null
  rejectionReason: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  cancellationReason: string | null
  items: InternalReturnItemView[]
}

const requestBranch = alias(branches, 'request_branch')
const receiverBranch = alias(branches, 'receiver_branch')
const senderBranch = alias(branches, 'sender_branch')
const resolvedBy = alias(users, 'resolved_by')
const cancelledBy = alias(users, 'cancelled_by')

export async function listInternalReturns(params: {
  status?: InternalReturnStatus
  /** null = semua cabang; angka = dokumen yang cabang itu pengaju, penerima, atau pengirimnya. */
  branchId: number | null
  ids?: number[]
  limit?: number
}): Promise<InternalReturnView[]> {
  const headers = await db
    .select({
      id: internalReturns.id,
      returnNumber: internalReturns.returnNumber,
      kind: internalReturns.kind,
      status: internalReturns.status,
      reason: internalReturns.reason,
      notes: internalReturns.notes,
      source: internalReturns.source,
      transferId: internalReturns.transferId,
      ibtNumber: interBranchTransfers.ibtNumber,
      saleTrxNumber: transactions.trxNumber,
      requestBranchId: internalReturns.requestBranchId,
      requestBranchName: requestBranch.name,
      receiverBranchId: internalReturns.receiverBranchId,
      receiverBranchName: receiverBranch.name,
      senderBranchId: internalReturns.senderBranchId,
      senderBranchName: senderBranch.name,
      totalValue: internalReturns.totalValue,
      payableDeduction: internalReturns.payableDeduction,
      creditAmount: internalReturns.creditAmount,
      cogsAdjustment: internalReturns.cogsAdjustment,
      payableTotal: interBranchPayables.totalAmount,
      payablePaid: interBranchPayables.paidAmount,
      requestedAt: internalReturns.requestedAt,
      requestedById: internalReturns.requestedById,
      requestedByName: users.name,
      resolvedAt: internalReturns.resolvedAt,
      resolvedByName: resolvedBy.name,
      rejectionReason: internalReturns.rejectionReason,
      cancelledAt: internalReturns.cancelledAt,
      cancelledByName: cancelledBy.name,
      cancellationReason: internalReturns.cancellationReason,
    })
    .from(internalReturns)
    .innerJoin(interBranchTransfers, eq(internalReturns.transferId, interBranchTransfers.id))
    .innerJoin(transactions, eq(internalReturns.saleTransactionId, transactions.id))
    .innerJoin(requestBranch, eq(internalReturns.requestBranchId, requestBranch.id))
    .innerJoin(receiverBranch, eq(internalReturns.receiverBranchId, receiverBranch.id))
    .innerJoin(senderBranch, eq(internalReturns.senderBranchId, senderBranch.id))
    .leftJoin(interBranchPayables, eq(interBranchPayables.transferId, internalReturns.transferId))
    .leftJoin(users, eq(internalReturns.requestedById, users.id))
    .leftJoin(resolvedBy, eq(internalReturns.resolvedById, resolvedBy.id))
    .leftJoin(cancelledBy, eq(internalReturns.cancelledById, cancelledBy.id))
    .where(and(
      params.status ? eq(internalReturns.status, params.status) : undefined,
      params.branchId != null
        ? or(
            eq(internalReturns.requestBranchId, params.branchId),
            eq(internalReturns.receiverBranchId, params.branchId),
            eq(internalReturns.senderBranchId, params.branchId),
          )
        : undefined,
      params.ids ? inArray(internalReturns.id, params.ids) : undefined,
    ))
    .orderBy(params.status === 'PENDING' ? asc(internalReturns.requestedAt) : desc(internalReturns.requestedAt))
    .limit(params.limit ?? 200)

  const ids = headers.map(h => h.id)
  const itemRows = ids.length === 0 ? [] : await db
    .select({
      id: internalReturnItems.id,
      internalReturnId: internalReturnItems.internalReturnId,
      productId: internalReturnItems.productId,
      productName: products.name,
      productSku: products.sku,
      uomCode: unitsOfMeasure.code,
      qty: internalReturnItems.qty,
      unitPrice: internalReturnItems.oldUnitPrice,
      lineValue: internalReturnItems.lineValue,
      photoUrl: internalReturnItems.photoUrl,
      proposedUnitPrice: internalReturnItems.proposedUnitPrice,
      finalUnitPrice: internalReturnItems.finalUnitPrice,
      cogsAdjustment: internalReturnItems.cogsAdjustment,
    })
    .from(internalReturnItems)
    .leftJoin(products, eq(internalReturnItems.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(internalReturnItems.uomId, unitsOfMeasure.id))
    .where(inArray(internalReturnItems.internalReturnId, ids))
    .orderBy(asc(internalReturnItems.id))

  const itemsByReturn = new Map<number, InternalReturnItemView[]>()
  for (const { internalReturnId, ...row } of itemRows) {
    const list = itemsByReturn.get(internalReturnId) ?? []
    list.push({ ...row, productName: row.productName ?? 'Produk Dihapus', uomCode: row.uomCode ?? '-' })
    itemsByReturn.set(internalReturnId, list)
  }

  return headers.map(({ payableTotal, payablePaid, ...h }) => ({
    ...h,
    status: h.status as InternalReturnStatus,
    payableRemaining: payableTotal == null ? null : Math.max(0, payableTotal - (payablePaid ?? 0)),
    requestedAt: h.requestedAt.toISOString(),
    requestedByName: h.requestedByName ?? '-',
    resolvedAt: h.resolvedAt ? h.resolvedAt.toISOString() : null,
    cancelledAt: h.cancelledAt ? h.cancelledAt.toISOString() : null,
    items: itemsByReturn.get(h.id) ?? [],
  }))
}

export async function getInternalReturn(id: number): Promise<InternalReturnView | null> {
  const [row] = await listInternalReturns({ branchId: null, ids: [id], limit: 1 })
  return row ?? null
}

/** Jenis dokumen (Barang Dikembalikan / Revisi Harga Beli) — rute setujui & batalkan memilih service dari sini. */
export async function getInternalReturnKind(id: number): Promise<string | null> {
  const [row] = await db.select({ kind: internalReturns.kind }).from(internalReturns).where(eq(internalReturns.id, id)).limit(1)
  return row?.kind ?? null
}

/** Dokumen boleh dilihat cabang yang terlibat: pengaju, penerima, atau pengirim. */
export function internalReturnInvolvesBranch(row: Pick<InternalReturnView, 'requestBranchId' | 'receiverBranchId' | 'senderBranchId'>, branchId: number) {
  return row.requestBranchId === branchId || row.receiverBranchId === branchId || row.senderBranchId === branchId
}
