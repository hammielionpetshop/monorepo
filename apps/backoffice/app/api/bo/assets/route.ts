import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { proofPhotoUrlSchema } from '@/lib/proof-photo'
import { listAssets, recordAssetPurchase } from '@/lib/services/asset-service'
import { assetActorOf, assetErrorResponse, canRecordAssets, canViewAssets } from '@/lib/services/asset-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  name: z.string({ message: 'Nama barang wajib diisi' }).trim().min(1, 'Nama barang wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  assetType: z.enum(['ELECTRONICS', 'MACHINE', 'FURNITURE', 'VEHICLE', 'LEASEHOLD_IMPROVEMENT'], { message: 'Jenis aset wajib dipilih' }),
  usefulLifeMonths: z.number({ message: 'Umur pakai wajib diisi' }).int('Umur pakai harus angka bulat'),
  // null = Kantor (bersama).
  branchId: z.number().int().positive().nullable(),
  purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal beli tidak valid'),
  purchasePrice: z.number({ message: 'Harga wajib diisi' }).int('Harga harus angka bulat'),
  moneyPlaceId: z.number({ message: 'Pilih "Dibayar dari" (Tempat Uang)' }).int().positive('Pilih "Dibayar dari" (Tempat Uang)'),
  proofPhotoUrl: proofPhotoUrlSchema,
  note: z.string().trim().max(200, 'Catatan maksimal 200 karakter').nullable().optional(),
})

export async function GET() {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canViewAssets(payload)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  try {
    return NextResponse.json({ assets: await listAssets() })
  } catch (error) {
    return assetErrorResponse(error, 'GET /api/bo/assets', 'Gagal memuat daftar aset')
  }
}

/** Catat Pembelian Aset: aset + catatan Arus Kas "Beli aset" dalam satu simpan. */
export async function POST(req: Request) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canRecordAssets(payload)) {
    return NextResponse.json({ error: 'Hanya Owner, GM, dan Finance yang boleh mencatat pembelian aset' }, { status: 403 })
  }
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    const d = parsed.data
    const result = await recordAssetPurchase(
      { ...d, note: d.note?.trim() || null, proofPhotoUrl: d.proofPhotoUrl ?? null },
      assetActorOf(payload),
    )
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return assetErrorResponse(error, 'POST /api/bo/assets', 'Gagal menyimpan aset')
  }
}
