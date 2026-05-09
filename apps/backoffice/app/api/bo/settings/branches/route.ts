import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const result = await db
      .select({
        id: branches.id,
        code: branches.code,
        name: branches.name,
        address: branches.address,
        phone: branches.phone,
        isActive: branches.isActive,
        lastSeenAt: branches.lastSeenAt,
        createdAt: branches.createdAt,
      })
      .from(branches)
      .orderBy(branches.code)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/settings/branches error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data cabang' }, { status: 500 })
  }
}