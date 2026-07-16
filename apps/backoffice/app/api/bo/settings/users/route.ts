import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import * as argon2 from 'argon2'
import { getAuth, requirePermission } from '@/lib/authz'
import { getDefaultCredentials } from '@/lib/app-settings'
import { db, users, roles, branches, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  username: z.string().trim().min(1, 'Username wajib diisi').max(50, 'Username maksimal 50 karakter')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip'),
  email: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().trim().email('Format email tidak valid').max(255)
  ).optional(),
  staffNumber: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().trim().max(50, 'Nomor staf maksimal 50 karakter')
  ).optional(),
  // Password & PIN opsional: bila kosong diambil dari default app_settings.
  password: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().trim().min(6, 'Password minimal 6 karakter')
  ).optional(),
  pin: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().trim().regex(/^\d{4,6}$/, 'PIN harus 4–6 digit angka')
  ).optional(),
  roleId: z.number().int().positive('Role wajib dipilih'),
  branchId: z.number().int().positive('Cabang wajib dipilih'),
})

export async function GET() {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const result = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        staffNumber: users.staffNumber,
        email: users.email,
        roleId: users.roleId,
        roleName: roles.name,
        branchId: users.branchId,
        branchName: branches.name,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .innerJoin(branches, eq(users.branchId, branches.id))
      .orderBy(users.name)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/settings/users error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data pengguna' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('user.manage')
    if (gate instanceof NextResponse) return gate

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const emailValue = parsed.data.email?.trim() || null
    const staffNumberValue = parsed.data.staffNumber?.trim() || null
    const usernameValue = parsed.data.username.trim()

    // Password/PIN dari input, atau default app_settings bila dikosongkan.
    const defaults = await getDefaultCredentials()
    const passwordPlain = parsed.data.password ?? defaults.password
    const pinPlain = parsed.data.pin ?? defaults.pin

    const result = await db.transaction(async (trx) => {
      const existingUsername = await trx.select({ id: users.id }).from(users)
        .where(eq(users.username, usernameValue)).limit(1)
      if (existingUsername.length > 0) throw new Error('DUPLICATE_USERNAME')

      if (emailValue) {
        const existing = await trx.select({ id: users.id }).from(users)
          .where(eq(users.email, emailValue)).limit(1)
        if (existing.length > 0) throw new Error('DUPLICATE_EMAIL')
      }
      if (staffNumberValue) {
        const existing = await trx.select({ id: users.id }).from(users)
          .where(eq(users.staffNumber, staffNumberValue)).limit(1)
        if (existing.length > 0) throw new Error('DUPLICATE_STAFF_NUMBER')
      }

      const role = await trx.select({ id: roles.id }).from(roles)
        .where(eq(roles.id, parsed.data.roleId)).limit(1)
      if (role.length === 0) throw new Error('ROLE_NOT_FOUND')

      const branch = await trx.select({ id: branches.id }).from(branches)
        .where(and(eq(branches.id, parsed.data.branchId), eq(branches.isActive, true))).limit(1)
      if (branch.length === 0) throw new Error('BRANCH_NOT_FOUND')

      const passwordHash = await argon2.hash(passwordPlain)
      const pinHash = await argon2.hash(pinPlain)

      const [newUser] = await trx.insert(users).values({
        name: parsed.data.name.trim(),
        username: usernameValue,
        email: emailValue,
        staffNumber: staffNumberValue,
        passwordHash,
        pinHash,
        roleId: parsed.data.roleId,
        branchId: parsed.data.branchId,
        isActive: true,
        // User baru wajib onboarding: ganti password + PIN saat login pertama.
        mustChangeCredentials: true,
      }).returning({ id: users.id, name: users.name })

      return newUser
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_USERNAME') {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
      }
      if (error.message === 'DUPLICATE_EMAIL') {
        return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 })
      }
      if (error.message === 'DUPLICATE_STAFF_NUMBER') {
        return NextResponse.json({ error: 'Nomor staf sudah digunakan' }, { status: 409 })
      }
      if (error.message === 'ROLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 400 })
      }
      if (error.message === 'BRANCH_NOT_FOUND') {
        return NextResponse.json({ error: 'Cabang tidak ditemukan atau tidak aktif' }, { status: 400 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Username, email, atau nomor staf sudah digunakan' }, { status: 409 })
    }
    console.error('POST /api/bo/settings/users error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan data pengguna' }, { status: 500 })
  }
}