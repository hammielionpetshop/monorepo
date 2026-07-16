import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { db, voidRequests, transactions, shifts, eq } from '@/lib/db'
import { performVoidWithinTx, VoidError } from '@/lib/services/void-service'

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
