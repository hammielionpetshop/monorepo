import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { updatePet } from '@/lib/services/grooming-master-service'
import { groomingMasterErrorResponse, idParam, parseJsonBody, petFieldSchemas } from '@/lib/grooming-master-http'

export const dynamic = 'force-dynamic'

const updateSchema = z
  .object({
    name: petFieldSchemas.name.optional(),
    species: petFieldSchemas.species.optional(),
    color: petFieldSchemas.color.optional(),
    ageYears: petFieldSchemas.ageYears,
    ageMonths: petFieldSchemas.ageMonths,
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Tidak ada yang diubah' })

// Tidak ada DELETE: kucing hanya bisa dinonaktifkan supaya riwayat groomingnya tetap utuh.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('grooming.pet.manage')
    if (gate instanceof NextResponse) return gate
    const id = idParam.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ID kucing tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, updateSchema)
    if (data instanceof NextResponse) return data
    return NextResponse.json(await updatePet(Number(id.data), data, { userId: gate.userId, branchId: gate.branchId }))
  } catch (error) {
    return groomingMasterErrorResponse(error, 'PATCH /api/bo/pets/[id]')
  }
}
