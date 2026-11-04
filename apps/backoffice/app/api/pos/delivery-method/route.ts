import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { getDeliverySettings } from '@/lib/delivery-method-server'

export const dynamic = 'force-dynamic'

// Dibaca layar bayar kasir & Bulk Sale: wajib pilih cara kirim? Tombol Truk Gudang paling depan di
// cabang ini? Bulk Sale mengirim ?branchId= (cabang dipilih di layar), kasir memakai cabang POS.
export async function GET(req: NextRequest) {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    const requested = Number(req.nextUrl.searchParams.get('branchId'))
    const branchId = Number.isInteger(requested) && requested > 0 ? requested : getPosBranchId(payload, await cookies())
    const settings = await getDeliverySettings()
    return NextResponse.json({ required: settings.required, truckFirst: settings.truckFirstBranchIds.includes(branchId) })
  } catch (error) {
    console.error('GET /api/pos/delivery-method error:', error)
    return NextResponse.json({ error: 'Gagal membaca pengaturan cara kirim' }, { status: 500 })
  }
}
