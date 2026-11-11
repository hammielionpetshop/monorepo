import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, hasPermission } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { proofPhotoUrlSchema } from '@/lib/proof-photo'
import { listOpeningBalances, setOpeningBalance } from '@/lib/services/money-place-opening-balance-service'
import { openingBalanceErrorResponse, requireOpeningBalanceManager } from './_http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  moneyPlaceId: z.number().int().positive('Tempat Uang wajib dipilih'),
  amount: z
    .number({ message: 'Jumlah wajib diisi' })
    .int('Jumlah harus angka bulat')
    .min(0, 'Jumlah tidak boleh minus')
    .max(2_000_000_000, 'Jumlah terlalu besar'),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').nullable().optional(),
  proofPhotoUrl: proofPhotoUrlSchema,
})

export async function GET() {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!hasPermission(payload, 'money_place.read')) {
    return NextResponse.json({ error: 'Tempat Uang hanya untuk Owner, GM, dan Finance' }, { status: 403 })
  }
  try {
    return NextResponse.json(await listOpeningBalances())
  } catch (error) {
    return openingBalanceErrorResponse(error, 'GET /api/bo/settings/money-places/opening-balances')
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireOpeningBalanceManager()
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    const created = await setOpeningBalance(
      { moneyPlaceId: data.moneyPlaceId, amount: data.amount, note: data.note?.trim() || null, proofPhotoUrl: data.proofPhotoUrl ?? null },
      { userId: gate.userId, branchId: gate.branchId },
    )
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return openingBalanceErrorResponse(error, 'POST /api/bo/settings/money-places/opening-balances')
  }
}
