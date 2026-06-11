import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, stockOpnames, eq, and, desc, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['PENDING', 'APPROVED', 'REJECTED'] as const
const ALLOWED_READ_ROLES = ['OWNER', 'GM', 'MANAGER']

const querySchema = z.object({
  branchId: z.string().regex(/^\d+$/, 'ID cabang tidak valid').optional(),
  shiftId: z.string().regex(/^\d+$/, 'ID shift tidak valid').optional(),
  status: z.enum(ALLOWED_STATUS).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!ALLOWED_READ_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner, GM, atau Manager yang dapat melihat riwayat stock opname' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({
      branchId: searchParams.get('branchId') ?? undefined,
      shiftId: searchParams.get('shiftId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
    }

    const requestedBranchId = parsed.data.branchId ? Number(parsed.data.branchId) : null
    if (payload.role === 'MANAGER' && requestedBranchId !== null && requestedBranchId !== payload.branchId) {
      return NextResponse.json(
        { error: 'Manager hanya dapat melihat riwayat stock opname cabangnya sendiri' },
        { status: 403 }
      )
    }

    const conditions: (ReturnType<typeof eq> | ReturnType<typeof sql>)[] = []
    if (payload.role === 'MANAGER') {
      conditions.push(eq(stockOpnames.branchId, payload.branchId))
    } else if (requestedBranchId !== null) {
      conditions.push(eq(stockOpnames.branchId, requestedBranchId))
    }
    if (parsed.data.shiftId) {
      conditions.push(eq(stockOpnames.shiftId, Number(parsed.data.shiftId)))
    }
    if (parsed.data.status) {
      conditions.push(eq(stockOpnames.status, parsed.data.status))
    }

    const results = await db
      .select({
        id: stockOpnames.id,
        soNumber: stockOpnames.soNumber,
        branchId: stockOpnames.branchId,
        type: stockOpnames.type,
        status: stockOpnames.status,
        createdById: stockOpnames.createdById,
        createdAt: stockOpnames.createdAt,
      })
      .from(stockOpnames)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockOpnames.createdAt))
      .limit(100)

    return NextResponse.json(results)
  } catch (error: unknown) {
    console.error('Get SO History API error:', error)
    return NextResponse.json({ error: 'Gagal mengambil riwayat stock opname' }, { status: 500 })
  }
}
