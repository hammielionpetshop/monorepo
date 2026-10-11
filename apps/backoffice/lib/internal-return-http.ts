import { NextResponse } from 'next/server'
import {
  INTERNAL_RETURN_KIND_PRICE,
  approveReturnedGoods,
  cancelReturnedGoods,
  createReturnedGoodsRequest,
  findReturnableTransfer,
  listReturnableTransfers,
  internalReturnErrorResponse,
  returnedGoodsRequestSchema,
  withdrawInternalReturn,
  type InternalReturnActor,
} from '@/lib/services/internal-return-service'
import {
  approvePriceRevision,
  cancelPriceRevision,
  createPriceRevisionRequest,
  findRevisableTransfer,
  priceRevisionApproveSchema,
  priceRevisionRequestSchema,
} from '@/lib/services/internal-price-revision-service'
import { getInternalReturnKind } from '@/lib/services/internal-return-queries'

function knownError(error: unknown, fallback: string, logLabel: string) {
  const known = internalReturnErrorResponse(error)
  if (known) return NextResponse.json({ error: known.error }, { status: known.status })
  console.error(`${logLabel} error:`, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

const isPriceKind = (value: unknown) => value === INTERNAL_RETURN_KIND_PRICE

/**
 * Cari kiriman dari kode transaksi (nomor IBT / nota Bulk Sale) — isi form Barang Dikembalikan,
 * atau form Revisi Harga Beli bila `kind=REVISI_HARGA` (barang + harga yang berlaku sekarang).
 */
export async function handleInternalReturnLookup(req: Request, actor: InternalReturnActor) {
  const search = new URL(req.url).searchParams
  const code = search.get('code') ?? ''
  if (code.trim().length > 60) {
    return NextResponse.json({ error: 'Kode transaksi terlalu panjang' }, { status: 400 })
  }
  try {
    return NextResponse.json(
      isPriceKind(search.get('kind')) ? await findRevisableTransfer(code, actor) : await findReturnableTransfer(code, actor),
    )
  } catch (error) {
    return knownError(error, 'Gagal mencari kode transaksi', 'GET internal-returns/lookup')
  }
}

/** Daftar kiriman yang bisa diretur (terbaru di atas) — pengisi daftar pilih di form. */
export async function handleInternalReturnCandidates(actor: InternalReturnActor) {
  try {
    return NextResponse.json({ rows: await listReturnableTransfers(actor) })
  } catch (error) {
    return knownError(error, 'Gagal memuat daftar kiriman', 'GET internal-returns/candidates')
  }
}

/** Ajukan Retur Internal. Badan dengan `kind: 'REVISI_HARGA'` = Revisi Harga Beli, selain itu Barang Dikembalikan. */
export async function handleInternalReturnCreate(req: Request, ctx: { actor: InternalReturnActor; source: 'POS' | 'BO' }) {
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }
  if (isPriceKind((raw as { kind?: unknown } | null)?.kind)) {
    const revision = priceRevisionRequestSchema.safeParse(raw)
    if (!revision.success) {
      return NextResponse.json({ error: revision.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    try {
      const created = await createPriceRevisionRequest({ input: revision.data, actor: ctx.actor, source: ctx.source })
      return NextResponse.json(created, { status: 201 })
    } catch (error) {
      return knownError(error, 'Gagal mengajukan revisi harga beli', 'POST internal-returns (revisi harga)')
    }
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

/**
 * Setujui (Owner/GM). Revisi Harga Beli boleh membawa `finalPrices` (harga final per baris);
 * Barang Dikembalikan tidak butuh badan permintaan.
 */
export async function handleInternalReturnApprove(req: Request, id: number, userId: number) {
  try {
    if (!isPriceKind(await getInternalReturnKind(id))) {
      return NextResponse.json({ success: true, data: await approveReturnedGoods({ id, userId }) })
    }
    let finalPrices: { itemId: number; finalUnitPrice: number }[] | undefined
    if (req.headers.get('content-type')?.includes('application/json')) {
      let raw: unknown
      try {
        raw = await req.json()
      } catch {
        return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
      }
      const parsed = priceRevisionApproveSchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
      }
      finalPrices = parsed.data.finalPrices
    }
    return NextResponse.json({ success: true, data: await approvePriceRevision({ id, userId, finalPrices }) })
  } catch (error) {
    return knownError(error, 'Gagal menyetujui retur internal', 'POST internal-returns approve')
  }
}

/** Batalkan dokumen yang sudah disetujui (Owner/GM, alasan wajib) — service dipilih dari jenis dokumen. */
export async function handleInternalReturnCancel(id: number, userId: number, reason: string) {
  try {
    const data = isPriceKind(await getInternalReturnKind(id))
      ? await cancelPriceRevision({ id, userId, reason })
      : await cancelReturnedGoods({ id, userId, reason })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return knownError(error, 'Gagal membatalkan retur internal', 'POST internal-returns cancel')
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
