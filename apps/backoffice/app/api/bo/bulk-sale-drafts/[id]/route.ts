import { NextRequest, NextResponse } from 'next/server'

import { requirePermission } from '@/lib/authz'
import { and, bulkSaleDrafts, db, eq } from '@/lib/db'

import { draftBranchFilter } from '../scope'

// Dipakai untuk "Hapus" sekaligus "Lanjutkan": klien menghapus draf di server DULU sebelum
// memuatnya ke form. Hapus bersifat atomik, jadi bila dua orang secabang menekan Lanjutkan
// bersamaan hanya satu yang berhasil — yang lain mendapat 404 dan tidak membuat nota ganda.
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
      .where(and(eq(bulkSaleDrafts.id, id), draftBranchFilter(gate)))
      .returning({ id: bulkSaleDrafts.id })

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Draf sudah dilanjutkan atau dihapus pengguna lain' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/bo/bulk-sale-drafts/[id] error:', err)
    return NextResponse.json({ error: 'Gagal menghapus draft bulk sale' }, { status: 500 })
  }
}
