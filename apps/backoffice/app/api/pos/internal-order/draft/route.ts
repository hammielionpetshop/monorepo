import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { verifyAccessToken } from '@/lib/auth'
import { db, internalOrderDrafts, and, eq } from '@/lib/db'
import { getPosBranchId } from '@/lib/pos-branch'

export const dynamic = 'force-dynamic'

async function requirePosSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) return null
  return { payload, branchId: getPosBranchId(payload, cookieStore) }
}

const draftUomSchema = z.object({
  id: z.number(),
  name: z.string(),
  ratio: z.number(),
})

const draftItemSchema = z.object({
  id: z.number(),
  productId: z.number(),
  productName: z.string(),
  productCode: z.string(),
  uomId: z.number(),
  uomName: z.string(),
  availableUoms: z.array(draftUomSchema).min(1),
  baseDefaultCostPrice: z.number(),
  qtyRequested: z.number(),
  costPrice: z.number(),
})

const draftPutSchema = z.object({
  destinationBranchId: z.number().int().positive(),
  sourceBranchId: z.number().int().positive().nullable(),
  notes: z.string().max(2000).optional().default(''),
  items: z.array(draftItemSchema),
})

/**
 * Draft pembuatan PO Internal (task kanban #38 Bagian A) — satu draft aktif per
 * (branchId, createdById), scoped ke sesi POS + user yang login, bukan localStorage lagi
 * supaya tidak hilang saat ganti device/browser.
 */
export async function GET() {
  try {
    const session = await requirePosSession()
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const [row] = await db
      .select()
      .from(internalOrderDrafts)
      .where(
        and(
          eq(internalOrderDrafts.branchId, session.branchId),
          eq(internalOrderDrafts.createdById, session.payload.userId),
        ),
      )
      .limit(1)

    if (!row) return NextResponse.json(null)

    return NextResponse.json({
      destinationBranchId: row.destinationBranchId,
      sourceBranchId: row.sourceBranchId,
      notes: row.notes ?? '',
      items: row.items,
      savedAt: row.updatedAt,
    })
  } catch (err) {
    console.error('GET /api/pos/internal-order/draft error:', err)
    return NextResponse.json({ error: 'Gagal mengambil draft PO Internal' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requirePosSession()
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const body = await req.json()
    const parsed = draftPutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }

    const scope = and(
      eq(internalOrderDrafts.branchId, session.branchId),
      eq(internalOrderDrafts.createdById, session.payload.userId),
    )

    // Draft yang dikosongkan (semua produk dihapus) dibuang, bukan disimpan sebagai baris
    // kosong — mengikuti perilaku lama writeInternalOrderDraft() di localStorage.
    if (parsed.data.items.length === 0) {
      await db.delete(internalOrderDrafts).where(scope)
      return NextResponse.json({ cleared: true })
    }

    const [saved] = await db
      .insert(internalOrderDrafts)
      .values({
        branchId: session.branchId,
        createdById: session.payload.userId,
        destinationBranchId: parsed.data.destinationBranchId,
        sourceBranchId: parsed.data.sourceBranchId,
        notes: parsed.data.notes || null,
        items: parsed.data.items,
      })
      .onConflictDoUpdate({
        target: [internalOrderDrafts.branchId, internalOrderDrafts.createdById],
        set: {
          destinationBranchId: parsed.data.destinationBranchId,
          sourceBranchId: parsed.data.sourceBranchId,
          notes: parsed.data.notes || null,
          items: parsed.data.items,
          updatedAt: new Date(),
        },
      })
      .returning()

    return NextResponse.json({ savedAt: saved.updatedAt })
  } catch (err) {
    console.error('PUT /api/pos/internal-order/draft error:', err)
    return NextResponse.json({ error: 'Gagal menyimpan draft PO Internal' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await requirePosSession()
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    await db
      .delete(internalOrderDrafts)
      .where(
        and(
          eq(internalOrderDrafts.branchId, session.branchId),
          eq(internalOrderDrafts.createdById, session.payload.userId),
        ),
      )

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('DELETE /api/pos/internal-order/draft error:', err)
    return NextResponse.json({ error: 'Gagal menghapus draft PO Internal' }, { status: 500 })
  }
}
