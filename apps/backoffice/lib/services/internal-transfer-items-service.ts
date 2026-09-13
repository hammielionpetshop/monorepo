import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  products,
  productUomConversions,
  productUomCosts,
  eq,
  and,
  inArray,
} from '@/lib/db'

// Fase 1 — belum disetujui: requester (cabang tujuan) masih bebas mengubah permintaannya
// sendiri. Fase 2 — sudah disetujui/sedang disiapkan: cabang pengirim sudah mulai memproses,
// jadi perubahan isi PO butuh wewenang setingkat approve, bukan sekadar permintaan biasa.
export const REQUESTER_EDITABLE_STATUSES: string[] = ['DRAFT', 'PENDING_APPROVAL']
export const APPROVER_EDITABLE_STATUSES: string[] = ['APPROVED', 'PREPARING']

export interface EditItemInput {
  id?: number
  productId?: number
  uomId?: number
  qtyRequested: number
}

export class InternalTransferEditError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Susun ulang item sebuah IBT (kept/new/removed), resolve harga modal item baru, lalu
 * simpan semuanya dalam satu transaksi. Dipakai bersama oleh PATCH backoffice
 * (`/api/bo/internal-transfers/[id]`, fase requester ATAU approver, boleh pindah cabang
 * tujuan) dan PATCH POS (`/api/pos/internal-order/[id]`, khusus fase requester, cabang
 * tujuan tetap) — supaya logic resolve cost price & transaksi tidak dobel-tulis.
 */
export async function applyInternalTransferItemEdits(
  transferId: number,
  transfer: { sourceBranchId: number; destinationBranchId: number },
  resolvedDestinationBranchId: number,
  submittedItems: EditItemInput[],
  editableStatusList: string[]
) {
  const existingItems = await db
    .select({
      id: interBranchTransferItems.id,
      productId: interBranchTransferItems.productId,
      uomId: interBranchTransferItems.uomId,
      costPriceAtTransfer: interBranchTransferItems.costPriceAtTransfer,
    })
    .from(interBranchTransferItems)
    .where(eq(interBranchTransferItems.transferId, transferId))

  const existingItemMap = new Map(existingItems.map((i) => [i.id, i]))
  const submittedExistingIds = new Set<number>()

  const keptItems: { id: number; qtyRequested: number; costPriceAtTransfer: number }[] = []
  const newItemInputs: { productId: number; uomId: number; qtyRequested: number }[] = []

  for (const item of submittedItems) {
    if (item.id !== undefined) {
      const existing = existingItemMap.get(item.id)
      if (!existing) {
        throw new InternalTransferEditError(`Item #${item.id} tidak ditemukan pada transfer ini`, 400)
      }
      submittedExistingIds.add(item.id)
      keptItems.push({
        id: item.id,
        qtyRequested: item.qtyRequested,
        costPriceAtTransfer: existing.costPriceAtTransfer,
      })
    } else {
      // Sudah divalidasi oleh Zod refine bahwa productId & uomId ada
      newItemInputs.push({
        productId: item.productId!,
        uomId: item.uomId!,
        qtyRequested: item.qtyRequested,
      })
    }
  }

  const removedItemIds = existingItems.filter((i) => !submittedExistingIds.has(i.id)).map((i) => i.id)

  // Validasi produk & UOM item baru, sekaligus resolve harga modal — pola sama seperti
  // POST /api/bo/internal-transfers (auto-fill costPrice dari productUomCosts cabang
  // pengirim, fallback defaultCostPrice × ratio konversi).
  const resolvedNewItems: { productId: number; uomId: number; qtyRequested: number; costPriceAtTransfer: number }[] = []

  if (newItemInputs.length > 0) {
    const productIds = [...new Set(newItemInputs.map((i) => i.productId))]

    const [productRows, convRows, uomCostRows] = await Promise.all([
      db
        .select({ id: products.id, baseUomId: products.baseUomId, defaultCostPrice: products.defaultCostPrice })
        .from(products)
        .where(inArray(products.id, productIds)),
      db
        .select({ productId: productUomConversions.productId, uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
        .from(productUomConversions)
        .where(inArray(productUomConversions.productId, productIds)),
      db
        .select({ productId: productUomCosts.productId, uomId: productUomCosts.uomId, costPrice: productUomCosts.costPrice })
        .from(productUomCosts)
        .where(and(inArray(productUomCosts.productId, productIds), eq(productUomCosts.branchId, transfer.sourceBranchId))),
    ])

    const productMap = new Map(productRows.map((p) => [p.id, p]))
    const convMap = new Map(convRows.map((c) => [`${c.productId}-${c.uomId}`, c.ratio]))
    const uomCostMap = new Map(uomCostRows.map((c) => [`${c.productId}-${c.uomId}`, c.costPrice]))

    for (const item of newItemInputs) {
      const prod = productMap.get(item.productId)
      if (!prod) {
        throw new InternalTransferEditError(`Produk #${item.productId} tidak ditemukan`, 400)
      }

      const isBaseUom = item.uomId === prod.baseUomId
      const ratio = convMap.get(`${item.productId}-${item.uomId}`)
      if (!isBaseUom && ratio === undefined) {
        throw new InternalTransferEditError(
          `Satuan ukur tidak valid untuk produk #${item.productId}. Pastikan konversi UOM sudah diatur di master data produk.`,
          409
        )
      }

      let costPrice = uomCostMap.get(`${item.productId}-${item.uomId}`)
      if (costPrice === undefined && prod.defaultCostPrice) {
        costPrice = isBaseUom ? prod.defaultCostPrice : Math.round(prod.defaultCostPrice * (ratio ?? 1))
      }

      resolvedNewItems.push({
        productId: item.productId,
        uomId: item.uomId,
        qtyRequested: item.qtyRequested,
        costPriceAtTransfer: costPrice ?? 0,
      })
    }
  }

  const totalTransferValue =
    keptItems.reduce((sum, i) => sum + i.qtyRequested * i.costPriceAtTransfer, 0) +
    resolvedNewItems.reduce((sum, i) => sum + i.qtyRequested * i.costPriceAtTransfer, 0)

  return db.transaction(async (tx) => {
    // Fail-fast: verifikasi status belum berubah (mis. sudah di-ship/cancel oleh aksi lain
    // yang berjalan bersamaan) sebelum mulai ubah data — pola sama seperti [id]/status/route.ts.
    const [locked] = await tx
      .select({ id: interBranchTransfers.id })
      .from(interBranchTransfers)
      .where(and(eq(interBranchTransfers.id, transferId), inArray(interBranchTransfers.status, editableStatusList)))
      .limit(1)

    if (!locked) throw new InternalTransferEditError('Status transfer sudah berubah, silakan refresh halaman', 409)

    if (removedItemIds.length > 0) {
      await tx.delete(interBranchTransferItems).where(inArray(interBranchTransferItems.id, removedItemIds))
    }

    for (const item of keptItems) {
      await tx
        .update(interBranchTransferItems)
        .set({ qtyRequested: item.qtyRequested })
        .where(eq(interBranchTransferItems.id, item.id))
    }

    if (resolvedNewItems.length > 0) {
      await tx.insert(interBranchTransferItems).values(
        resolvedNewItems.map((item) => ({
          transferId,
          productId: item.productId,
          uomId: item.uomId,
          qtyRequested: item.qtyRequested,
          qtyShipped: 0,
          qtyReceived: 0,
          costPriceAtTransfer: item.costPriceAtTransfer,
        }))
      )
    }

    const [updated] = await tx
      .update(interBranchTransfers)
      .set({
        destinationBranchId: resolvedDestinationBranchId,
        totalTransferValue,
        updatedAt: new Date(),
      })
      .where(and(eq(interBranchTransfers.id, transferId), inArray(interBranchTransfers.status, editableStatusList)))
      .returning()

    if (!updated) throw new InternalTransferEditError('Status transfer sudah berubah, silakan refresh halaman', 409)

    return updated
  })
}
