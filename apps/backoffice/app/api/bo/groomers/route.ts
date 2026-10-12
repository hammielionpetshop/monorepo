import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, requirePermission } from '@/lib/authz'
import { createGroomer, listGroomers } from '@/lib/services/grooming-master-service'
import { groomerNameSchema, groomingMasterErrorResponse, parseJsonBody } from '@/lib/grooming-master-http'

export const dynamic = 'force-dynamic'

const createSchema = z.object({ name: groomerNameSchema, isGroomer: z.boolean().optional(), isCourier: z.boolean().optional() })

// Daftar groomer dibaca siapa pun yang login (kasir memilihnya saat menerima kucing);
// `?active=1` hanya yang aktif; `?role=groomer|courier` hanya yang bertugas itu.
export async function GET(req: NextRequest) {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    const role = req.nextUrl.searchParams.get('role')
    return NextResponse.json(await listGroomers({
      activeOnly: req.nextUrl.searchParams.get('active') === '1',
      role: role === 'groomer' || role === 'courier' ? role : undefined,
    }))
  } catch (error) {
    return groomingMasterErrorResponse(error, 'GET /api/bo/groomers')
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('grooming.groomer.manage')
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, createSchema)
    if (data instanceof NextResponse) return data
    const created = await createGroomer(data, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return groomingMasterErrorResponse(error, 'POST /api/bo/groomers')
  }
}
