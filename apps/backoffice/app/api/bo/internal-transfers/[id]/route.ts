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
  unitsOfMeasure,
  customers,
  transactions,
  eq,
  and,
  desc,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { resolveBulkSaleQtyByItem } from '@/lib/services/ibt-bulk-sale-match'
import {
  applyInternalTransferItemEdits,
  InternalTransferEditError,
  REQUESTER_EDITABLE_STATUSES,
  APPROVER_EDITABLE_STATUSES,
} from '@/lib/services/internal-transfer-items-service'

export const dynamic = 'force-dynamic'

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
          storedTransferValue: interBranchTransfers.totalTransferValue,
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
          destinationCustomerDefaultTierType: customers.defaultTierType,
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

    // Riwayat Bulk Sale yang pernah dibuat dari transfer ini lalu di-VOID. Void mereset
    // convertedTransactionId ke NULL (lihat void-service.ts), jadi tanpa query terpisah ini
    // riwayatnya lenyap sama sekali dari layar — padahal justru itu yang perlu dilihat staf
    // sebelum approve ulang (IBT-20260914-0002: bulk sale pertama di-void, lalu dipenuhi
    // manual di POS tanpa tertaut IBT, lalu IBT diproses ulang jadi bulk sale kedua yang
    // sungguhan duplikat).
    const voidedBulkSaleRows = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        payableAmount: transactions.payableAmount,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
      })
      .from(transactions)
      .where(and(eq(transactions.sourceIbtId, transferId), eq(transactions.status, 'VOIDED')))
      .orderBy(desc(transactions.createdAt))

    // Nilai PO dihitung live dari item, bukan dari kolom total_transfer_value yang basi
    // setelah konversi Bulk Sale. Fallback ke kolom lama hanya bila transfer tak punya
    // item sama sekali (data legacy) — lihat lib/ibt-transfer-value.ts.
    const { storedTransferValue, ...transferRow } = transferRows[0]
    const totalTransferValue =
      itemRows.length > 0
        ? itemRows.reduce((sum, i) => sum + i.qtyRequested * i.costPriceAtTransfer, 0)
        : storedTransferValue ?? 0

    const transfer = {
      ...transferRow,
      totalTransferValue,
      voidedBulkSales: voidedBulkSaleRows,
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

    const editableStatusList = isRequesterPhase ? REQUESTER_EDITABLE_STATUSES : APPROVER_EDITABLE_STATUSES

    const result = await applyInternalTransferItemEdits(
      transferId,
      { sourceBranchId: transfer.sourceBranchId, destinationBranchId: transfer.destinationBranchId },
      destinationBranchId,
      submittedItems,
      editableStatusList
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof InternalTransferEditError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PATCH internal-transfer detail error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui transfer' }, { status: 500 })
  }
}
