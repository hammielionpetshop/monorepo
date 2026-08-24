import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, hasPermission, scopeFilterAny } from '@/lib/authz'
import type { JWTPayload } from '@petshop/shared'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  branches,
  users,
  products,
  productUomConversions,
  productUomCosts,
  unitsOfMeasure,
  customers,
  eq,
  and,
  inArray,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { resolveBulkSaleQtyByItem } from '@/lib/services/ibt-bulk-sale-match'

export const dynamic = 'force-dynamic'

// Fase 1 — belum disetujui: requester (cabang tujuan) masih bebas mengubah permintaannya
// sendiri. Fase 2 — sudah disetujui/sedang disiapkan: cabang pengirim sudah mulai memproses,
// jadi perubahan isi PO butuh wewenang setingkat approve, bukan sekadar permintaan biasa.
const REQUESTER_EDITABLE_STATUSES: string[] = ['DRAFT', 'PENDING_APPROVAL']
const APPROVER_EDITABLE_STATUSES: string[] = ['APPROVED', 'PREPARING']
const EDITABLE_STATUSES: string[] = [...REQUESTER_EDITABLE_STATUSES, ...APPROVER_EDITABLE_STATUSES]

function canAccessBranch(payload: JWTPayload, targetBranchId: number) {
  return payload.branchScope === 'ALL' || payload.branchId === targetBranchId
}

const editItemSchema = z
  .object({
    id: z.number().int().positive().optional(),
    productId: z.number().int().positive('productId tidak valid').optional(),
    uomId: z.number().int().positive('uomId tidak valid').optional(),
    qtyRequested: z.number().int().min(1, 'Qty minimal 1'),
  })
  .refine((item) => item.id !== undefined || (item.productId !== undefined && item.uomId !== undefined), {
    message: 'Item baru wajib menyertakan productId dan uomId',
  })

const editTransferSchema = z.object({
  destinationBranchId: z.number().int().positive('destinationBranchId tidak valid').optional(),
  items: z.array(editItemSchema).min(1, 'Minimal satu item wajib diisi'),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const transferId = parseInt(id)
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const sourceBranchAlias = alias(branches, 'source_branch')
    const destBranchAlias = alias(branches, 'dest_branch')
    const approvedByAlias = alias(users, 'approved_by_user')

    const [transferRows, itemRows] = await Promise.all([
      db
        .select({
          id: interBranchTransfers.id,
          ibtNumber: interBranchTransfers.ibtNumber,
          sourceBranchId: interBranchTransfers.sourceBranchId,
          destinationBranchId: interBranchTransfers.destinationBranchId,
          requestedById: interBranchTransfers.requestedById,
          approvedById: interBranchTransfers.approvedById,
          status: interBranchTransfers.status,
          totalTransferValue: interBranchTransfers.totalTransferValue,
          convertedTransactionId: interBranchTransfers.convertedTransactionId,
          notes: interBranchTransfers.notes,
          createdAt: interBranchTransfers.createdAt,
          updatedAt: interBranchTransfers.updatedAt,
          sourceBranchName: sourceBranchAlias.name,
          destinationBranchName: destBranchAlias.name,
          requestedByName: users.name,
          approvedByName: approvedByAlias.name,
          destinationCustomerId: customers.id,
          destinationCustomerName: customers.name,
        })
        .from(interBranchTransfers)
        .leftJoin(sourceBranchAlias, eq(interBranchTransfers.sourceBranchId, sourceBranchAlias.id))
        .leftJoin(destBranchAlias, eq(interBranchTransfers.destinationBranchId, destBranchAlias.id))
        .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
        .leftJoin(approvedByAlias, eq(interBranchTransfers.approvedById, approvedByAlias.id))
        .leftJoin(
          customers,
          and(
            eq(customers.linkedBranchId, interBranchTransfers.destinationBranchId),
            eq(customers.isInternalBranch, true)
          )
        )
        .where(
          and(
            eq(interBranchTransfers.id, transferId),
            scopeFilterAny(
              payload,
              interBranchTransfers.sourceBranchId,
              interBranchTransfers.destinationBranchId
            )
          )
        )
        .limit(1),

      db
        .select({
          id: interBranchTransferItems.id,
          transferId: interBranchTransferItems.transferId,
          productId: interBranchTransferItems.productId,
          productName: products.name,
          productSku: products.sku,
          uomId: interBranchTransferItems.uomId,
          uomCode: unitsOfMeasure.code,
          uomName: unitsOfMeasure.name,
          qtyRequested: interBranchTransferItems.qtyRequested,
          qtyShipped: interBranchTransferItems.qtyShipped,
          qtyReceived: interBranchTransferItems.qtyReceived,
          receiveNotes: interBranchTransferItems.receiveNotes,
          costPriceAtTransfer: interBranchTransferItems.costPriceAtTransfer,
          expiryDate: interBranchTransferItems.expiryDate,
          createdAt: interBranchTransferItems.createdAt,
        })
        .from(interBranchTransferItems)
        .leftJoin(products, eq(interBranchTransferItems.productId, products.id))
        .leftJoin(unitsOfMeasure, eq(interBranchTransferItems.uomId, unitsOfMeasure.id))
        .where(eq(interBranchTransferItems.transferId, transferId)),
    ])

    if (!transferRows[0]) {
      return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    }

    // IBT yang sudah dijual via Bulk Sale: tandai per item berapa qty yang benar-benar
    // terjual (bulkSaleQty), agar UI bisa membedakan item yang diproses vs yang direquest
    // tapi tidak ikut terjual (mis. stok kosong saat bulk sale). null = transfer ini tidak
    // lewat Bulk Sale sama sekali (tidak relevan).
    const convertedTransactionId = transferRows[0].convertedTransactionId
    const bulkSaleQtyByItem =
      convertedTransactionId != null ? await resolveBulkSaleQtyByItem(db, convertedTransactionId, itemRows) : null

    const transfer = {
      ...transferRows[0],
      items: itemRows.map((item) => ({
        ...item,
        bulkSaleQty: bulkSaleQtyByItem ? (bulkSaleQtyByItem.get(item.id) ?? 0) : null,
      })),
    }

    return NextResponse.json(transfer)
  } catch (error) {
    console.error('GET internal-transfer detail error:', error)
    return NextResponse.json({ error: 'Gagal mengambil detail transfer' }, { status: 500 })
  }
}

// PATCH — ubah ISI transfer (qty/item/cabang tujuan). Terpisah dari PATCH di
// `[id]/status/route.ts` yang khusus transisi status alur (approve/ship/receive/dst) — tanggung
// jawabnya beda: yang satu ubah konten PO, yang lain ubah status. Hanya boleh selama status masih
// DRAFT/PENDING_APPROVAL/APPROVED/PREPARING — begitu IN_TRANSIT (stok cabang pengirim sudah mulai
// terpotong saat ship), PO ini beku; harus cancel lalu buat baru.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const transferId = parseInt(id)
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = editTransferSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const { destinationBranchId: newDestinationBranchId, items: submittedItems } = parsed.data

    const [transfer] = await db
      .select()
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, transferId))
      .limit(1)

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    }

    if (!EDITABLE_STATUSES.includes(transfer.status)) {
      return NextResponse.json(
        {
          error: `Transfer dengan status '${transfer.status}' tidak dapat diedit lagi. Batalkan (cancel) lalu buat transfer baru jika diperlukan.`,
        },
        { status: 409 }
      )
    }

    // === Authorization dua fase (sumbu CAPABILITY + sumbu SCOPE cabang) ===
    // Fase requester (belum disetujui): permission setara pembuatan IBT, cabang tujuan.
    // Fase approver (sudah disetujui/disiapkan): permission setara approve, cabang pengirim —
    // konsisten dengan gate approve/cancel di [id]/status/route.ts karena di fase ini cabang
    // pengirim sudah mulai memproses permintaannya.
    const isRequesterPhase = REQUESTER_EDITABLE_STATUSES.includes(transfer.status)

    if (isRequesterPhase) {
      if (!hasPermission(payload, 'internal_transfer.manage')) {
        return NextResponse.json(
          { error: 'Akses ditolak. Hanya Owner dan GM yang dapat mengubah permintaan transfer ini.' },
          { status: 403 }
        )
      }
      if (!canAccessBranch(payload, transfer.destinationBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat mengubah transfer yang ditujukan ke cabang Anda.' },
          { status: 403 }
        )
      }
    } else {
      if (!hasPermission(payload, 'internal_transfer.approve')) {
        return NextResponse.json(
          { error: 'Akses ditolak. Hanya Manager, GM, dan Owner yang dapat mengubah transfer pada status ini.' },
          { status: 403 }
        )
      }
      if (!canAccessBranch(payload, transfer.sourceBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat mengubah transfer dari cabang Anda sendiri.' },
          { status: 403 }
        )
      }
    }

    // === Validasi cabang tujuan baru (jika diubah) ===
    let destinationBranchId = transfer.destinationBranchId
    if (newDestinationBranchId !== undefined && newDestinationBranchId !== transfer.destinationBranchId) {
      if (newDestinationBranchId === transfer.sourceBranchId) {
        return NextResponse.json(
          { error: 'Cabang tujuan tidak boleh sama dengan cabang asal' },
          { status: 400 }
        )
      }
      const [destBranch] = await db
        .select({ id: branches.id, isActive: branches.isActive })
        .from(branches)
        .where(eq(branches.id, newDestinationBranchId))
        .limit(1)
      if (!destBranch) {
        return NextResponse.json({ error: 'Cabang tujuan tidak ditemukan' }, { status: 400 })
      }
      if (!destBranch.isActive) {
        return NextResponse.json({ error: 'Cabang tujuan tidak aktif' }, { status: 400 })
      }
      destinationBranchId = newDestinationBranchId
    }

    // === Susun ulang daftar item: existing (update qty) vs baru (insert) vs terhapus (delete) ===
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
          return NextResponse.json(
            { error: `Item #${item.id} tidak ditemukan pada transfer ini` },
            { status: 400 }
          )
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

    const removedItemIds = existingItems
      .filter((i) => !submittedExistingIds.has(i.id))
      .map((i) => i.id)

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
          return NextResponse.json(
            { error: `Produk #${item.productId} tidak ditemukan` },
            { status: 400 }
          )
        }

        const isBaseUom = item.uomId === prod.baseUomId
        const ratio = convMap.get(`${item.productId}-${item.uomId}`)
        if (!isBaseUom && ratio === undefined) {
          return NextResponse.json(
            {
              error: `Satuan ukur tidak valid untuk produk #${item.productId}. Pastikan konversi UOM sudah diatur di master data produk.`,
            },
            { status: 409 }
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

    const editableStatusList = isRequesterPhase ? REQUESTER_EDITABLE_STATUSES : APPROVER_EDITABLE_STATUSES

    const result = await db.transaction(async (tx) => {
      // Fail-fast: verifikasi status belum berubah (mis. sudah di-ship/cancel oleh aksi lain
      // yang berjalan bersamaan) sebelum mulai ubah data — pola sama seperti [id]/status/route.ts.
      const [locked] = await tx
        .select({ id: interBranchTransfers.id })
        .from(interBranchTransfers)
        .where(and(eq(interBranchTransfers.id, transferId), inArray(interBranchTransfers.status, editableStatusList)))
        .limit(1)

      if (!locked) throw new Error('STATUS_SUDAH_BERUBAH')

      if (removedItemIds.length > 0) {
        await tx
          .delete(interBranchTransferItems)
          .where(inArray(interBranchTransferItems.id, removedItemIds))
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
          destinationBranchId,
          totalTransferValue,
          updatedAt: new Date(),
        })
        .where(and(eq(interBranchTransfers.id, transferId), inArray(interBranchTransfers.status, editableStatusList)))
        .returning()

      if (!updated) throw new Error('STATUS_SUDAH_BERUBAH')

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'STATUS_SUDAH_BERUBAH') {
        return NextResponse.json(
          { error: 'Status transfer sudah berubah, silakan refresh halaman' },
          { status: 409 }
        )
      }
    }
    console.error('PATCH internal-transfer detail error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui transfer' }, { status: 500 })
  }
}
