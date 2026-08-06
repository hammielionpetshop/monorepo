import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, users, permissions, userPermissions, eq, inArray } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z.object({
  permissionIds: z
    .array(z.number().int().positive('ID permission tidak valid'))
    .max(200, 'Terlalu banyak permission'),
})

/** Izin per orang yang ditunjuk, di luar izin bawaan role. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('user.manage')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  const paramParsed = paramsSchema.safeParse({ id })
  if (!paramParsed.success) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  }

  const rows = await db
    .select({ permissionId: userPermissions.permissionId, code: permissions.code })
    .from(userPermissions)
    .innerJoin(permissions, eq(permissions.id, userPermissions.permissionId))
    .where(eq(userPermissions.userId, Number(paramParsed.data.id)))

  return NextResponse.json({ permissions: rows })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('user.manage')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const userId = Number(paramParsed.data.id)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }

    const permissionIds = [...new Set(parsed.data.permissionIds)]

    const result = await db.transaction(async (trx) => {
      const target = await trx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      if (target.length === 0) throw new Error('USER_NOT_FOUND')

      if (permissionIds.length > 0) {
        const found = await trx
          .select({ id: permissions.id })
          .from(permissions)
          .where(inArray(permissions.id, permissionIds))
        if (found.length !== permissionIds.length) throw new Error('PERMISSION_NOT_FOUND')
      }

      await trx.delete(userPermissions).where(eq(userPermissions.userId, userId))
      if (permissionIds.length > 0) {
        await trx.insert(userPermissions).values(
          permissionIds.map((permissionId) => ({
            userId,
            permissionId,
            grantedBy: payload.userId,
          })),
        )
      }

      return { userId, permissionIds }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'USER_NOT_FOUND') {
        return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'PERMISSION_NOT_FOUND') {
        return NextResponse.json({ error: 'Terdapat permission yang tidak dikenal' }, { status: 400 })
      }
    }
    console.error('PUT /api/bo/settings/users/[id]/permissions error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan izin khusus user' },
      { status: 500 },
    )
  }
}
