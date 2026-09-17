import { NextRequest, NextResponse } from 'next/server'

import { requirePermission } from '@/lib/authz'
import { and, bulkSaleDrafts, db, eq } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requirePermission('transaction.bulk_sale')
    if (gate instanceof NextResponse) return gate

    const { id: rawId } = await params
    const id = Number(rawId)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Draft tidak valid' }, { status: 400 })
    }

    const deleted = await db
      .delete(bulkSaleDrafts)
      .where(and(eq(bulkSaleDrafts.id, id), eq(bulkSaleDrafts.createdById, gate.userId)))
      .returning({ id: bulkSaleDrafts.id })

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Draft tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/bo/bulk-sale-drafts/[id] error:', err)
    return NextResponse.json({ error: 'Gagal menghapus draft bulk sale' }, { status: 500 })
  }
}
