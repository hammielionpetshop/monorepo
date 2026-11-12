import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { updateRecurringCost } from '@/lib/services/recurring-cost-service'
import { canManageRecurringCosts, costActorOf, costSchema, recurringCostErrorResponse } from '@/lib/recurring-cost-access'

export const dynamic = 'force-dynamic'

const updateSchema = costSchema.extend({ isActive: z.boolean() })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canManageRecurringCosts(payload)) return NextResponse.json({ error: 'Hanya Owner dan GM yang boleh mengatur Biaya Rutin' }, { status: 403 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  try {
    const parsed = updateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    const d = parsed.data
    const updated = await updateRecurringCost(id, { ...d, note: d.note?.trim() || null }, costActorOf(payload))
    return NextResponse.json(updated)
  } catch (error) {
    return recurringCostErrorResponse(error, 'PATCH /api/bo/recurring-costs/[id]', 'Gagal mengubah Biaya Rutin')
  }
}
