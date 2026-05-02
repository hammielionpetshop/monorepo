import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, branches, eq, and } from '@/lib/db'

const heartbeatSchema = z.object({
  branchId: z.number().int().positive(),
  deviceId: z.string().min(1),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    let body
    try {
      body = await req.json()
    } catch (err) {
      return NextResponse.json({ error: 'Body harus berupa JSON' }, { status: 400 })
    }

    const parsed = heartbeatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload tidak valid', details: parsed.error.format() }, { status: 400 })
    }

    const { branchId } = parsed.data
    const now = new Date()

    const [updated] = await db
      .update(branches)
      .set({ lastSeenAt: now })
      .where(and(eq(branches.id, branchId), eq(branches.isActive, true)))
      .returning({ id: branches.id })

    if (!updated) {
      // Cek apakah cabang ada tapi tidak aktif
      const [exists] = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, branchId)).limit(1)
      if (exists) {
        return NextResponse.json({ error: 'Cabang ditemukan tapi tidak aktif' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, lastSeenAt: now.toISOString() })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memperbarui status cabang' },
      { status: 500 }
    )
  }
}
