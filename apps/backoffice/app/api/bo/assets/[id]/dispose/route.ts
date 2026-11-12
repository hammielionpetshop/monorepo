import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { disposeAsset } from '@/lib/services/asset-service'
import { assetActorOf, assetErrorResponse, canDisposeAssets } from '@/lib/services/asset-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  status: z.enum(['DAMAGED', 'LOST', 'SOLD'], { message: 'Keadaan baru wajib dipilih' }),
  disposedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal kejadian tidak valid'),
  reason: z.string({ message: 'Alasan wajib diisi' }).trim().min(3, 'Alasan wajib diisi (minimal 3 huruf)').max(200),
  saleAmount: z.number().int('Uang hasil jual harus angka bulat').nullable(),
  moneyPlaceId: z.number().int().positive().nullable(),
})

/** Ubah keadaan: Rusak / Hilang / Dijual (Owner/GM). Tidak bisa dibalik. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canDisposeAssets(payload)) return NextResponse.json({ error: 'Hanya Owner dan GM yang boleh mengubah keadaan aset' }, { status: 403 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Aset tidak valid' }, { status: 400 })
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    await disposeAsset(id, parsed.data, assetActorOf(payload))
    return NextResponse.json({ success: true })
  } catch (error) {
    return assetErrorResponse(error, 'POST /api/bo/assets/[id]/dispose', 'Gagal mengubah keadaan aset')
  }
}
