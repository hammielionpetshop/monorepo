import { NextResponse } from 'next/server'
import {
  createReturnedGoodsRequest,
  findReturnableTransfer,
  internalReturnErrorResponse,
  returnedGoodsRequestSchema,
  withdrawInternalReturn,
  type InternalReturnActor,
} from '@/lib/services/internal-return-service'

function knownError(error: unknown, fallback: string, logLabel: string) {
  const known = internalReturnErrorResponse(error)
  if (known) return NextResponse.json({ error: known.error }, { status: known.status })
  console.error(`${logLabel} error:`, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

/** Cari kiriman dari kode transaksi (nomor IBT / nota Bulk Sale) — isi form Barang Dikembalikan. */
export async function handleInternalReturnLookup(req: Request, actor: InternalReturnActor) {
  const code = new URL(req.url).searchParams.get('code') ?? ''
  if (code.trim().length > 60) {
    return NextResponse.json({ error: 'Kode transaksi terlalu panjang' }, { status: 400 })
  }
  try {
    return NextResponse.json(await findReturnableTransfer(code, actor))
  } catch (error) {
    return knownError(error, 'Gagal mencari kode transaksi', 'GET internal-returns/lookup')
  }
}

export async function handleReturnedGoodsCreate(req: Request, ctx: { actor: InternalReturnActor; source: 'POS' | 'BO' }) {
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }
  const parsed = returnedGoodsRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }
  try {
    const created = await createReturnedGoodsRequest({ input: parsed.data, actor: ctx.actor, source: ctx.source })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return knownError(error, 'Gagal mengajukan retur internal', 'POST internal-returns')
  }
}

/** Pengaju menarik pengajuannya sendiri (POS & Back Office) — hanya selama masih menunggu. */
export async function handleInternalReturnWithdraw(id: string, userId: number) {
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }
  try {
    const data = await withdrawInternalReturn({ id: Number(id), userId })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return knownError(error, 'Gagal menarik pengajuan retur internal', 'POST internal-returns withdraw')
  }
}

/** Badan permintaan JSON untuk rute setujui/tolak/batalkan; mengembalikan respons galat bila tidak valid. */
export async function readJsonBody(req: Request): Promise<unknown | NextResponse> {
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }
  try {
    return await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }
}

export { knownError as internalReturnHttpError }
