import { alias } from 'drizzle-orm/pg-core'
import {
  db,
  supplierReturns,
  supplierReturnItems,
  suppliers,
  branches,
  users,
  products,
  unitsOfMeasure,
  purchaseOrders,
  purchaseOrderItems,
  eq,
  and,
  asc,
  desc,
  inArray,
} from '@/lib/db'
import { loadReturnablePoItems, poItemClaimPrice } from '@/lib/services/supplier-return-service'

export type SupplierReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface SupplierReturnItemView {
  id: number
  productId: number
  productName: string
  productSku: string | null
  uomCode: string
  qty: number
  unitPrice: number
  lineValue: number
  cogs: number | null
  photoUrl: string | null
  fromPo: boolean
  /**
   * Harga klaim per satuan MENURUT PO SAAT INI (faktur bisa dicocokkan ulang setelah diajukan).
   * Hanya untuk pengajuan PENDING ber-PO — itulah harga yang dipakai saat disetujui. Null =
   * tidak berlaku, atau harga faktur sedang menunggu diisi.
   */
  currentUnitPrice: number | null
}

export interface SupplierReturnView {
  id: number
  returnNumber: string
  status: SupplierReturnStatus
  reason: string
  notes: string
  source: string
  supplierId: number
  supplierName: string
  supplierPhone: string | null
  supplierAddress: string | null
  branchId: number
  branchName: string
  poId: number | null
  poNumber: string | null
  totalValue: number
  totalCogs: number | null
  payableDeduction: number
  creditAmount: number
  requestedAt: string
  requestedByName: string
  resolvedAt: string | null
  resolvedByName: string | null
  rejectionReason: string | null
  items: SupplierReturnItemView[]
}

const resolvedBy = alias(users, 'resolved_by')

export async function listSupplierReturns(params: {
  status?: SupplierReturnStatus
  /** null = semua cabang. */
  branchId: number | null
  ids?: number[]
  limit?: number
}): Promise<SupplierReturnView[]> {
  const headers = await db
    .select({
      id: supplierReturns.id,
      returnNumber: supplierReturns.returnNumber,
      status: supplierReturns.status,
      reason: supplierReturns.reason,
      notes: supplierReturns.notes,
      source: supplierReturns.source,
      supplierId: supplierReturns.supplierId,
      supplierName: suppliers.name,
      supplierPhone: suppliers.phone,
      supplierAddress: suppliers.address,
      branchId: supplierReturns.branchId,
      branchName: branches.name,
      poId: supplierReturns.poId,
      poNumber: purchaseOrders.poNumber,
      totalValue: supplierReturns.totalValue,
      totalCogs: supplierReturns.totalCogs,
      payableDeduction: supplierReturns.payableDeduction,
      creditAmount: supplierReturns.creditAmount,
      requestedAt: supplierReturns.requestedAt,
      requestedByName: users.name,
      resolvedAt: supplierReturns.resolvedAt,
      resolvedByName: resolvedBy.name,
      rejectionReason: supplierReturns.rejectionReason,
    })
    .from(supplierReturns)
    .innerJoin(suppliers, eq(supplierReturns.supplierId, suppliers.id))
    .innerJoin(branches, eq(supplierReturns.branchId, branches.id))
    .leftJoin(purchaseOrders, eq(supplierReturns.poId, purchaseOrders.id))
    .leftJoin(users, eq(supplierReturns.requestedById, users.id))
    .leftJoin(resolvedBy, eq(supplierReturns.resolvedById, resolvedBy.id))
    .where(and(
      params.status ? eq(supplierReturns.status, params.status) : undefined,
      params.branchId != null ? eq(supplierReturns.branchId, params.branchId) : undefined,
      params.ids ? inArray(supplierReturns.id, params.ids) : undefined,
    ))
    .orderBy(params.status === 'PENDING' ? asc(supplierReturns.requestedAt) : desc(supplierReturns.requestedAt))
    .limit(params.limit ?? 200)

  const ids = headers.map(h => h.id)
  const itemRows = ids.length === 0 ? [] : await db
    .select({
      id: supplierReturnItems.id,
      supplierReturnId: supplierReturnItems.supplierReturnId,
      productId: supplierReturnItems.productId,
      productName: products.name,
      productSku: products.sku,
      uomCode: unitsOfMeasure.code,
      qty: supplierReturnItems.qty,
      unitPrice: supplierReturnItems.unitPrice,
      lineValue: supplierReturnItems.lineValue,
      cogs: supplierReturnItems.cogs,
      photoUrl: supplierReturnItems.photoUrl,
      poItemId: supplierReturnItems.poItemId,
    })
    .from(supplierReturnItems)
    .leftJoin(products, eq(supplierReturnItems.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(supplierReturnItems.uomId, unitsOfMeasure.id))
    .where(inArray(supplierReturnItems.supplierReturnId, ids))
    .orderBy(asc(supplierReturnItems.id))

  const pendingIds = new Set(headers.filter(h => h.status === 'PENDING' && h.poId != null).map(h => h.id))
  const pendingPoItemIds = [
    ...new Set(itemRows.filter(r => pendingIds.has(r.supplierReturnId) && r.poItemId != null).map(r => r.poItemId as number)),
  ]
  const poPrices = pendingPoItemIds.length === 0 ? [] : await db
    .select({ id: purchaseOrderItems.id, unitCost: purchaseOrderItems.unitCost, invoiceUnitCost: purchaseOrderItems.invoiceUnitCost })
    .from(purchaseOrderItems)
    .where(inArray(purchaseOrderItems.id, pendingPoItemIds))
  const currentPrice = new Map(poPrices.map(p => [p.id, poItemClaimPrice(p)]))

  const itemsByReturn = new Map<number, SupplierReturnItemView[]>()
  for (const { supplierReturnId, poItemId, ...row } of itemRows) {
    const list = itemsByReturn.get(supplierReturnId) ?? []
    list.push({
      ...row,
      productName: row.productName ?? 'Produk Dihapus',
      uomCode: row.uomCode ?? '-',
      fromPo: poItemId != null,
      currentUnitPrice: pendingIds.has(supplierReturnId) && poItemId != null ? (currentPrice.get(poItemId) ?? null) : null,
    })
    itemsByReturn.set(supplierReturnId, list)
  }

  return headers.map(h => ({
    ...h,
    status: h.status as SupplierReturnStatus,
    requestedAt: h.requestedAt.toISOString(),
    requestedByName: h.requestedByName ?? '-',
    resolvedAt: h.resolvedAt ? h.resolvedAt.toISOString() : null,
    items: itemsByReturn.get(h.id) ?? [],
  }))
}

export async function getSupplierReturn(id: number): Promise<SupplierReturnView | null> {
  const [row] = await listSupplierReturns({ branchId: null, ids: [id], limit: 1 })
  return row ?? null
}

export async function listSupplierOptions() {
  // Supplier nonaktif (mis. "Gudang", "Repack", "Return" bawaan sistem lama) tidak bisa dipilih.
  return db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name))
}

/** PO supplier yang sudah selesai diterima di cabang ini — isi dropdown "PO asal". */
export async function listReturnablePurchaseOrders(supplierId: number, branchId: number) {
  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      invoiceNumber: purchaseOrders.invoiceNumber,
      totalAmount: purchaseOrders.totalAmount,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .where(and(
      eq(purchaseOrders.supplierId, supplierId),
      eq(purchaseOrders.branchId, branchId),
      eq(purchaseOrders.poType, 'EXTERNAL'),
      eq(purchaseOrders.status, 'COMPLETED'),
    ))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(100)
  return rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

export async function listReturnablePoItemOptions(poId: number) {
  const items = await loadReturnablePoItems(db, poId)
  if (items.length === 0) return []
  const productIds = [...new Set(items.map(i => i.productId))]
  const uomIds = [...new Set(items.map(i => i.uomId))]
  const [productRows, uomRows] = await Promise.all([
    db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).where(inArray(products.id, productIds)),
    db.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code }).from(unitsOfMeasure).where(inArray(unitsOfMeasure.id, uomIds)),
  ])
  const productMap = new Map(productRows.map(p => [p.id, p]))
  const uomMap = new Map(uomRows.map(u => [u.id, u.code]))
  return items.map(i => ({
    poItemId: i.id,
    productId: i.productId,
    productName: productMap.get(i.productId)?.name ?? 'Produk Dihapus',
    productSku: productMap.get(i.productId)?.sku ?? null,
    uomId: i.uomId,
    uomCode: uomMap.get(i.uomId) ?? '-',
    qtyReceived: i.qtyReceived - i.qtyDamaged,
    alreadyReturned: i.alreadyReturned,
    returnableQty: i.returnableQty,
    claimPrice: i.claimPrice,
  }))
}
