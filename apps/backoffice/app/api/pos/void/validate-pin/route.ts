import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import * as argon2 from 'argon2'
import { verifyAccessToken } from '@/lib/auth'
import { db, users, ownerAssignments, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const schema = z.object({
  pin: z.string().min(4).max(6),
})

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

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

    const isValid = await argon2.verify(owner.pinHash, parsed.data.pin)
    if (!isValid) {
      // Jeda 1 detik untuk mitigasi brute force
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return NextResponse.json({ error: 'PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar.' }, { status: 400 })
    }

    return NextResponse.json({ valid: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memvalidasi PIN'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
