import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import * as argon2 from 'argon2'
import { requirePermission } from '@/lib/authz'
import { getDefaultCredentials } from '@/lib/app-settings'
import { db, users, auditLogs, eq } from '@/lib/db'
import { resetPinSchema } from '@petshop/shared'

export const dynamic = 'force-dynamic'

const PERM = 'user.manage'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

// Reset PIN staf — HANYA PIN. Berbeda dari `resetCredentials` di PATCH ../[id] yang juga
// mengembalikan password ke default dan memaksa onboarding penuh; di sini password staf
// tidak disentuh karena kasus nyatanya adalah "lupa PIN", bukan "kehilangan akun".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission(PERM)
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const targetUserId = Number(paramParsed.data.id)

    if (targetUserId === Number(payload.userId)) {
      return NextResponse.json(
        { error: 'Untuk mengganti PIN sendiri, gunakan halaman Ganti PIN' },
        { status: 400 }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = resetPinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const [target] = await db
      .select({
        id: users.id,
        name: users.name,
        branchId: users.branchId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1)

    if (!target) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }

    // Sumbu scope: pemegang izin yang cabangnya terbatas hanya boleh me-reset staf cabangnya.
    if (payload.branchScope !== 'ALL' && target.branchId !== payload.branchId) {
      return NextResponse.json({ error: 'Akses ditolak untuk pengguna di cabang lain' }, { status: 403 })
    }

    if (!target.isActive) {
      return NextResponse.json({ error: 'Pengguna sudah nonaktif' }, { status: 400 })
    }

    const { pin: defaultPin } = await getDefaultCredentials()
    const newPin = parsed.data.mode === 'default' ? defaultPin : parsed.data.newPin

    await db.transaction(async (trx) => {
      await trx
        .update(users)
        .set({
          pinHash: await argon2.hash(newPin),
          // Staf wajib memilih PIN sendiri di login berikutnya — PIN hasil reset ini
          // diketahui OWNER (dan untuk mode default, diketahui semua staf).
          mustChangePin: true,
          pinSetAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId))

      await trx.insert(auditLogs).values({
        branchId: target.branchId,
        userId: payload.userId,
        action: 'USER_PIN_RESET',
        tableName: 'users',
        recordId: String(targetUserId),
        newData: JSON.stringify({
          targetName: target.name,
          mode: parsed.data.mode,
          mustChangePin: true,
        }),
      })
    })

    return NextResponse.json({
      ok: true,
      userId: targetUserId,
      // PIN dikembalikan agar OWNER bisa menyampaikannya ke staf — untuk mode `default`
      // nilainya memang sudah terpampang di Settings › Keamanan.
      pin: newPin,
      mode: parsed.data.mode,
    })
  } catch (error) {
    console.error('POST /api/bo/settings/users/[id]/reset-pin error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mereset PIN' }, { status: 500 })
  }
}
