import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { db, branches } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const result = await db
      .select({
        id: branches.id,
        code: branches.code,
        name: branches.name,
        receiptName: branches.receiptName,
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