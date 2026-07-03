import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import * as argon2 from 'argon2'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  interBranchPayables,
  productStocks,
  productStockBatches,
  products,
  productUomConversions,
  ownerAssignments,
  users,
  auditLogs,
  eq,
  and,
  sql,
  inArray,
  asc,
} from '@/lib/db'
import { StockService } from '@/lib/services/stock-service'

export const dynamic = 'force-dynamic'

const actionItemSchema = z.object({
  itemId: z.number().int().positive(),
  qty: z.number().int().min(0),
  notes: z.string().optional(),
})

const statusSchema = z.object({
  action: z.enum(['approve', 'prepare', 'ship', 'receive', 'cancel']),
  items: z.array(actionItemSchema).optional(),
  // PIN Owner cabang pengirim — wajib hanya saat pengiriman dengan stok kurang (bypass)
  ownerPin: z.string().min(4).max(6).optional(),
})

const GLOBAL_ROLES = ['OWNER', 'GM']
const MANAGER_ROLES = ['OWNER', 'GM', 'MANAGER']
const STOCK_ROLES = ['OWNER', 'GM', 'MANAGER', 'GUDANG']
const RECEIVE_ROLES = ['OWNER', 'GM', 'MANAGER', 'GUDANG', 'FINANCE', 'KASIR']

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
  receive:  { from: ['IN_TRANSIT', 'PARTIALLY_RECEIVED'], to: 'FULLY_RECEIVED' },
  cancel:   { from: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'], to: 'CANCELLED' },
}

function canAccessSourceBranch(role: string, userBranchId: number, sourceBranchId: number) {
  return GLOBAL_ROLES.includes(role) || userBranchId === sourceBranchId
}

function canAccessDestinationBranch(role: string, userBranchId: number, destinationBranchId: number) {
  return GLOBAL_ROLES.includes(role) || userBranchId === destinationBranchId
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
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

    // === Authorization per aksi ===
    if (action === 'approve' || action === 'cancel') {
      if (!MANAGER_ROLES.includes(payload.role)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Hanya Manager, GM, dan Owner yang dapat melakukan aksi ini.' },
          { status: 403 }
        )
      }
      if (!canAccessSourceBranch(payload.role, payload.branchId, transfer.sourceBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat memproses transfer dari cabang Anda sendiri.' },
          { status: 403 }
        )
      }
    }

    if (action === 'prepare' || action === 'ship') {
      if (!STOCK_ROLES.includes(payload.role)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Hanya Gudang, Manager, GM, dan Owner yang dapat melakukan aksi ini.' },
          { status: 403 }
        )
      }
      if (!canAccessSourceBranch(payload.role, payload.branchId, transfer.sourceBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat memproses pengiriman dari cabang Anda sendiri.' },
          { status: 403 }
        )
      }
    }

    if (action === 'receive') {
      if (!RECEIVE_ROLES.includes(payload.role)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda tidak memiliki izin untuk menerima transfer.' },
          { status: 403 }
        )
      }
      if (!canAccessDestinationBranch(payload.role, payload.branchId, transfer.destinationBranchId)) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat menerima transfer yang ditujukan ke cabang Anda.' },
          { status: 403 }
        )
      }
    }

    // === Bypass stok kurang saat pengiriman — wajib PIN Owner cabang pengirim ===
    // Jika PIN diberikan & valid, pengiriman boleh melebihi stok sistem (stok jadi minus).
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

    const items = await db
      .select()
      .from(interBranchTransferItems)
      .where(eq(interBranchTransferItems.transferId, transferId))

    // Validasi receive: alasan wajib untuk penerimaan parsial
    if (action === 'receive') {
      const receiveMap = new Map((actionItems ?? []).map((s) => [s.itemId, s]))
      for (const item of items) {
        const input = receiveMap.get(item.id)
        const qty = input?.qty ?? 0
        const remainingQty = item.qtyShipped - item.qtyReceived
        if (qty < 0) {
          return NextResponse.json({ error: 'Qty tidak boleh negatif' }, { status: 400 })
        }
        if (qty > remainingQty) {
          return NextResponse.json(
            { error: `Qty terima item tidak boleh melebihi sisa qty yang belum diterima (${remainingQty})` },
            { status: 400 }
          )
        }
        if (qty < remainingQty && !input?.notes?.trim()) {
          return NextResponse.json(
            { error: 'Alasan wajib diisi untuk setiap item yang qty terimanya kurang dari qty yang dikirim' },
            { status: 400 }
          )
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      // Fail-fast: verifikasi status belum berubah sebelum mulai proses
      const [locked] = await tx
        .select({ id: interBranchTransfers.id })
        .from(interBranchTransfers)
        .where(
          and(
            eq(interBranchTransfers.id, transferId),
            inArray(interBranchTransfers.status, transition.from)
          )
        )
        .limit(1)

      if (!locked) throw new Error('STATUS_SUDAH_BERUBAH')

      if (action === 'ship') {
        const shipMap = new Map((actionItems ?? []).map((s) => [s.itemId, s.qty]))
        let totalShipped = 0
        // Catat item yang dikirim melebihi stok sistem (untuk audit bypass)
        const shortageItems: { productId: number; qtyShipped: number; shortInBase: number }[] = []

        for (const item of items) {
          const qty = shipMap.get(item.id) ?? 0
          if (qty < 0) throw new Error('QTY_NEGATIF')
          if (qty > item.qtyRequested) throw new Error(`QTY_MELEBIHI_REQUEST:${item.id}`)

          await tx
            .update(interBranchTransferItems)
            .set({ qtyShipped: qty })
            .where(eq(interBranchTransferItems.id, item.id))

          if (qty > 0) {
            // Bangun ratio map: uomId → rasio terhadap base UOM (base = 1)
            const [prod] = await tx
              .select({ baseUomId: products.baseUomId })
              .from(products)
              .where(eq(products.id, item.productId))
              .limit(1)

            const ratioMap = new Map<number, number>()
            if (prod?.baseUomId !== undefined) ratioMap.set(prod.baseUomId, 1)

            const convRows = await tx
              .select({ uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
              .from(productUomConversions)
              .where(eq(productUomConversions.productId, item.productId))

            for (const c of convRows) ratioMap.set(c.uomId, c.ratio)

            const transferRatio = ratioMap.get(item.uomId)
            if (transferRatio === undefined) {
              throw Object.assign(
                new Error('UOM_TIDAK_TERDEFINISI'),
                { productId: item.productId, uomId: item.uomId }
              )
            }
            const qtyInBase = qty * transferRatio

            // Ambil semua baris stok produk ini di cabang sumber dengan qty > 0
            const allStocks = await tx
              .select()
              .from(productStocks)
              .where(
                and(
                  eq(productStocks.productId, item.productId),
                  eq(productStocks.branchId, transfer.sourceBranchId),
                  sql`${productStocks.qty} > 0`
                )
              )

            // Cek total ketersediaan dalam base UOM (lintas semua UOM)
            let totalAvailableInBase = 0
            for (const s of allStocks) {
              const sr = ratioMap.get(s.uomId)
              if (sr === undefined) {
                throw Object.assign(
                  new Error('UOM_STOK_TIDAK_TERDEFINISI'),
                  { productId: item.productId, uomId: s.uomId }
                )
              }
              totalAvailableInBase += s.qty * sr
            }

            if (totalAvailableInBase < qtyInBase && !allowShortage) {
              throw Object.assign(new Error('STOK_TIDAK_CUKUP'), { productId: item.productId })
            }

            // Urutan deduction: UOM sama dulu, lalu UOM lain (descending base qty)
            // Semua uomId di allStocks sudah divalidasi ada di ratioMap di loop atas
            const sortedStocks = [...allStocks].sort((a, b) => {
              if (a.uomId === item.uomId) return -1
              if (b.uomId === item.uomId) return 1
              const ra = ratioMap.get(a.uomId)!
              const rb = ratioMap.get(b.uomId)!
              return b.qty * rb - a.qty * ra
            })

            let remainingInBase = qtyInBase
            // Catat expiry date batch pertama yang dideduct (FIFO = tertua)
            // untuk diteruskan ke cabang tujuan saat penerimaan
            let firstExpiryDate: Date | null | undefined = undefined

            for (const stock of sortedStocks) {
              if (remainingInBase <= 0) break

              const stockRatio = ratioMap.get(stock.uomId)!
              const canDeductInBase = Math.min(remainingInBase, stock.qty * stockRatio)
              const deductInStockUom = Math.floor(canDeductInBase / stockRatio)

              if (deductInStockUom <= 0) continue

              const updated = await tx
                .update(productStocks)
                .set({ qty: sql`${productStocks.qty} - ${deductInStockUom}` })
                .where(
                  and(
                    eq(productStocks.id, stock.id),
                    sql`${productStocks.qty} >= ${deductInStockUom}`
                  )
                )
                .returning({ id: productStocks.id })

              if (updated.length === 0) {
                throw Object.assign(new Error('STOK_TIDAK_CUKUP'), { productId: item.productId })
              }

              remainingInBase -= deductInStockUom * stockRatio

              // FIFO deduct dari productStockBatches untuk UOM yang dipakai
              const batches = await tx
                .select()
                .from(productStockBatches)
                .where(
                  and(
                    eq(productStockBatches.productId, item.productId),
                    eq(productStockBatches.branchId, transfer.sourceBranchId),
                    eq(productStockBatches.uomId, stock.uomId),
                    sql`${productStockBatches.qtyRemaining} > 0`
                  )
                )
                .orderBy(asc(productStockBatches.receivedAt))

              let batchRemaining = deductInStockUom
              for (const batch of batches) {
                if (batchRemaining <= 0) break
                // Tangkap expiry dari batch pertama yang benar-benar dideduct
                if (firstExpiryDate === undefined) {
                  firstExpiryDate = batch.expiryDate ?? null
                }
                const deduct = Math.min(batchRemaining, batch.qtyRemaining)
                await tx
                  .update(productStockBatches)
                  .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduct}` })
                  .where(eq(productStockBatches.id, batch.id))
                batchRemaining -= deduct
              }
            }

            // Sisa tidak terpenuhi karena stok kurang / pembulatan floor lintas UOM.
            // Toleransi 1e-9 untuk mencegah false positive dari floating-point residue (misal 1e-15) saat ratio desimal
            if (remainingInBase > 1e-9) {
              if (!allowShortage) {
                throw Object.assign(new Error('STOK_PERLU_PECAH'), { productId: item.productId })
              }

              // Bypass owner: catat kekurangan sebagai stok MINUS di cabang pengirim.
              // product_stocks unik per (product, branch) → maksimal SATU baris per produk,
              // jadi kurangi langsung dari baris itu (boleh minus). Base UOM berasio 1 sehingga
              // sisa base selalu integer dan terekam tepat.
              const shortInBase = Math.round(remainingInBase)

              const [existingStock] = await tx
                .select({ id: productStocks.id })
                .from(productStocks)
                .where(
                  and(
                    eq(productStocks.productId, item.productId),
                    eq(productStocks.branchId, transfer.sourceBranchId)
                  )
                )
                .limit(1)

              if (existingStock) {
                await tx
                  .update(productStocks)
                  .set({ qty: sql`${productStocks.qty} - ${shortInBase}` })
                  .where(eq(productStocks.id, existingStock.id))
              } else {
                await tx.insert(productStocks).values({
                  productId: item.productId,
                  branchId: transfer.sourceBranchId,
                  uomId: prod?.baseUomId ?? item.uomId,
                  qty: -shortInBase,
                })
              }

              shortageItems.push({ productId: item.productId, qtyShipped: qty, shortInBase })
              remainingInBase = 0
            }

            // Simpan expiry date batch asal ke transfer item agar diteruskan saat penerimaan
            if (firstExpiryDate !== undefined) {
              await tx
                .update(interBranchTransferItems)
                .set({ expiryDate: firstExpiryDate instanceof Date ? firstExpiryDate.toISOString() : firstExpiryDate })
                .where(eq(interBranchTransferItems.id, item.id))
            }

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

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
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
