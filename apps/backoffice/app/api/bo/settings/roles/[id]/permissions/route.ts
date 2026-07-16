import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, roles, permissions, rolePermissions, eq, inArray } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z.object({
  permissionIds: z.array(z.number().int().positive('ID permission tidak valid'))
    .max(200, 'Terlalu banyak permission'),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('user.manage')
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
    const roleId = Number(paramParsed.data.id)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const permissionIds = [...new Set(parsed.data.permissionIds)]

    const result = await db.transaction(async (trx) => {
      const role = await trx.select({ id: roles.id, name: roles.name }).from(roles)
        .where(eq(roles.id, roleId)).limit(1)
      if (role.length === 0) throw new Error('ROLE_NOT_FOUND')

      // OWNER terkunci: selalu punya semua permission (anti self-lockout).
      // Role sendiri juga tidak boleh diubah agar editor tidak mencabut aksesnya sendiri.
      if (role[0].name === 'OWNER') throw new Error('OWNER_LOCKED')
      if (role[0].name === payload.role) throw new Error('SELF_ROLE')

      if (permissionIds.length > 0) {
        const found = await trx.select({ id: permissions.id }).from(permissions)
          .where(inArray(permissions.id, permissionIds))
        if (found.length !== permissionIds.length) throw new Error('PERMISSION_NOT_FOUND')
      }

      await trx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
      if (permissionIds.length > 0) {
        await trx.insert(rolePermissions).values(
          permissionIds.map((permissionId) => ({ roleId, permissionId }))
        )
      }

      return { roleId, permissionIds }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'ROLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'OWNER_LOCKED') {
        return NextResponse.json({ error: 'Role OWNER terkunci dan tidak dapat diubah' }, { status: 403 })
      }
      if (error.message === 'SELF_ROLE') {
        return NextResponse.json({ error: 'Tidak dapat mengubah permission role sendiri' }, { status: 403 })
      }
      if (error.message === 'PERMISSION_NOT_FOUND') {
        return NextResponse.json({ error: 'Terdapat permission yang tidak dikenal' }, { status: 400 })
      }
    }
    console.error('PUT /api/bo/settings/roles/[id]/permissions error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan permission role' }, { status: 500 })
  }
}
