import { NextRequest, NextResponse } from 'next/server'
import { getAuth, hasPermission } from '@/lib/authz'
import { MoneyTransferError, cancelMoneyTransfer } from '@/lib/services/money-transfer-service'

export const dynamic = 'force-dynamic'

/** Batalkan Pindah Dana (F2-4c): pencatat sendiri di hari yang sama, sesudahnya Owner/GM; alasan wajib. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!hasPermission(payload, 'cashflow.record') && !hasPermission(payload, 'cashflow.cancel')) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }
  const { id } = await params
  const transferId = Number(id)
  if (!Number.isInteger(transferId) || transferId <= 0) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  try {
    const body = (await req.json().catch(() => null)) as { reason?: unknown } | null
    const reason = typeof body?.reason === 'string' ? body.reason : ''
    await cancelMoneyTransfer(transferId, reason, {
      userId: payload.userId,
      isOwner: payload.role === 'OWNER',
      canCancelAny: hasPermission(payload, 'cashflow.cancel'),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof MoneyTransferError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('POST /api/bo/cash-flow/transfers/[id]/cancel error:', error)
    return NextResponse.json({ error: 'Gagal membatalkan Pindah Dana' }, { status: 500 })
  }
}
