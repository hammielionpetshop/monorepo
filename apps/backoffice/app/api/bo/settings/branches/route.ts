import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, branches, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createBranchSchema = z.object({
  code: z.string().trim().min(1, 'Kode wajib diisi').max(20, 'Kode maksimal 20 karakter')
    .regex(/^[A-Za-z0-9-]+$/, 'Kode hanya boleh huruf, angka, dan strip'),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  receiptName: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().trim().min(1, 'Nama di struk wajib diisi').max(100, 'Nama di struk maksimal 100 karakter')
  ).optional(),
  address: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().max(500, 'Alamat maksimal 500 karakter').nullable()
  ).optional(),
  phone: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().max(20, 'Telepon maksimal 20 karakter').nullable()
  ).optional(),
})

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

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('branch.manage')
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

    const parsed = createBranchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const codeValue = parsed.data.code.trim().toUpperCase()
    const nameValue = parsed.data.name.trim()
    const receiptNameValue = parsed.data.receiptName?.trim() || 'HAMMIELION'
    const addressValue = parsed.data.address ?? null
    const phoneValue = parsed.data.phone ?? null

    const created = await db.transaction(async (trx) => {
      const existingCode = await trx.select({ id: branches.id }).from(branches)
        .where(eq(branches.code, codeValue)).limit(1)
      if (existingCode.length > 0) throw new Error('DUPLICATE_CODE')

      const existingName = await trx.select({ id: branches.id }).from(branches)
        .where(eq(branches.name, nameValue)).limit(1)
      if (existingName.length > 0) throw new Error('DUPLICATE_NAME')

      const [newBranch] = await trx.insert(branches).values({
        code: codeValue,
        name: nameValue,
        receiptName: receiptNameValue,
        address: addressValue,
        phone: phoneValue,
        isActive: true,
      }).returning({
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

      return newBranch
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_CODE') {
        return NextResponse.json({ error: 'Kode cabang sudah digunakan' }, { status: 409 })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return NextResponse.json({ error: 'Nama cabang sudah digunakan' }, { status: 409 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Kode atau nama cabang sudah digunakan' }, { status: 409 })
    }
    console.error('POST /api/bo/settings/branches error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan data cabang' }, { status: 500 })
  }
}