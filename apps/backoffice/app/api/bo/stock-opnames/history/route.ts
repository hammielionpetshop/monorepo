import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, scopeFilter } from '@/lib/authz'
import { db, stockOpnames, eq, and, desc, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['PENDING', 'APPROVED', 'REJECTED'] as const

const querySchema = z.object({
  branchId: z.string().regex(/^\d+$/, 'ID cabang tidak valid').optional(),
  shiftId: z.string().regex(/^\d+$/, 'ID shift tidak valid').optional(),
  status: z.enum(ALLOWED_STATUS).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePermission('stock_opname.read')
    if (gate instanceof NextResponse) return gate
    const payload = gate

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
    if (payload.branchScope !== 'ALL' && requestedBranchId !== null && requestedBranchId !== payload.branchId) {
      return NextResponse.json(
        { error: 'Anda hanya dapat melihat riwayat stock opname cabang sendiri' },
        { status: 403 }
      )
    }

    const conditions: (ReturnType<typeof eq> | ReturnType<typeof sql>)[] = []
    const scope = scopeFilter(payload, stockOpnames.branchId)
    if (scope) {
      conditions.push(scope)
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
