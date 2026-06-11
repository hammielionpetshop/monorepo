import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  interBranchPayables,
  eq,
  and,
  sql,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'GM']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(payload.role)) {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya Owner dan GM yang dapat menghapus hutang antar cabang.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const payableId = parseInt(id)
    if (isNaN(payableId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const [payable] = await db
      .select({ id: interBranchPayables.id, status: interBranchPayables.status })
      .from(interBranchPayables)
      .where(eq(interBranchPayables.id, payableId))
      .limit(1)

    if (!payable) {
      return NextResponse.json({ error: 'Data hutang tidak ditemukan' }, { status: 404 })
    }

    if (payable.status === 'PAID') {
      return NextResponse.json({ error: 'Hutang yang sudah lunas tidak dapat dihapuskan' }, { status: 409 })
    }

    if (payable.status === 'WAIVED') {
      return NextResponse.json({ error: 'Hutang ini sudah dihapuskan sebelumnya' }, { status: 409 })
    }

    const [updated] = await db
      .update(interBranchPayables)
      .set({
        status: 'WAIVED',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(interBranchPayables.id, payableId),
          sql`${interBranchPayables.status} NOT IN ('PAID', 'WAIVED')`
        )
      )
      .returning()

    if (!updated) {
      return NextResponse.json(
        { error: 'Status hutang sudah berubah, silakan refresh halaman' },
        { status: 409 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH inter-branch-payables waive error:', error)
    return NextResponse.json({ error: 'Gagal menghapuskan hutang' }, { status: 500 })
  }
}
