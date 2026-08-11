import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { db, voidRequests, transactions, shifts, eq, and } from '@/lib/db'
import { performVoidWithinTx, VoidError } from '@/lib/services/void-service'
import {
  TransactionEditService,
  TransactionEditError,
} from '@/lib/services/transaction-edit-service'
import { transactionEditPayloadSchema } from '@/lib/transaction-edit-schema'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate
  const payload = gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }
  const requestId = parseInt(id, 10)

  // Baca jenisnya dulu: koreksi ditangani jalur tersendiri karena
  // `TransactionEditService.editTransaction` membuka transaksi DB-nya sendiri dan tidak bisa
  // ditumpuk di dalam transaksi milik route ini.
  const [head] = await db
    .select({ kind: voidRequests.kind })
    .from(voidRequests)
    .where(eq(voidRequests.id, requestId))
    .limit(1)

  if (!head) {
    return NextResponse.json({ error: 'Permintaan tidak ditemukan' }, { status: 404 })
  }

  if (head.kind === 'KOREKSI') {
    return await approveKoreksi(requestId, payload.userId)
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Kunci baris pengajuan agar approve/reject tidak balapan
      const [request] = await tx
        .select({
          id: voidRequests.id,
          transactionId: voidRequests.transactionId,
          requestById: voidRequests.requestById,
          status: voidRequests.status,
        })
        .from(voidRequests)
        .where(eq(voidRequests.id, requestId))
        .for('update')
        .limit(1)

      if (!request) {
        throw new Error('REQUEST_NOT_FOUND')
      }
      if (request.status !== 'PENDING') {
        throw new Error('REQUEST_ALREADY_RESOLVED')
      }

      const [trx] = await tx
        .select({
          id: transactions.id,
          trxNumber: transactions.trxNumber,
          branchId: transactions.branchId,
          shiftId: transactions.shiftId,
        })
        .from(transactions)
        .where(eq(transactions.id, request.transactionId))
        .limit(1)

      if (!trx) {
        throw new Error('TRX_NOT_FOUND')
      }

      // Deteksi shift sudah settle — void tetap jalan, tapi kas settlement
      // adalah snapshot historis sehingga refund harus dicatat manual
      let shiftSettled = false
      if (trx.shiftId != null) {
        const [shift] = await tx
          .select({ status: shifts.status })
          .from(shifts)
          .where(eq(shifts.id, trx.shiftId))
          .limit(1)
        shiftSettled = !shift || shift.status !== 'OPEN'
      } else {
        shiftSettled = true
      }

      // COMPLETED ikut diterima untuk pengajuan lama yang dibuat
      // sebelum status PENDING_VOID mulai di-set saat pengajuan
      await performVoidWithinTx(tx, {
        txId: trx.id,
        branchId: trx.branchId,
        trxNumber: trx.trxNumber,
        actorUserId: payload.userId,
        auditAction: 'VOID_REQUEST_APPROVED',
        auditNewData: { voidRequestId: request.id, requestById: request.requestById },
        fromStatuses: ['PENDING_VOID', 'COMPLETED'],
      })

      await tx
        .update(voidRequests)
        .set({ status: 'APPROVED', approvedById: payload.userId, updatedAt: new Date() })
        .where(eq(voidRequests.id, requestId))

      return { trxNumber: trx.trxNumber, shiftSettled }
    })

    return NextResponse.json({
      success: true,
      trxNumber: result.trxNumber,
      status: 'VOIDED',
      shiftSettled: result.shiftSettled,
      warning: result.shiftSettled
        ? 'Shift transaksi ini sudah di-settle. Pengembalian uang ke pelanggan tidak tercatat otomatis — catat pengeluarannya secara manual di Keuangan → Pendapatan & Pengeluaran.'
        : null,
    })
  } catch (error: unknown) {
    if (error instanceof VoidError) {
      const status = error.code === 'TRX_NOT_FOUND' ? 404 : 409
      return NextResponse.json({ error: error.message }, { status })
    }
    if (error instanceof Error) {
      if (error.message === 'REQUEST_NOT_FOUND') {
        return NextResponse.json({ error: 'Pengajuan void tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'REQUEST_ALREADY_RESOLVED') {
        return NextResponse.json({ error: 'Pengajuan void sudah diproses sebelumnya' }, { status: 409 })
      }
      if (error.message === 'TRX_NOT_FOUND') {
        return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
      }
    }
    console.error('[void-requests/approve] POST error:', error)
    return NextResponse.json({ error: 'Gagal menyetujui pengajuan void' }, { status: 500 })
  }
}

/**
 * Setujui permintaan KOREKSI: terapkan muatan yang disimpan saat pengajuan.
 *
 * Urutannya klaim → terapkan → (kalau gagal) kembalikan klaim, bukan satu transaksi utuh,
 * karena `editTransaction` membuka transaksi DB sendiri.
 *
 * Klaim dilakukan lewat satu UPDATE bersyarat `status = 'PENDING'`. Itu yang membuat dua
 * penyetuju yang menekan tombol bersamaan tidak bisa dua-duanya menang — tanpa itu, koreksi
 * yang sama bisa diterapkan dua kali dan stok terpotong dobel.
 */
async function approveKoreksi(requestId: number, approverUserId: number) {
  const [claimed] = await db
    .update(voidRequests)
    .set({ status: 'APPROVED', approvedById: approverUserId, updatedAt: new Date() })
    .where(and(eq(voidRequests.id, requestId), eq(voidRequests.status, 'PENDING')))
    .returning({
      id: voidRequests.id,
      transactionId: voidRequests.transactionId,
      requestById: voidRequests.requestById,
      reason: voidRequests.reason,
      payload: voidRequests.payload,
    })

  if (!claimed) {
    return NextResponse.json(
      { error: 'Permintaan sudah diproses sebelumnya' },
      { status: 409 },
    )
  }

  // Kembalikan ke PENDING kalau penerapannya gagal — kalau tidak, permintaannya tercatat
  // disetujui padahal notanya tidak berubah sama sekali, dan tak seorang pun akan tahu.
  const releaseClaim = async () => {
    await db
      .update(voidRequests)
      .set({ status: 'PENDING', approvedById: null, updatedAt: new Date() })
      .where(eq(voidRequests.id, requestId))
  }

  try {
    // Validasi ULANG muatannya. Ia disimpan saat pengajuan dan bisa sudah basi: produk
    // dihapus, satuan diubah, atau bentuk datanya berbeda karena versi lama. Menerapkan
    // muatan yang tidak lolos schema berarti menyetujui sesuatu yang tak seorang pun lihat.
    const parsed = transactionEditPayloadSchema.safeParse(claimed.payload)
    if (!parsed.success) {
      await releaseClaim()
      return NextResponse.json(
        {
          error: `Data koreksi yang diajukan sudah tidak valid (${parsed.error.issues[0]?.message ?? 'bentuk data berubah'}). Minta kasir mengajukan ulang.`,
        },
        { status: 409 },
      )
    }

    const [trx] = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        branchId: transactions.branchId,
        status: transactions.status,
      })
      .from(transactions)
      .where(eq(transactions.id, claimed.transactionId))
      .limit(1)

    if (!trx) {
      await releaseClaim()
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    // Notanya bisa saja sudah di-void atau dikoreksi lewat PIN sejak pengajuan dibuat.
    if (trx.status !== 'COMPLETED') {
      await releaseClaim()
      return NextResponse.json(
        { error: 'Transaksi sudah dibatalkan atau tidak lagi dapat dikoreksi' },
        { status: 409 },
      )
    }

    const result = await TransactionEditService.editTransaction({
      txId: trx.id,
      branchId: trx.branchId,
      actorUserId: claimed.requestById,
      approvedById: approverUserId,
      reason: claimed.reason,
      items: parsed.data.items,
      payments: parsed.data.payments,
      customerId: parsed.data.customerId ?? null,
      dueAt: parsed.data.dueAt ?? null,
    })

    return NextResponse.json({
      success: true,
      trxNumber: trx.trxNumber,
      status: 'CORRECTED',
      result,
    })
  } catch (error: unknown) {
    await releaseClaim()

    if (error instanceof TransactionEditError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[void-requests/approve] KOREKSI error:', error)
    return NextResponse.json({ error: 'Gagal menerapkan koreksi' }, { status: 500 })
  }
}
