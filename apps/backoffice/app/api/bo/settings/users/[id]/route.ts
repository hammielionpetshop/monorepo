import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import * as argon2 from 'argon2'
import { requirePermission } from '@/lib/authz'
import { getDefaultCredentials } from '@/lib/app-settings'
import { db, users, roles, branches, eq, and, ne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter').optional(),
    username: z.string().trim().min(1, 'Username wajib diisi').max(50, 'Username maksimal 50 karakter')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip').optional(),
    email: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().trim().email('Format email tidak valid').max(255).nullable()
    ).optional(),
    staffNumber: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().trim().max(50, 'Nomor staf maksimal 50 karakter').nullable()
    ).optional(),
    roleId: z.number().int().positive('Role wajib dipilih').optional(),
    branchId: z.number().int().positive('Cabang wajib dipilih').optional(),
    isActive: z.boolean().optional(),
    // Aksi reset kredensial ke default: set password & PIN ke nilai app_settings,
    // paksa onboarding ulang.
    resetCredentials: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi',
  })

export async function PATCH(
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
    const targetUserId = Number(paramParsed.data.id)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    if (parsed.data.isActive === false && Number(payload.userId) === targetUserId) {
      return NextResponse.json(
        { error: 'Tidak dapat menonaktifkan akun sendiri' },
        { status: 400 }
      )
    }

    const updated = await db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: users.id, roleId: users.roleId })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      // Guard: tolak jika action akan membuat jumlah OWNER aktif = 0
      const ownerRoleRow = await trx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, 'OWNER'))
        .limit(1)

      if (ownerRoleRow.length > 0 && existing[0].roleId === ownerRoleRow[0].id) {
        const isDowngradingRole =
          parsed.data.roleId !== undefined && parsed.data.roleId !== ownerRoleRow[0].id
        const isDeactivating = parsed.data.isActive === false
        if (isDowngradingRole || isDeactivating) {
          const activeOwners = await trx
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.roleId, ownerRoleRow[0].id), eq(users.isActive, true)))
          if (activeOwners.length <= 1) throw new Error('LAST_OWNER')
        }
      }

      // FK validation untuk roleId dan branchId
      if (parsed.data.roleId !== undefined) {
        const role = await trx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.id, parsed.data.roleId))
          .limit(1)
        if (role.length === 0) throw new Error('ROLE_NOT_FOUND')
      }
      if (parsed.data.branchId !== undefined) {
        const branch = await trx
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.id, parsed.data.branchId), eq(branches.isActive, true)))
          .limit(1)
        if (branch.length === 0) throw new Error('BRANCH_NOT_FOUND')
      }

      const emailValue =
        parsed.data.email !== undefined ? (parsed.data.email?.trim() || null) : undefined
      const staffNumberValue =
        parsed.data.staffNumber !== undefined
          ? (parsed.data.staffNumber?.trim() || null)
          : undefined
      const usernameValue =
        parsed.data.username !== undefined ? parsed.data.username.trim() : undefined

      if (usernameValue !== undefined) {
        const duplicateUsername = await trx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, usernameValue), ne(users.id, targetUserId)))
          .limit(1)
        if (duplicateUsername.length > 0) throw new Error('DUPLICATE_USERNAME')
      }

      if (emailValue !== undefined && emailValue !== null) {
        const duplicateEmail = await trx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, emailValue), ne(users.id, targetUserId)))
          .limit(1)
        if (duplicateEmail.length > 0) throw new Error('DUPLICATE_EMAIL')
      }

      if (staffNumberValue !== undefined && staffNumberValue !== null) {
        const duplicateStaff = await trx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.staffNumber, staffNumberValue), ne(users.id, targetUserId)))
          .limit(1)
        if (duplicateStaff.length > 0) throw new Error('DUPLICATE_STAFF_NUMBER')
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim()
      if (usernameValue !== undefined) updateData.username = usernameValue
      if (emailValue !== undefined) updateData.email = emailValue
      if (staffNumberValue !== undefined) updateData.staffNumber = staffNumberValue
      if (parsed.data.roleId !== undefined) updateData.roleId = parsed.data.roleId
      if (parsed.data.branchId !== undefined) updateData.branchId = parsed.data.branchId
      if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive

      // Reset kredensial ke default: hash ulang password & PIN, paksa onboarding lagi.
      if (parsed.data.resetCredentials === true) {
        const defaults = await getDefaultCredentials()
        updateData.passwordHash = await argon2.hash(defaults.password)
        updateData.pinHash = await argon2.hash(defaults.pin)
        updateData.mustChangeCredentials = true
        updateData.credentialsSetAt = null
      }

      const rows = await trx
        .update(users)
        .set(updateData)
        .where(eq(users.id, targetUserId))
        .returning({
          id: users.id,
          name: users.name,
          username: users.username,
          staffNumber: users.staffNumber,
          email: users.email,
          roleId: users.roleId,
          branchId: users.branchId,
          isActive: users.isActive,
          updatedAt: users.updatedAt,
        })
      if (!rows[0]) throw new Error('NOT_FOUND')
      return rows
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'LAST_OWNER') {
        return NextResponse.json(
          { error: 'Tidak dapat mengubah akun OWNER terakhir yang aktif' },
          { status: 400 }
        )
      }
      if (error.message === 'ROLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 400 })
      }
      if (error.message === 'BRANCH_NOT_FOUND') {
        return NextResponse.json({ error: 'Cabang tidak ditemukan atau tidak aktif' }, { status: 400 })
      }
      if (error.message === 'DUPLICATE_USERNAME') {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
      }
      if (error.message === 'DUPLICATE_EMAIL') {
        return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 })
      }
      if (error.message === 'DUPLICATE_STAFF_NUMBER') {
        return NextResponse.json({ error: 'Nomor staf sudah digunakan' }, { status: 409 })
      }
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return NextResponse.json({ error: 'Email atau nomor staf sudah digunakan' }, { status: 409 })
    }
    console.error('PATCH /api/bo/settings/users/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui data pengguna' }, { status: 500 })
  }
}
