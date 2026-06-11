import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, eq, and } from '@/lib/db'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!['OWNER', 'GM', 'MANAGER'].includes(payload.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const branchId = parseInt(body.branchId)
  if (isNaN(branchId) || branchId <= 0) {
    return NextResponse.json({ error: 'branchId tidak valid' }, { status: 400 })
  }

  const branch = await db.query.branches.findFirst({
    where: and(eq(branches.id, branchId), eq(branches.isActive, true)),
  })

  if (!branch) {
    return NextResponse.json({ error: 'Branch tidak ditemukan' }, { status: 404 })
  }

  const maxAge = 60 * 60 * 24 * 7
  cookieStore.set('posBranchId', String(branchId), { path: '/', maxAge })
  cookieStore.set('posBranchName', branch.name, { path: '/', maxAge })

  return NextResponse.json({ ok: true })
}
