import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, stockOpnames, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM', 'MANAGER']

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'Alasan penolakan wajib diisi').max(500, 'Alasan maksimal 500 karakter'),
})

export async function PATCH(
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

    if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner, GM, atau Manager yang dapat menolak stock opname.' }, { status: 403 })
    }

    const currentUserId = Number(payload.userId)
    if (Number.isNaN(currentUserId)) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const targetId = Number(paramParsed.data.id)

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    await db.transaction(async (tx) => {
      const soRows = await tx
        .select({ id: stockOpnames.id, status: stockOpnames.status, branchId: stockOpnames.branchId })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, targetId))
        .for('update')
        .limit(1)

      if (soRows.length === 0) {
        throw new Error('SO_NOT_FOUND')
      }

      // DRAFT ikut boleh ditolak: itulah jalan membatalkan SO Besar yang salah dibuat.
      // Tanpa ini SO tersangkut selamanya sekaligus memblokir pembuatan SO baru,
      // karena DRAFT dihitung sebagai SO aktif.
      if (soRows[0].status !== 'PENDING' && soRows[0].status !== 'DRAFT') {
        throw new Error('ALREADY_PROCESSED')
      }

      if (payload.role === 'MANAGER' && payload.branchId !== soRows[0].branchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      await tx
        .update(stockOpnames)
        .set({
          status: 'REJECTED',
          rejectedById: currentUserId,
          rejectedAt: new Date(),
          rejectionNote: parsed.data.reason,
        })
        .where(eq(stockOpnames.id, targetId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'SO_NOT_FOUND') {
        return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'ALREADY_PROCESSED') {
        return NextResponse.json({ error: 'Stock opname sudah diproses sebelumnya' }, { status: 400 })
      }
      if (error.message === 'BRANCH_FORBIDDEN') {
        return NextResponse.json({ error: 'Akses ditolak. Anda hanya dapat menolak stock opname cabang Anda sendiri.' }, { status: 403 })
      }
    }
    console.error('PATCH /api/bo/stock-opnames/[id]/reject error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menolak stock opname' }, { status: 500 })
  }
}
