import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { db, transactions, voidRequests, eq, and } from '@/lib/db'
import { transactionEditPayloadSchema, editReasonSchema } from '@/lib/transaction-edit-schema'

export const dynamic = 'force-dynamic'

/**
 * Ajukan void atau koreksi untuk disetujui belakangan.
 *
 * Jalur kedua di samping PIN inline yang sudah ada. PIN mensyaratkan orang yang berwenang
 * hadir di mesin kasir; kalau ia sedang tidak di toko, kasir dulu tidak punya pilihan selain
 * membiarkan notanya salah — atau meminjam PIN lewat telepon, yang membuat jejak audit
 * mencatat persetujuan dari orang yang tidak ada di sana.
 *
 * Muatan koreksi disimpan apa adanya dan divalidasi ULANG saat disetujui: di antara pengajuan
 * dan persetujuan, harga, stok, bahkan status notanya bisa berubah.
 */
const requestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('VOID'),
    reason: z.string().min(3, 'Alasan void wajib diisi').max(500, 'Alasan maksimal 500 karakter'),
  }),
  z.object({
    kind: z.literal('KOREKSI'),
    reason: editReasonSchema,
    payload: transactionEditPayloadSchema,
  }),
])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const auth = token ? await verifyAccessToken(token) : null

    if (!auth) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 })
    }
    const txId = parseInt(id, 10)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data permintaan tidak valid' },
        { status: 400 },
      )
    }

    const branchId = getPosBranchId(auth, cookieStore)

    const created = await db.transaction(async (trx) => {
      const [txn] = await trx
        .select({ id: transactions.id, status: transactions.status, branchId: transactions.branchId })
        .from(transactions)
        .where(and(eq(transactions.id, txId), eq(transactions.branchId, branchId)))
        .limit(1)

      if (!txn) throw new Error('TRX_NOT_FOUND')
      if (txn.status !== 'COMPLETED') throw new Error('TRX_NOT_COMPLETED')

      const existing = await trx
        .select({ id: voidRequests.id })
        .from(voidRequests)
        .where(and(eq(voidRequests.transactionId, txn.id), eq(voidRequests.status, 'PENDING')))
        .limit(1)

      if (existing.length > 0) throw new Error('REQUEST_EXISTS')

      const [row] = await trx
        .insert(voidRequests)
        .values({
          transactionId: txn.id,
          requestById: auth.userId,
          reason: parsed.data.reason,
          kind: parsed.data.kind,
          payload: parsed.data.kind === 'KOREKSI' ? parsed.data.payload : null,
          status: 'PENDING',
        })
        .returning({ id: voidRequests.id, kind: voidRequests.kind })

      return row
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'TRX_NOT_FOUND') {
        return NextResponse.json({ error: 'Transaksi tidak ditemukan di cabang ini' }, { status: 404 })
      }
      if (error.message === 'TRX_NOT_COMPLETED') {
        return NextResponse.json(
          { error: 'Transaksi sudah dibatalkan atau tidak dapat diajukan' },
          { status: 409 },
        )
      }
      if (error.message === 'REQUEST_EXISTS') {
        return NextResponse.json(
          { error: 'Sudah ada permintaan yang menunggu persetujuan untuk transaksi ini' },
          { status: 409 },
        )
      }
    }
    // Index unik parsial (satu PENDING per transaksi) — pengaman kalau dua pengajuan balapan
    // dan cek di atas sama-sama lolos.
    if (
      typeof error === 'object' && error !== null && 'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return NextResponse.json(
        { error: 'Sudah ada permintaan yang menunggu persetujuan untuk transaksi ini' },
        { status: 409 },
      )
    }
    console.error('POST /api/pos/transactions/[id]/request-approval error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 })
  }
}
