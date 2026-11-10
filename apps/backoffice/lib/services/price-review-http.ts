import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db } from '@/lib/db'
import { PriceReviewError } from './price-review-service'

type Tx = any

/**
 * Pola bersama aksi Pemeriksaan Harga Jual: hak Kelola Harga (Owner/GM), body JSON tervalidasi,
 * satu transaksi DB, galat bisnis → status & pesan Bahasa Indonesia.
 */
export async function handlePriceReviewAction<S extends z.ZodTypeAny>(
  req: Request,
  params: Promise<{ id: string }>,
  schema: S,
  run: (tx: Tx, input: { id: number; userId: number; body: z.infer<S> }) => Promise<void>,
  label: string,
) {
  try {
    const gate = await requirePermission('master.price.manage')
    if (gate instanceof NextResponse) return gate
    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }
    const { id } = await params
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    await db.transaction(tx => run(tx, { id: Number(id), userId: gate.userId, body: parsed.data }))
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof PriceReviewError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof Error && error.message === 'NO_CONVERSION') {
      return NextResponse.json(
        { error: 'Konversi satuan produk ini sudah berubah. Atur modal & harga langsung di Manajemen Harga.' },
        { status: 409 },
      )
    }
    console.error(`${label} error:`, error)
    return NextResponse.json({ error: 'Gagal memproses pemeriksaan harga jual' }, { status: 500 })
  }
}
