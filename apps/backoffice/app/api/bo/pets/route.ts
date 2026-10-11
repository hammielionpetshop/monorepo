import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { createPet, listPets } from '@/lib/services/grooming-master-service'
import { groomingMasterErrorResponse, newOwnerSchema, parseJsonBody, petFieldSchemas } from '@/lib/grooming-master-http'

export const dynamic = 'force-dynamic'

const createSchema = z
  .object({
    ...petFieldSchemas,
    customerId: z.number().int().positive().nullable().optional(),
    newOwner: newOwnerSchema.nullable().optional(),
  })
  .refine((v) => (v.ageYears ?? 0) > 0 || (v.ageMonths ?? 0) > 0, { message: 'Umur kucing wajib diisi (tahun atau bulan)' })
  .refine((v) => Boolean(v.customerId) !== Boolean(v.newOwner), { message: 'Pilih pemilik yang sudah terdaftar atau daftarkan pemilik baru' })

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePermission('grooming.pet.manage')
    if (gate instanceof NextResponse) return gate
    const { searchParams } = req.nextUrl
    const customerId = searchParams.get('customerId')
    return NextResponse.json(await listPets({
      q: searchParams.get('q') ?? undefined,
      customerId: customerId && /^\d+$/.test(customerId) ? Number(customerId) : undefined,
      activeOnly: searchParams.get('active') === '1',
    }))
  } catch (error) {
    return groomingMasterErrorResponse(error, 'GET /api/bo/pets')
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('grooming.pet.manage')
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, createSchema)
    if (data instanceof NextResponse) return data
    const created = await createPet(data, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return groomingMasterErrorResponse(error, 'POST /api/bo/pets')
  }
}
