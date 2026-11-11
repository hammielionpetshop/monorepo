import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { DepositError } from '@/lib/services/deposit-error'
import { LEGACY_RUN_ROLES } from '@/lib/services/legacy-settlement-rules'
import { cancelLegacyRun } from '@/lib/services/legacy-settlement-run'

export const dynamic = 'force-dynamic'

const schema = z.object({
  reason: z.string().trim().min(5, 'Alasan pembatalan wajib diisi (minimal 5 huruf)').max(500, 'Alasan maksimal 500 karakter'),
})

// F2-3b-2 — Batalkan pelunasan susulan: semua baris dibalik (BATAL_SUSULAN), tidak ada yang dihapus.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  if (!LEGACY_RUN_ROLES.includes(payload.role)) {
    return NextResponse.json({ error: 'Hanya Owner yang dapat membatalkan pelunasan susulan' }, { status: 403 })
  }
  const runId = Number((await params).id)
  if (!Number.isInteger(runId) || runId <= 0) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }
  try {
    return NextResponse.json(await cancelLegacyRun({ runId, reason: parsed.data.reason, userId: payload.userId }))
  } catch (error) {
    if (error instanceof DepositError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('POST legacy-run cancel error:', error)
    return NextResponse.json({ error: 'Gagal membatalkan pelunasan susulan' }, { status: 500 })
  }
}
