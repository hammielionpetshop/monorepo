import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as argon2 from 'argon2'
import { verifyAccessToken } from '@/lib/auth'
import { db, users, ownerAssignments, eq, and } from '@/lib/db'
import { assertVoidable, performVoid, VoidError } from '@/lib/services/void-service'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    // Validasi ID transaksi hanya numerik
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 })
    }
    const txId = parseInt(id, 10)
    if (txId <= 0) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 })
    }

    // Ambil PIN Owner dari body request
    const body = await req.json().catch(() => ({}))
    const pin = body.pin
    if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ error: 'PIN Owner tidak valid' }, { status: 400 })
    }

    // Validasi transaksi: milik cabang kasir, COMPLETED, dan shift masih OPEN
    const trx = await assertVoidable(txId, { branchId: payload.branchId, requireShiftOpen: true })

    // Verifikasi PIN Owner secara server-side
    const [ownerAssignment] = await db
      .select({ userId: ownerAssignments.userId })
      .from(ownerAssignments)
      .where(and(eq(ownerAssignments.branchId, payload.branchId), eq(ownerAssignments.isActive, true)))
      .limit(1)

    if (!ownerAssignment) {
      return NextResponse.json({ error: 'Owner tidak dikonfigurasi untuk cabang ini' }, { status: 404 })
    }

    const [owner] = await db
      .select({ pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, ownerAssignment.userId))
      .limit(1)

    if (!owner?.pinHash) {
      return NextResponse.json({ error: 'PIN Owner belum dikonfigurasi. Hubungi Administrator.' }, { status: 404 })
    }

    const isValidPin = await argon2.verify(owner.pinHash, pin)
    if (!isValidPin) {
      // Jeda 1 detik untuk mitigasi brute force
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return NextResponse.json({ error: 'PIN Owner tidak valid. Void dibatalkan.' }, { status: 400 })
    }

    await performVoid({
      txId,
      branchId: trx.branchId,
      trxNumber: trx.trxNumber,
      actorUserId: payload.userId,
    })

    return NextResponse.json({ success: true, trxNumber: trx.trxNumber, status: 'VOIDED' })
  } catch (error: unknown) {
    if (error instanceof VoidError) {
      const status = error.code === 'TRX_NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    const message = error instanceof Error ? error.message : 'Gagal memvoid transaksi'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
