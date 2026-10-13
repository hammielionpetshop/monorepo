import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { getPromoEnabled, loadPromoRules } from '@/lib/services/promo-service'

export const dynamic = 'force-dynamic'

// Promo untuk layar kasir cabang ini: saklar darurat, jam server, dan promo aktif yang belum
// berakhir. Layar menghitung promo keranjang dengan mesin promo yang sama memakai jam server
// (`serverNow`); saat nota disimpan server tetap menghitung ulang dan menjadi hakimnya.
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })

    const now = new Date()
    const branchId = getPosBranchId(payload, cookieStore)
    const enabled = await getPromoEnabled()
    const promos = enabled ? await loadPromoRules(branchId, now) : []
    return NextResponse.json({ enabled, serverNow: now.toISOString(), branchId, promos })
  } catch (error) {
    console.error('GET /api/pos/promos error:', error)
    return NextResponse.json({ error: 'Gagal membaca promo' }, { status: 500 })
  }
}
