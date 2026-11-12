import { NextResponse } from 'next/server'
import { getAuth, hasPermission } from '@/lib/authz'
import { CashCountError, type CashCountActor } from './cash-count-service'

/**
 * Akses Hitung Kas F2-6e-1 (spec docs/work/specs/2026-11-12-f2-6e-hitung-kas-design.md §0 butir 9): catat & lihat =
 * hak `cashflow.record` (Owner/GM/Finance); batal & penyesuaian = peran Owner/GM, tanpa hak baru.
 */

type Payload = NonNullable<Awaited<ReturnType<typeof getAuth>>>

export const CASH_COUNT_MANAGER_ROLES = ['OWNER', 'GM']

export function canManageCashCounts(payload: Payload): boolean {
  return CASH_COUNT_MANAGER_ROLES.includes(payload.role)
}

export function canRecordCashCounts(payload: Payload): boolean {
  return hasPermission(payload, 'cashflow.record') || canManageCashCounts(payload)
}

export function cashCountActorOf(payload: Payload): CashCountActor {
  return { userId: payload.userId, branchId: payload.branchId }
}

/** Sesi + Owner/GM untuk batal & penyesuaian. */
export async function requireCashCountManager(): Promise<Payload | NextResponse> {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canManageCashCounts(payload)) {
    return NextResponse.json({ error: 'Hanya Owner dan GM yang boleh membatalkan atau menyesuaikan Hitung Kas' }, { status: 403 })
  }
  return payload
}

export function cashCountErrorResponse(error: unknown, where: string, fallback: string) {
  if (error instanceof CashCountError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error(`${where} error:`, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
