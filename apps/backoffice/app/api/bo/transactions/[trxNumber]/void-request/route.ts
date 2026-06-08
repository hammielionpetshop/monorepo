import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, transactions, voidRequests, eq, and } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const voidRequestSchema = z.object({
  reason: z.string().min(1, 'Alasan void wajib diisi').max(500, 'Alasan maksimal 500 karakter'),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ trxNumber: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
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

  const parsed = voidRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  const { trxNumber } = await params

  try {
    const result = await db.transaction(async (trx) => {
      const [txn] = await trx
        .select({ id: transactions.id, status: transactions.status, branchId: transactions.branchId })
        .from(transactions)
        .where(eq(transactions.trxNumber, trxNumber))
        .limit(1)

      if (!txn) {
        throw new Error('TRX_NOT_FOUND')
      }

      if (txn.status !== 'COMPLETED') {
        throw new Error('TRX_NOT_COMPLETED')
      }

      const isPrivileged = ['OWNER', 'GM'].includes(payload.role)
      if (!isPrivileged && txn.branchId !== payload.branchId) {
        throw new Error('TRX_BRANCH_MISMATCH')
      }

      const existing = await trx
        .select({ id: voidRequests.id })
        .from(voidRequests)
        .where(and(eq(voidRequests.transactionId, txn.id), eq(voidRequests.status, 'PENDING')))
        .limit(1)

      if (existing.length > 0) {
        throw new Error('VOID_REQUEST_EXISTS')
      }

      const [created] = await trx
        .insert(voidRequests)
        .values({
          transactionId: txn.id,
          requestById: payload.userId,
          reason: parsed.data.reason,
          status: 'PENDING',
        })
        .returning()

      return created
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'TRX_NOT_FOUND') {
        return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'TRX_NOT_COMPLETED') {
        return NextResponse.json({ error: 'Hanya transaksi berstatus COMPLETED yang dapat diajukan void' }, { status: 409 })
      }
      if (error.message === 'TRX_BRANCH_MISMATCH') {
        return NextResponse.json({ error: 'Akses ditolak. Transaksi bukan milik cabang Anda.' }, { status: 403 })
      }
      if (error.message === 'VOID_REQUEST_EXISTS') {
        return NextResponse.json({ error: 'Pengajuan void untuk transaksi ini sudah ada dan sedang menunggu persetujuan' }, { status: 409 })
      }
    }
    console.error('[void-request] POST error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengajukan void' }, { status: 500 })
  }
}
