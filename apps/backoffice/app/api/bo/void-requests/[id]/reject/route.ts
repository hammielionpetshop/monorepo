import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, voidRequests, transactions, auditLogs, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const APPROVER_ROLES = ['OWNER', 'GM']

const rejectSchema = z.object({
  note: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  if (!APPROVER_ROLES.includes(payload.role)) {
    return NextResponse.json({ error: 'Hanya Owner/GM yang dapat menolak void' }, { status: 403 })
  }

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }
  const requestId = parseInt(id, 10)

  const body = await req.json().catch(() => ({}))
  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
      { status: 400 },
    )
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
        })
        .from(transactions)
        .where(eq(transactions.id, request.transactionId))
        .limit(1)

      if (!trx) {
        throw new Error('TRX_NOT_FOUND')
      }

      await tx
        .update(voidRequests)
        .set({ status: 'REJECTED', approvedById: payload.userId, updatedAt: new Date() })
        .where(eq(voidRequests.id, requestId))

      // Pulihkan status transaksi (hanya bila masih menunggu void)
      await tx
        .update(transactions)
        .set({ status: 'COMPLETED', updatedAt: new Date() })
        .where(and(eq(transactions.id, trx.id), eq(transactions.status, 'PENDING_VOID')))

      await tx.insert(auditLogs).values({
        branchId: trx.branchId,
        userId: payload.userId,
        action: 'VOID_REQUEST_REJECTED',
        tableName: 'void_requests',
        recordId: String(request.id),
        newData: JSON.stringify({
          trxNumber: trx.trxNumber,
          requestById: request.requestById,
          note: parsed.data.note ?? null,
        }),
      })

      return { trxNumber: trx.trxNumber }
    })

    return NextResponse.json({ success: true, trxNumber: result.trxNumber, status: 'REJECTED' })
  } catch (error: unknown) {
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
    console.error('[void-requests/reject] POST error:', error)
    return NextResponse.json({ error: 'Gagal menolak pengajuan void' }, { status: 500 })
  }
}
