import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { DepositError } from '@/lib/services/deposit-error'
import { LEGACY_RUN_ROLES } from '@/lib/services/legacy-settlement-rules'
import { runLegacySettlement } from '@/lib/services/legacy-settlement-run'

export const dynamic = 'force-dynamic'

const schema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal mulai tidak valid'),
  includeNoncash: z.boolean(),
  subtractManual: z.boolean(),
  confirmTotal: z.number().int('Total harus bilangan bulat').positive('Ketik ulang total yang dilunasi'),
  expectedFingerprint: z.string().min(1).max(20_000),
  notes: z.string().trim().min(5, 'Catatan wajib diisi (minimal 5 huruf)').max(500, 'Catatan maksimal 500 karakter'),
})

// F2-3b-2 — Jalankan pelunasan susulan utang lama. Hanya Owner (spec §9 no.5).
export async function POST(req: NextRequest) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  if (!LEGACY_RUN_ROLES.includes(payload.role)) {
    return NextResponse.json({ error: 'Hanya Owner yang dapat menjalankan pelunasan susulan' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }
  try {
    const result = await runLegacySettlement({ ...parsed.data, userId: payload.userId })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DepositError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('POST legacy-run error:', error)
    return NextResponse.json({ error: 'Gagal menjalankan pelunasan susulan' }, { status: 500 })
  }
}
