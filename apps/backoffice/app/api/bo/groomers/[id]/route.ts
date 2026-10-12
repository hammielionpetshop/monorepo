import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { updateGroomer } from '@/lib/services/grooming-master-service'
import { groomerNameSchema, groomingMasterErrorResponse, idParam, parseJsonBody } from '@/lib/grooming-master-http'

export const dynamic = 'force-dynamic'

const updateSchema = z
  .object({
    name: groomerNameSchema.optional(),
    isActive: z.boolean().optional(),
    isGroomer: z.boolean().optional(),
    isCourier: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Tidak ada yang diubah' })

// Tidak ada DELETE: groomer hanya bisa dinonaktifkan supaya riwayat & bonusnya tetap utuh.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('grooming.groomer.manage')
    if (gate instanceof NextResponse) return gate
    const id = idParam.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ID groomer tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, updateSchema)
    if (data instanceof NextResponse) return data
    return NextResponse.json(await updateGroomer(Number(id.data), data, { userId: gate.userId, branchId: gate.branchId }))
  } catch (error) {
    return groomingMasterErrorResponse(error, 'PATCH /api/bo/groomers/[id]')
  }
}
