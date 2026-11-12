import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { cancelAsset } from '@/lib/services/asset-service'
import { assetActorOf, assetErrorResponse, canDisposeAssets } from '@/lib/services/asset-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string({ message: 'Alasan pembatalan wajib diisi' }).trim().min(3, 'Alasan pembatalan wajib diisi (minimal 3 huruf)').max(200),
})

/** Batalkan aset salah catat (Owner/GM); catatan Arus Kas Beli/Jual aset ikut bertanda Batal. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canDisposeAssets(payload)) return NextResponse.json({ error: 'Hanya Owner dan GM yang boleh membatalkan aset' }, { status: 403 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Aset tidak valid' }, { status: 400 })
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    await cancelAsset(id, parsed.data.reason, assetActorOf(payload))
    return NextResponse.json({ success: true })
  } catch (error) {
    return assetErrorResponse(error, 'POST /api/bo/assets/[id]/cancel', 'Gagal membatalkan aset')
  }
}
