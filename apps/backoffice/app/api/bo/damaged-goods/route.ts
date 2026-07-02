import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { verifyAccessToken } from '@/lib/auth'
import { getDamagedGoodsReport } from '@/lib/services/report-service'

export const dynamic = 'force-dynamic'

const GLOBAL_ROLES = ['OWNER', 'GM']

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  branchId: z.coerce.number().int().positive().optional(),
})

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json(
      { error: 'Sesi tidak valid, silakan login kembali' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' },
      { status: 400 },
    )
  }

  const { startDate, endDate, branchId } = parsed.data

  if (startDate > endDate) {
    return NextResponse.json(
      { error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai' },
      { status: 400 },
    )
  }

  // Peran global boleh melihat semua cabang atau memfilter cabang tertentu.
  // Peran lain dikunci ke cabangnya sendiri.
  const isGlobal = GLOBAL_ROLES.includes(payload.role)
  const scopedBranchId = isGlobal ? branchId ?? null : payload.branchId

  try {
    const data = await getDamagedGoodsReport({ startDate, endDate, branchId: scopedBranchId })
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil data barang rusak'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
