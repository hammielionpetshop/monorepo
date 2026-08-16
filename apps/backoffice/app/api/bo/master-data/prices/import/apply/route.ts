import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { applyPriceBulk } from '@/lib/services/price-service'
import { getSession, deleteSession } from '@/lib/services/price-import-session'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const runtime = 'nodejs'

const applySchema = z.object({
  sessionId: z.string().min(1, 'sessionId wajib diisi'),
})

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('master.price.manage')
    if (gate instanceof NextResponse) return gate

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = applySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const session = getSession(parsed.data.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Sesi preview kadaluarsa atau tidak ditemukan. Silakan preview ulang.' }, { status: 404 })
    }

    if (session.createdBy !== gate.userId) {
      return NextResponse.json({ error: 'Sesi preview milik user lain' }, { status: 403 })
    }

    // Satu transaksi untuk seluruh file — chunking ada di dalam applyPriceBulk.
    // Sebelumnya tiap chunk punya transaksi sendiri: kalau chunk ke-3 gagal, dua chunk
    // pertama sudah terlanjur commit dan file masuk separuh tanpa cara mengembalikannya.
    let totalUpdated = 0
    try {
      const res = await applyPriceBulk({
        branchId: session.branchId,
        changes: session.changes,
        costChanges: session.costChanges,
        actor: { userId: gate.userId, source: 'IMPORT', fileName: session.fileName },
      })
      totalUpdated = res.updated
    } catch (e) {
      // Jangan hapus session — user bisa retry setelah masalah teratasi
      if (e instanceof Error) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      throw e
    }

    deleteSession(session.id)

    return NextResponse.json({
      updated: totalUpdated,
      priceCount: session.changes.length,
      costCount: session.costChanges.length,
    })
  } catch (error) {
    console.error('POST /api/bo/master-data/prices/import/apply error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menerapkan harga' }, { status: 500 })
  }
}
