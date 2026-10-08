import { StockConflictError } from '@/lib/services/stock-validation'
import { lockStockPairs } from '@/lib/services/stock-lock'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import * as argon2 from 'argon2'
import { getAuth, hasPermission } from '@/lib/authz'
import type { JWTPayload } from '@petshop/shared'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  interBranchPayables,
  ownerAssignments,
  users,
  auditLogs,
  stockShortfalls,
  shifts,
  transactionPayments,
  paymentMethods,
  eq,
  ne,
  gt,
  and,
  sql,
  inArray,
} from '@/lib/db'
import { StockService, InsufficientStockError } from '@/lib/services/stock-service'
import { syncCostFromInbound } from '@/lib/services/cost-sync-service'
import { resolveBulkSaleQtyByItem, allocateIbtShortage, loadSaleLinesForRetur, loadUomRatios, type IbtShortage } from '@/lib/services/ibt-bulk-sale-match'
import { ReturService } from '@/lib/services/retur-service'
import {
  assertVoidable,
  performVoidWithinTx,
  VoidError,
  IBT_RESETTABLE_STATUSES,
} from '@/lib/services/void-service'

export const dynamic = 'force-dynamic'

const actionItemSchema = z.object({
  itemId: z.number().int().positive(),
  qty: z.number().int().min(0),
  notes: z.string().optional(),
})

const statusSchema = z.object({
  action: z.enum(['approve', 'prepare', 'ship', 'receive', 'cancel', 'reprocess']),
  items: z.array(actionItemSchema).optional(),
  // PIN Owner cabang pengirim — wajib hanya saat pengiriman dengan stok kurang (bypass)
  ownerPin: z.string().min(4).max(6).optional(),
  reason: z.string().trim().max(500).optional(),
})

type TransferStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PREPARING'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CANCELLED'

const VALID_TRANSITIONS: Record<
  string,
  { from: TransferStatus[]; to: TransferStatus }
> = {
  approve:  { from: ['DRAFT', 'PENDING_APPROVAL'], to: 'APPROVED' },
  prepare:  { from: ['APPROVED'],                  to: 'PREPARING' },
  ship:     { from: ['PREPARING'],                 to: 'IN_TRANSIT' },
  // Sekali-jalan: hasil receive (penuh atau sebagian) langsung final. PARTIALLY_RECEIVED
  // sengaja TIDAK dimasukkan di sini — begitu status jadi itu, tidak ada lagi receive susulan.
  // Sisa qtyShipped - qtyReceived yang tidak diterima dikembalikan ke stok pengirim (kanban #56).
  receive:  { from: ['IN_TRANSIT'], to: 'FULLY_RECEIVED' },
  // PREPARING masih boleh batal: "Mulai Persiapan" cuma ganti status, stok belum keluar.
  cancel:   { from: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PREPARING'], to: 'CANCELLED' },
  // Khusus IBT terkonversi Bulk Sale: void notanya lalu kembalikan ke Menunggu Persetujuan
  // supaya bisa diproses ulang dengan isi yang benar (kanban #42).
  reprocess: { from: ['APPROVED', 'PREPARING'], to: 'PENDING_APPROVAL' },
}

function canAccessBranch(payload: JWTPayload, targetBranchId: number) {
  return payload.branchScope === 'ALL' || payload.branchId === targetBranchId
}

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

    const parsed = statusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const { action, items: actionItems } = parsed.data

    if (action === 'ship' && (!actionItems || actionItems.length === 0)) {
      return NextResponse.json(
        { error: 'Data qty pengiriman per item wajib diisi untuk aksi pengiriman' },
        { status: 400 }
      )
    }

    if (action === 'receive' && (!actionItems || actionItems.length === 0)) {
      return NextResponse.json(
        { error: 'Data qty penerimaan per item wajib diisi untuk aksi penerimaan' },
        { status: 400 }
      )
    }

    const reason = parsed.data.reason ?? ''
    if ((action === 'cancel' || action === 'reprocess') && reason.length < 3) {
      return NextResponse.json({ error: 'Alasan pembatalan wajib diisi' }, { status: 400 })
    }

    const transition = VALID_TRANSITIONS[action]

    const [transfer] = await db
      .select()
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, transferId))
      .limit(1)

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    }

    if (!transition.from.includes(transfer.status as TransferStatus)) {
      return NextResponse.json(
        { error: `Aksi '${action}' tidak valid untuk status transfer saat ini (${transfer.status})` },
        { status: 409 }
      )
    }

    if (action === 'reprocess' && transfer.convertedTransactionId == null) {
      return NextResponse.json(
        { error: 'Transfer ini belum diproses jadi transaksi, tidak ada yang perlu diproses ulang' },
        { status: 409 }
      )
    }

    // Sudah dijual via Bulk Sale: batal/proses ulang wajib ikut me-void notanya (stok kembali,
    // piutang dibatalkan) — mengubah status IBT saja meninggalkan sales & piutang menggantung.
    // Void penjualan setara `void.approve`, jadi gate-nya lebih ketat dari cancel IBT biasa.
    if ((action === 'cancel' || action === 'reprocess') && transfer.convertedTransactionId != null) {
      if (!hasPermission(payload, 'void.approve')) {
        return NextResponse.json(
          { error: 'Transfer ini sudah jadi transaksi. Hanya Owner/GM yang dapat membatalkannya.' },
          { status: 403 }
        )
      }
      if (!canAccessBranch(payload, transfer.sourceBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat memproses transfer dari cabang Anda sendiri.' },
          { status: 403 }
        )
      }
      return cancelConvertedTransfer({
        transferId,
        convertedTransactionId: transfer.convertedTransactionId,
        action,
        reason,
        actorUserId: payload.userId,
      })
    }

    // === Authorization per aksi ===
    // Tiap transisi state punya permission & sumbu cabang sendiri (lihat RBAC R6 M6).
    if (action === 'approve' || action === 'cancel' || action === 'reprocess') {
      if (!hasPermission(payload, 'internal_transfer.approve')) {
        return NextResponse.json(
          { error: 'Akses ditolak. Hanya Manager, GM, dan Owner yang dapat melakukan aksi ini.' },
          { status: 403 }
        )
      }
      if (!canAccessBranch(payload, transfer.sourceBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat memproses transfer dari cabang Anda sendiri.' },
          { status: 403 }
        )
      }
    }

    if (action === 'prepare' || action === 'ship') {
      if (!hasPermission(payload, 'internal_transfer.stock_check')) {
        return NextResponse.json(
          { error: 'Akses ditolak. Hanya Gudang, Manager, GM, dan Owner yang dapat melakukan aksi ini.' },
          { status: 403 }
        )
      }
      if (!canAccessBranch(payload, transfer.sourceBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat memproses pengiriman dari cabang Anda sendiri.' },
          { status: 403 }
        )
      }
    }

    if (action === 'receive') {
      if (!hasPermission(payload, 'internal_transfer.receive')) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda tidak memiliki izin untuk menerima transfer.' },
          { status: 403 }
        )
      }
      if (!canAccessBranch(payload, transfer.destinationBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat menerima transfer yang ditujukan ke cabang Anda.' },
          { status: 403 }
        )
      }
    }

    // === Bypass stok kurang saat pengiriman — wajib PIN Owner cabang pengirim ===
    // Jika PIN diberikan & valid, pengiriman boleh melebihi stok sistem. Kekurangannya
    // dicatat sebagai defisit transfer dan audit; saldo mengikuti pengurangan penuh.
    let allowShortage = false
    if (action === 'ship' && parsed.data.ownerPin) {
      const [ownerAssignment] = await db
        .select({ userId: ownerAssignments.userId })
        .from(ownerAssignments)
        .where(and(eq(ownerAssignments.branchId, transfer.sourceBranchId), eq(ownerAssignments.isActive, true)))
        .limit(1)

      if (!ownerAssignment) {
        return NextResponse.json({ error: 'Owner tidak dikonfigurasi untuk cabang pengirim' }, { status: 404 })
      }

      const [owner] = await db
        .select({ pinHash: users.pinHash })
        .from(users)
        .where(eq(users.id, ownerAssignment.userId))
        .limit(1)

      if (!owner?.pinHash) {
        return NextResponse.json({ error: 'PIN Owner belum dikonfigurasi. Hubungi Administrator.' }, { status: 404 })
      }

      const isValidPin = await argon2.verify(owner.pinHash, parsed.data.ownerPin)
      if (!isValidPin) {
        // Jeda 1 detik untuk mitigasi brute force
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return NextResponse.json({ error: 'PIN Owner tidak valid. Pastikan PIN yang dimasukkan benar.' }, { status: 400 })
      }

      allowShortage = true
    }

    const result = await db.transaction(async (tx) => {
      // Fail-fast: verifikasi status belum berubah sebelum mulai proses
      const [locked] = await tx
        .select()
        .from(interBranchTransfers)
        .where(
          and(
            eq(interBranchTransfers.id, transferId),
            inArray(interBranchTransfers.status, transition.from)
          )
        )
        .for('update').limit(1)

      if (!locked) throw new Error('STATUS_SUDAH_BERUBAH')
      const transfer = locked
      const items = await tx.select().from(interBranchTransferItems).where(eq(interBranchTransferItems.transferId, transferId))
      const bulkSaleQtyByItem = action === 'ship' && transfer.convertedTransactionId != null
        ? await resolveBulkSaleQtyByItem(tx, transfer.convertedTransactionId, items) : null
      if (action === 'receive') {
        const receiveMap = new Map((actionItems ?? []).map(input => [input.itemId, input]))
        for (const item of items) {
          const input = receiveMap.get(item.id)
          const qty = input?.qty ?? 0
          const remaining = item.qtyShipped - item.qtyReceived
          if (qty > remaining) throw new StockConflictError('Qty terima melebihi sisa yang dikirim')
          if (qty < remaining && !input?.notes?.trim()) throw new StockConflictError('Alasan penerimaan parsial wajib diisi')
        }
      }

      await lockStockPairs(tx, items.flatMap(item => [
        { branchId: transfer.sourceBranchId, productId: item.productId },
        { branchId: transfer.destinationBranchId, productId: item.productId },
      ]))
      if (action === 'ship') {
        const shipMap = new Map((actionItems ?? []).map((s) => [s.itemId, s.qty]))
        let totalShipped = 0
        // Catat item yang dikirim melebihi stok sistem (untuk audit bypass)
        const shortageItems: { productId: number; qtyShipped: number; shortInBase: number }[] = []

        for (const item of items) {
          // IBT terkonversi Bulk Sale: qty kirim dikunci ke qty yang benar-benar terjual
          // (bulkSaleQtyByItem), bukan input client — item yang diminta tapi tak ikut terjual
          // (stok kosong) otomatis 0, tidak pernah salah tercatat "terkirim".
          const qty = bulkSaleQtyByItem
            ? (bulkSaleQtyByItem.get(item.id) ?? 0)
            : (shipMap.get(item.id) ?? 0)
          if (qty < 0) throw new Error('QTY_NEGATIF')
          // Batas qtyRequested hanya relevan untuk input manual — qty dari bulkSaleQtyByItem
          // adalah kebenaran transaksi (kasir bisa menjual lebih dari yang direquest), jadi
          // tidak dibatasi ke qtyRequested lagi.
          if (!bulkSaleQtyByItem && qty > item.qtyRequested) throw new Error(`QTY_MELEBIHI_REQUEST:${item.id}`)

          await tx
            .update(interBranchTransferItems)
            .set({ qtyShipped: qty })
            .where(eq(interBranchTransferItems.id, item.id))

          if (qty > 0) {
            // G5 — mitigasi dobel-potong stok (R1): IBT yang sudah dijual via bulk sale
            // (converted_transaction_id terisi) stok cabang pengirimnya SUDAH dipotong saat
            // transaksi bulk sale (FIFO). Pengiriman hanya menandai barang keluar; jangan
            // potong stok gudang lagi di sini. Cabang tujuan tetap dapat stok saat 'receive'.
            if (transfer.convertedTransactionId != null) {
              totalShipped += qty
              continue
            }

            const deduction = await StockService.deductStock(tx, transfer.sourceBranchId, item.productId, item.uomId, qty, allowShortage)
            if (deduction.shortfallQty > 0) {
              await tx.insert(stockShortfalls).values({ productId: item.productId, branchId: transfer.sourceBranchId,
                qtyShort: deduction.shortfallQty, qtyRemaining: deduction.shortfallQty,
                costPricePerUnit: deduction.shortfallCostPricePerUnit ?? 0,
                sourceType: 'TRANSFER', sourceTransferId: transferId, sourceTransferItemId: item.id,
              })
              shortageItems.push({ productId: item.productId, qtyShipped: qty, shortInBase: deduction.shortfallQty })
            }
            const expiry = deduction.firstExpiryDate
            await tx.update(interBranchTransferItems).set({ expiryDate: expiry ? new Date(expiry).toISOString().slice(0, 10) : null })
              .where(eq(interBranchTransferItems.id, item.id))

            totalShipped += qty
          }
        }

        if (totalShipped === 0) throw new Error('SEMUA_QTY_NOL')

        // Audit bypass: rekam pengiriman yang melebihi stok sistem (diotorisasi PIN Owner)
        if (allowShortage && shortageItems.length > 0) {
          await tx.insert(auditLogs).values({
            branchId: transfer.sourceBranchId,
            userId: payload.userId,
            action: 'INTERNAL_TRANSFER_SHIP_STOCK_BYPASS',
            tableName: 'inter_branch_transfers',
            recordId: String(transferId),
            newData: JSON.stringify({ ibtNumber: transfer.ibtNumber, items: shortageItems }),
          })
        }
      }

      let finalReceiveStatus: TransferStatus = 'FULLY_RECEIVED'

      if (action === 'receive') {
        const receiveMap = new Map((actionItems ?? []).map((s) => [s.itemId, s]))
        let totalReceived = 0
        let payableTotal = 0
        let allFull = true
        const shortages: (IbtShortage & { expiryDate: string | null })[] = []

        const [existingPayable] = await tx
          .select()
          .from(interBranchPayables)
          .where(eq(interBranchPayables.transferId, transferId))
          .limit(1)

        for (const item of items) {
          const input = receiveMap.get(item.id)
          const qty = input?.qty ?? 0
          const remainingQty = item.qtyShipped - item.qtyReceived
          if (qty > remainingQty) throw new Error('QTY_MELEBIHI_SISA_KIRIM')
          if (item.qtyReceived + qty < item.qtyShipped) allFull = false
          if (remainingQty - qty > 0) {
            shortages.push({ productId: item.productId, uomId: item.uomId, qty: remainingQty - qty, expiryDate: item.expiryDate as string | null })
          }

          if (qty > 0) {
            const [receivedItem] = await tx
              .update(interBranchTransferItems)
              .set({
                qtyReceived: sql`${interBranchTransferItems.qtyReceived} + ${qty}`,
                receiveNotes: input?.notes ?? item.receiveNotes ?? null,
              })
              .where(
                and(
                  eq(interBranchTransferItems.id, item.id),
                  sql`${interBranchTransferItems.qtyReceived} + ${qty} <= ${interBranchTransferItems.qtyShipped}`
                )
              )
              .returning({ id: interBranchTransferItems.id })

            if (!receivedItem) throw new Error('QTY_MELEBIHI_SISA_KIRIM')

            // Tambah stok di cabang tujuan — teruskan expiry date dari batch asal
            const expiryForBatch = item.expiryDate
              ? new Date(item.expiryDate as string)
              : null
            await StockService.addStock(
              tx,
              transfer.destinationBranchId,
              item.productId,
              item.uomId,
              qty.toString(),
              item.costPriceAtTransfer.toString(),
              undefined,
              expiryForBatch,
            )

            // Hanya IBT hasil Bulk Sale: costPriceAtTransfer-nya harga jual per satuan item. IBT
            // manual masih membawa estimasi modal per satuan DASAR peminta walau satuannya SAK.
            if (transfer.convertedTransactionId != null) {
              await syncCostFromInbound(tx, {
                branchId: transfer.destinationBranchId,
                productId: item.productId,
                uomId: item.uomId,
                unitCost: Number(item.costPriceAtTransfer),
                sourceType: 'IBT_RECEIVE',
                sourceId: transfer.id,
                sourceRef: transfer.ibtNumber,
                actorUserId: payload.userId,
              })
            }
          } else if (input?.notes || item.receiveNotes) {
            await tx
              .update(interBranchTransferItems)
              .set({ receiveNotes: input?.notes ?? item.receiveNotes })
              .where(eq(interBranchTransferItems.id, item.id))
          }

          payableTotal += qty * item.costPriceAtTransfer
          totalReceived += qty
        }

        if (totalReceived === 0) throw new Error('SEMUA_QTY_NOL_RECEIVE')

        finalReceiveStatus = allFull ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'

        if (payableTotal > 0 && existingPayable) {
          const newTotal = existingPayable.totalAmount + payableTotal
          const newStatus = existingPayable.paidAmount >= newTotal ? 'PAID' : existingPayable.paidAmount > 0 ? 'PARTIAL' : 'UNPAID'

          await tx
            .update(interBranchPayables)
            .set({
              totalAmount: sql`${interBranchPayables.totalAmount} + ${payableTotal}`,
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(interBranchPayables.id, existingPayable.id))
        } else if (payableTotal > 0) {
          await tx.insert(interBranchPayables).values({
            transferId,
            debtorBranchId: transfer.destinationBranchId,
            creditorBranchId: transfer.sourceBranchId,
            totalAmount: payableTotal,
            paidAmount: 0,
            status: 'UNPAID',
          })
        }

        // Selisih kirim − terima balik ke stok pengirim (kanban #56): barangnya tidak pernah
        // sampai, jadi tetap milik pengirim. Hutang di atas sudah dihitung dari qty terima.
        if (shortages.length > 0) {
          if (transfer.convertedTransactionId != null) {
            // Stok pengirim sudah terpotong lewat nota Bulk Sale — kembalikan lewat retur nota itu
            // supaya penjualan pengirim = hutang penerima dan HPP-nya ikut balik (batch modal asli).
            const saleLines = await loadSaleLinesForRetur(tx, transfer.convertedTransactionId)
            const { ratioMap } = await loadUomRatios(tx, [...new Set([...shortages.map(s => s.productId), ...saleLines.map(l => l.productId)])])
            const returItems = allocateIbtShortage(shortages, saleLines, ratioMap)
            if (!returItems) {
              throw new StockConflictError(
                'Selisih terima tidak bisa dikembalikan otomatis ke nota Bulk Sale (satuan nota berbeda dari satuan transfer). Hubungi Owner/GM.'
              )
            }
            if (returItems.length > 0) {
              await ReturService.applyReturInTx(tx, {
                transactionId: transfer.convertedTransactionId,
                branchId: transfer.sourceBranchId,
                processedById: payload.userId,
                reason: `Selisih terima ${transfer.ibtNumber}`,
                items: returItems.map(r => ({ transactionItemId: r.transactionItemId, qty: String(r.qty) })),
              })
            }
          } else {
            for (const s of shortages) {
              await StockService.addStock(
                tx,
                transfer.sourceBranchId,
                s.productId,
                s.uomId,
                String(s.qty),
                '0',
                undefined,
                s.expiryDate ? new Date(s.expiryDate) : null,
                { useDefaultUomCost: true, estimateCostWhenZero: true },
              )
            }
          }
        }
      }

      // Single UPDATE untuk semua action — sekaligus optimistic lock terakhir
      const finalSet: {
        status: TransferStatus
        updatedAt: Date
        approvedById?: number
        receivedById?: number
        receivedAt?: Date
      } = {
        status: action === 'receive' ? finalReceiveStatus : transition.to,
        updatedAt: new Date(),
        ...(action === 'approve' ? { approvedById: payload.userId } : {}),
        ...(action === 'receive' ? { receivedById: payload.userId, receivedAt: new Date() } : {}),
      }

      const [updated] = await tx
        .update(interBranchTransfers)
        .set(finalSet)
        .where(
          and(
            eq(interBranchTransfers.id, transferId),
            inArray(interBranchTransfers.status, transition.from)
          )
        )
        .returning()

      if (!updated) throw new Error('STATUS_SUDAH_BERUBAH')

      if (action === 'cancel') {
        await tx.insert(auditLogs).values({
          branchId: transfer.sourceBranchId,
          userId: payload.userId,
          action: 'IBT_CANCELLED',
          tableName: 'inter_branch_transfers',
          recordId: String(transferId),
          newData: JSON.stringify({ ibtNumber: transfer.ibtNumber, fromStatus: transfer.status, reason }),
        })
      }

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof InsufficientStockError) return NextResponse.json({ error: 'Stok tidak mencukupi untuk pengiriman' }, { status: 409 })
    if (error instanceof StockConflictError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof Error) {
      if (error.message === 'QTY_NEGATIF') {
        return NextResponse.json({ error: 'Qty tidak boleh negatif' }, { status: 400 })
      }
      if (error.message.startsWith('QTY_MELEBIHI_REQUEST')) {
        return NextResponse.json(
          { error: 'Qty kirim tidak boleh melebihi qty yang diminta' },
          { status: 400 }
        )
      }
      if (error.message === 'UOM_TIDAK_TERDEFINISI') {
        return NextResponse.json(
          { error: 'Satuan ukur transfer belum terdefinisi dalam konversi satuan produk ini. Pastikan konversi UOM sudah diatur di master data produk.' },
          { status: 409 }
        )
      }
      if (error.message === 'UOM_STOK_TIDAK_TERDEFINISI') {
        return NextResponse.json(
          { error: 'Stok produk ini tersimpan dalam satuan ukur yang tidak terdefinisi di konversi satuan. Hubungi administrator untuk memperbaiki data stok.' },
          { status: 409 }
        )
      }
      if (error.message === 'STOK_TIDAK_CUKUP') {
        return NextResponse.json(
          { error: 'Stok tidak mencukupi untuk salah satu item yang akan dikirim' },
          { status: 409 }
        )
      }
      if (error.message === 'STOK_PERLU_PECAH') {
        const pid = (error as Error & { productId?: number }).productId
        const prodHint = pid ? ` (produk #${pid})` : ''
        return NextResponse.json(
          { error: `Stok${prodHint} tersedia dalam satuan yang tidak habis dibagi dengan satuan transfer. Kurangi qty pengiriman agar sesuai kelipatan satuan yang tersedia, atau pecah stok ke satuan lebih kecil terlebih dahulu di menu Stock Adjustment.` },
          { status: 409 }
        )
      }
      if (error.message === 'SEMUA_QTY_NOL') {
        return NextResponse.json(
          { error: 'Minimal satu item harus memiliki qty kirim lebih dari 0' },
          { status: 400 }
        )
      }
      if (error.message === 'SEMUA_QTY_NOL_RECEIVE') {
        return NextResponse.json(
          { error: 'Minimal satu item harus memiliki qty terima lebih dari 0' },
          { status: 400 }
        )
      }
      if (error.message === 'QTY_MELEBIHI_KIRIM') {
        return NextResponse.json(
          { error: 'Qty terima tidak boleh melebihi qty yang dikirim' },
          { status: 400 }
        )
      }
      if (error.message === 'QTY_MELEBIHI_SISA_KIRIM') {
        return NextResponse.json(
          { error: 'Qty terima tidak boleh melebihi sisa qty yang belum diterima' },
          { status: 400 }
        )
      }
      if (error.message === 'STATUS_SUDAH_BERUBAH') {
        return NextResponse.json(
          { error: 'Status transfer sudah berubah, silakan refresh halaman' },
          { status: 409 }
        )
      }
      if (error.message === 'PAYABLE_SUDAH_ADA') {
        return NextResponse.json(
          { error: 'Transfer ini sudah memiliki catatan payable, tidak dapat diproses ulang' },
          { status: 409 }
        )
      }
      // Tangani unique violation payable (race condition)
      if ('code' in error && (error as NodeJS.ErrnoException).code === '23505') {
        return NextResponse.json(
          { error: 'Transfer ini sudah memiliki catatan penerimaan, silakan refresh halaman' },
          { status: 409 }
        )
      }
    }
    console.error('PATCH internal-transfer status error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui status transfer' }, { status: 500 })
  }
}

async function cancelConvertedTransfer(params: {
  transferId: number
  convertedTransactionId: number
  action: 'cancel' | 'reprocess'
  reason: string
  actorUserId: number
}) {
  const { transferId, convertedTransactionId, action, reason, actorUserId } = params
  const voidableStatuses = ['COMPLETED', 'PENDING_VOID']
  try {
    const trx = await assertVoidable(convertedTransactionId, { fromStatuses: voidableStatuses })

    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: interBranchTransfers.id, ibtNumber: interBranchTransfers.ibtNumber, status: interBranchTransfers.status })
        .from(interBranchTransfers)
        .where(
          and(
            eq(interBranchTransfers.id, transferId),
            eq(interBranchTransfers.convertedTransactionId, convertedTransactionId),
            inArray(interBranchTransfers.status, IBT_RESETTABLE_STATUSES)
          )
        )
        .for('update').limit(1)
      if (!locked) throw new Error('STATUS_SUDAH_BERUBAH')

      // Uang tunai/transfer dari nota ini sudah masuk rekap shift yang ditutup & disetor —
      // void sekarang membuat rekap itu berubah setelah setoran. Nota hutang tidak terdampak.
      if (trx.shiftId != null) {
        const [shift] = await tx
          .select({ status: shifts.status })
          .from(shifts)
          .where(eq(shifts.id, trx.shiftId))
          .limit(1)
        if (shift && shift.status !== 'OPEN') {
          const [nonDebtPayment] = await tx
            .select({ id: transactionPayments.id })
            .from(transactionPayments)
            .innerJoin(paymentMethods, eq(paymentMethods.id, transactionPayments.paymentMethodId))
            .where(
              and(
                eq(transactionPayments.transactionId, trx.id),
                ne(paymentMethods.type, 'DEBT'),
                gt(transactionPayments.amount, 0)
              )
            )
            .limit(1)
          if (nonDebtPayment) throw new Error('SHIFT_SUDAH_DITUTUP')
        }
      }

      // Void mengembalikan stok, membatalkan piutang, dan mereset IBT ke PENDING_APPROVAL.
      await performVoidWithinTx(tx, {
        txId: trx.id,
        branchId: trx.branchId,
        trxNumber: trx.trxNumber,
        actorUserId,
        fromStatuses: voidableStatuses,
        // Sengaja tetap VOID_TRANSACTION: Mutasi Stok mengambil jam & pelaku void dari aksi ini.
        auditNewData: { ibtNumber: locked.ibtNumber, ibtAction: action, reason },
      })

      const [updated] = await tx
        .update(interBranchTransfers)
        .set({ status: action === 'cancel' ? 'CANCELLED' : 'PENDING_APPROVAL', updatedAt: new Date() })
        .where(eq(interBranchTransfers.id, transferId))
        .returning()

      await tx.insert(auditLogs).values({
        branchId: trx.branchId,
        userId: actorUserId,
        action: action === 'cancel' ? 'IBT_CANCELLED' : 'IBT_REPROCESS',
        tableName: 'inter_branch_transfers',
        recordId: String(transferId),
        newData: JSON.stringify({
          ibtNumber: locked.ibtNumber,
          fromStatus: locked.status,
          voidedTrxNumber: trx.trxNumber,
          reason,
        }),
      })

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof VoidError) {
      return NextResponse.json({ error: error.message }, { status: error.code === 'TRX_NOT_FOUND' ? 404 : 409 })
    }
    if (error instanceof StockConflictError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof Error && error.message === 'STATUS_SUDAH_BERUBAH') {
      return NextResponse.json({ error: 'Status transfer sudah berubah, silakan refresh halaman' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'SHIFT_SUDAH_DITUTUP') {
      return NextResponse.json(
        {
          error:
            'Nota transfer ini dibayar tunai/non-hutang dan shift kasirnya sudah ditutup. Membatalkannya akan mengubah rekap setoran shift tersebut — koreksi lewat Finance.',
        },
        { status: 409 }
      )
    }
    console.error('PATCH internal-transfer cancel/reprocess (terkonversi) error:', error)
    return NextResponse.json({ error: 'Gagal membatalkan transfer' }, { status: 500 })
  }
}
