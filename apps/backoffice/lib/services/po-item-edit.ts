import Big from 'big.js'
import {
  purchaseOrders,
  purchaseOrderItems,
  poReceivingItems,
  supplierReturnItems,
  products,
  auditLogs,
  eq,
  and,
  inArray,
} from '../db'
import type { Tx } from '../stock-adjustment'
import { PO_ITEM_EDITABLE_STATUSES, canEditPoItems, needsReapproval } from './po-item-edit-rules'

/** Ubah isi PO Supplier sebelum penerimaan disetujui (spec 2026-11-06-po-edit-items-design). */
export class PoItemEditError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message)
  }
}

export interface PoItemInput {
  productId: number
  uomId: number
  qtyOrdered: number
  unitCost: number
}

export interface PoItemEditActor {
  userId: number
  role: string
  branchScope: string
  branchId: number
}

export interface PoItemEditResult {
  changed: boolean
  totalAmount: number
  status: string
  backToApproval: boolean
}

const keyOf = (i: { productId: number; uomId: number }) => `${i.productId}:${i.uomId}`

export async function editPoItems(
  tx: Tx,
  { poId, items, actor }: { poId: number; items: PoItemInput[]; actor: PoItemEditActor },
): Promise<PoItemEditResult> {
  if (new Set(items.map(keyOf)).size !== items.length) {
    throw new PoItemEditError('Produk + satuan yang sama muncul dua kali', 400)
  }

  const where = actor.branchScope === 'ALL'
    ? eq(purchaseOrders.id, poId)
    : and(eq(purchaseOrders.id, poId), eq(purchaseOrders.branchId, actor.branchId))
  const [po] = await tx
    .select({ id: purchaseOrders.id, status: purchaseOrders.status, poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders)
    .where(where)
    .for('update')
    .limit(1)
  if (!po) throw new PoItemEditError('Purchase Order tidak ditemukan', 404)

  if (po.status === 'COMPLETED') {
    throw new PoItemEditError('PO sudah Selesai — stok dan hutang sudah tercatat. Gunakan "Buat PO Tambahan" untuk barang susulan.')
  }
  if (!(PO_ITEM_EDITABLE_STATUSES as readonly string[]).includes(po.status)) {
    throw new PoItemEditError('Isi PO tidak bisa diubah pada status ini')
  }
  if (!canEditPoItems(po.status, actor.role)) {
    throw new PoItemEditError('Hanya Owner/GM yang bisa mengubah isi PO yang sudah disimpan', 403)
  }

  const old = await tx
    .select({
      id: purchaseOrderItems.id,
      productId: purchaseOrderItems.productId,
      uomId: purchaseOrderItems.uomId,
      qtyOrdered: purchaseOrderItems.qtyOrdered,
      qtyReceived: purchaseOrderItems.qtyReceived,
      unitCost: purchaseOrderItems.unitCost,
      productName: products.name,
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(eq(purchaseOrderItems.poId, poId))
  const oldIds = old.map((o) => o.id)

  // Baris yang sudah punya catatan penerimaan/retur tidak boleh dihapus (FK + jejak barang datang).
  const [receivedRefs, returnRefs] = oldIds.length
    ? await Promise.all([
        tx.selectDistinct({ id: poReceivingItems.poItemId }).from(poReceivingItems).where(inArray(poReceivingItems.poItemId, oldIds)),
        tx.selectDistinct({ id: supplierReturnItems.poItemId }).from(supplierReturnItems).where(inArray(supplierReturnItems.poItemId, oldIds)),
      ])
    : [[], []]
  const lockedIds = new Set([...receivedRefs, ...returnRefs].map((r) => r.id))

  const incoming = new Map(items.map((i) => [keyOf(i), i]))
  const toDelete: number[] = []
  const toUpdate: { id: number; qtyOrdered: number; unitCost: number }[] = []

  for (const o of old) {
    const next = incoming.get(keyOf(o))
    const name = o.productName ?? `Produk #${o.productId}`
    if (!next) {
      if (o.qtyReceived > 0 || lockedIds.has(o.id)) {
        throw new PoItemEditError(`${name} sudah ada penerimaannya, tidak bisa dihapus`)
      }
      toDelete.push(o.id)
      continue
    }
    if (next.qtyOrdered < o.qtyReceived) {
      throw new PoItemEditError(`Qty ${name} tidak boleh kurang dari yang sudah diterima (${o.qtyReceived})`)
    }
    if (next.qtyOrdered !== o.qtyOrdered || next.unitCost !== o.unitCost) {
      toUpdate.push({ id: o.id, qtyOrdered: next.qtyOrdered, unitCost: next.unitCost })
    }
  }
  const oldKeys = new Set(old.map(keyOf))
  const toInsert = items.filter((i) => !oldKeys.has(keyOf(i)))

  const totalAmount = Math.round(
    items.reduce((sum, i) => sum.plus(new Big(i.qtyOrdered).times(i.unitCost)), new Big(0)).toNumber(),
  )
  const changed = toDelete.length + toUpdate.length + toInsert.length > 0
  if (!changed) return { changed: false, totalAmount, status: po.status, backToApproval: false }

  if (toDelete.length) await tx.delete(purchaseOrderItems).where(inArray(purchaseOrderItems.id, toDelete))
  for (const u of toUpdate) {
    await tx
      .update(purchaseOrderItems)
      .set({ qtyOrdered: u.qtyOrdered, unitCost: u.unitCost })
      .where(eq(purchaseOrderItems.id, u.id))
  }
  if (toInsert.length) {
    await tx.insert(purchaseOrderItems).values(toInsert.map((i) => ({
      poId, productId: i.productId, uomId: i.uomId, qtyOrdered: i.qtyOrdered,
      qtyReceived: 0, qtyDamaged: 0, unitCost: i.unitCost,
    })))
  }

  const backToApproval = needsReapproval(po.status)
  const status = backToApproval ? 'PENDING_APPROVAL' : po.status
  await tx
    .update(purchaseOrders)
    .set({
      totalAmount,
      updatedAt: new Date(),
      ...(backToApproval ? { status, approvedById: null, approvedAt: null } : {}),
    })
    .where(eq(purchaseOrders.id, poId))

  await tx.insert(auditLogs).values({
    userId: actor.userId,
    action: po.status === 'DRAFT' ? 'PO_DRAFT_ITEMS_UPDATED' : 'PO_ITEMS_UPDATED',
    tableName: 'purchase_orders',
    recordId: String(poId),
    oldData: JSON.stringify({
      status: po.status,
      items: old.map((o) => ({ productId: o.productId, uomId: o.uomId, qtyOrdered: o.qtyOrdered, unitCost: o.unitCost })),
    }),
    newData: JSON.stringify({ status, poNumber: po.poNumber, items }),
  })

  return { changed, totalAmount, status, backToApproval }
}
