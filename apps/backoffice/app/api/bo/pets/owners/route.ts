import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { searchOwners } from '@/lib/services/grooming-master-service'
import { groomingMasterErrorResponse } from '@/lib/grooming-master-http'

export const dynamic = 'force-dynamic'

// Cari pemilik dari nama / nomor telepon, beserta kucingnya — "ketik nama atau nomor yang sudah
// terdaftar, data kucing muncul".
export async function GET(req: NextRequest) {
  try {
    const gate = await requirePermission('grooming.pet.manage')
    if (gate instanceof NextResponse) return gate
    return NextResponse.json(await searchOwners(req.nextUrl.searchParams.get('q') ?? ''))
  } catch (error) {
    return groomingMasterErrorResponse(error, 'GET /api/bo/pets/owners')
  }
}
