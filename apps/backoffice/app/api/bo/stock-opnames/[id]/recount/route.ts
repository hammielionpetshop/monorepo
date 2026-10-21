import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { createRecountDoc, RecountError } from '@/lib/services/so-recount-service'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const bodySchema = z.object({
  notes: z
    .string()
    .trim()
    .min(1, 'Catatan wajib diisi — jelaskan kenapa SO ini dihitung ulang')
    .max(500, 'Catatan maksimal 500 karakter'),
})

// Membuat dokumen "Hitung Ulang" dari SO Besar yang sudah disetujui (SO induk = [id]).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('stock_opname.create')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const userId = Number(payload.userId)
    if (Number.isNaN(userId)) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }

    const result = await createRecountDoc({
      parentSoId: Number(paramParsed.data.id),
      userId,
      branchScope: payload.branchScope,
      userBranchId: payload.branchId,
      notes: parsed.data.notes,
    })

    return NextResponse.json({ success: true, so: result }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof RecountError) {
      switch (error.message) {
        case 'PARENT_NOT_FOUND':
          return NextResponse.json({ error: 'SO induk tidak ditemukan' }, { status: 404 })
        case 'PARENT_NOT_FULL':
          return NextResponse.json({ error: 'Hitung ulang hanya untuk SO Besar' }, { status: 400 })
        case 'PARENT_NOT_APPROVED':
          return NextResponse.json(
            { error: 'Hanya SO Besar yang sudah disetujui yang bisa dihitung ulang' },
            { status: 400 },
          )
        case 'PARENT_IS_RECOUNT':
          return NextResponse.json(
            { error: 'Dokumen ini sendiri sudah hasil hitung ulang — hitung ulang dari SO aslinya' },
            { status: 400 },
          )
        case 'BRANCH_FORBIDDEN':
          return NextResponse.json(
            { error: 'Anda hanya dapat menghitung ulang stock opname cabang sendiri' },
            { status: 403 },
          )
        case 'ACTIVE_SO_EXISTS':
          return NextResponse.json(
            { error: 'Masih ada stock opname aktif di cabang ini — selesaikan dulu sebelum menghitung ulang' },
            { status: 409 },
          )
      }
    }
    console.error('POST /api/bo/stock-opnames/[id]/recount error:', error)
    return NextResponse.json({ error: 'Gagal membuat dokumen hitung ulang' }, { status: 500 })
  }
}
