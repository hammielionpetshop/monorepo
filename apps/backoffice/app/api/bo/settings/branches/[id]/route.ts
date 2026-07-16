import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, branches, eq, ne, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateBranchSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter').optional(),
    receiptName: z.string().trim().min(1, 'Nama di struk wajib diisi').max(100, 'Nama di struk maksimal 100 karakter').optional(),
    address: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().trim().max(500, 'Alamat maksimal 500 karakter').nullable()
    ).optional(),
    phone: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().trim().max(20, 'Telepon maksimal 20 karakter').nullable()
    ).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi',
  })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('branch.manage')
    if (gate instanceof NextResponse) return gate

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const targetBranchId = Number(paramParsed.data.id)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = updateBranchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const updated = await db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.id, targetBranchId))
        .for('update')
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      if (parsed.data.name !== undefined) {
        const duplicateName = await trx
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.name, parsed.data.name!.trim()), ne(branches.id, targetBranchId)))
          .for('update')
          .limit(1)
        if (duplicateName.length > 0) throw new Error('DUPLICATE_NAME')
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim()
      if (parsed.data.receiptName !== undefined) updateData.receiptName = parsed.data.receiptName.trim()
      if (parsed.data.address !== undefined) updateData.address = parsed.data.address
      if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone

      const rows = await trx
        .update(branches)
        .set(updateData)
        .where(eq(branches.id, targetBranchId))
        .returning({
          id: branches.id,
          code: branches.code,
          name: branches.name,
          receiptName: branches.receiptName,
          address: branches.address,
          phone: branches.phone,
          isActive: branches.isActive,
          lastSeenAt: branches.lastSeenAt,
          updatedAt: branches.updatedAt,
        })
      if (!rows[0]) throw new Error('NOT_FOUND')
      return rows
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return NextResponse.json({ error: 'Nama cabang sudah digunakan' }, { status: 409 })
      }
    }
    console.error('PATCH /api/bo/settings/branches/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui data cabang' }, { status: 500 })
  }
}