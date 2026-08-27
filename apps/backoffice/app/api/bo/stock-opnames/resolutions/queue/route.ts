import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { getResolutionQueue } from '@/lib/services/stock-opname-resolution-report'

export const dynamic = 'force-dynamic'

// Antrean item selisih SO Besar yang sudah disetujui tapi belum diresolusi lebih lanjut
// (belum ada catatan disposisi ditemukan/write-off/tagih karyawan/lebih-dijelaskan).
export async function GET(req: NextRequest) {
  try {
    const gate = await requirePermission('stock_opname.resolve')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const url = new URL(req.url)
    const branchIdParam = url.searchParams.get('branchId')
    const branchId =
      payload.branchScope === 'ALL'
        ? branchIdParam
          ? Number(branchIdParam)
          : null
        : payload.branchId

    const rows = await getResolutionQueue({
      branchId,
      startDate: url.searchParams.get('startDate'),
      endDate: url.searchParams.get('endDate'),
      search: url.searchParams.get('q'),
    })
    return NextResponse.json(rows)
  } catch (error: unknown) {
    if (error instanceof Error && /tanggal/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('GET /api/bo/stock-opnames/resolutions/queue error:', error)
    return NextResponse.json({ error: 'Gagal memuat antrean resolusi' }, { status: 500 })
  }
}
