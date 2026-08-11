import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, shifts, eq, and, sql } from '@/lib/db'
import { POS_BRANCH_COOKIE, isBranchAllowed, resolveActiveBranchId } from '@/lib/active-branch'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const body = await request.json()
  const branchId = parseInt(body.branchId)
  if (isNaN(branchId) || branchId <= 0) {
    return NextResponse.json({ error: 'branchId tidak valid' }, { status: 400 })
  }

  // Gerbang sesungguhnya. Sebelumnya di sini hanya ada pemeriksaan role, sehingga MANAGER
  // cabang A bisa mengirim branchId cabang B dan sejak itu seluruh POS-nya — transaksi,
  // opname, penerimaan barang — tercatat di cabang yang bukan wewenangnya.
  if (!isBranchAllowed(payload, branchId)) {
    return NextResponse.json(
      { error: 'Anda tidak ditugaskan di cabang tersebut' },
      { status: 403 },
    )
  }

  const branch = await db.query.branches.findFirst({
    where: and(eq(branches.id, branchId), eq(branches.isActive, true)),
  })

  if (!branch) {
    return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
  }

  const activeBranchId = resolveActiveBranchId(payload, cookieStore)

  if (branchId !== activeBranchId) {
    // Pindah cabang di tengah shift membuat satu shift berisi transaksi dua cabang: kas yang
    // masuk di cabang A disettle bersama penjualan cabang B, dan selisihnya tak bisa
    // ditelusuri ke mana pun. Tutup shiftnya dulu, baru pindah.
    const [openShift] = await db
      .select({ id: shifts.id, shiftNumber: shifts.shiftNumber })
      .from(shifts)
      .where(
        and(
          eq(shifts.branchId, activeBranchId),
          eq(shifts.status, 'OPEN'),
          sql`(${shifts.openedById} = ${payload.userId} OR ${shifts.assignedCashiers} @> ${JSON.stringify([payload.userId])}::jsonb)`,
        ),
      )
      .limit(1)

    if (openShift) {
      return NextResponse.json(
        {
          error:
            'Masih ada shift terbuka di cabang ini. Selesaikan settlement dulu sebelum pindah cabang.',
        },
        { status: 409 },
      )
    }
  }

  const maxAge = 60 * 60 * 24 * 7
  cookieStore.set(POS_BRANCH_COOKIE.id, String(branchId), { path: '/', maxAge })
  cookieStore.set(POS_BRANCH_COOKIE.name, branch.name, { path: '/', maxAge })

  return NextResponse.json({ ok: true })
}
