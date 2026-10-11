import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requirePermission } from './authz'
import { getPosBranchId } from './pos-branch'
import { GroomingOrderError } from './services/grooming-order-service'

/** Gerbang rute grooming di kasir: izin + cabang POS yang sedang aktif. */
export async function requireGroomingPos(): Promise<{ userId: number; branchId: number } | NextResponse> {
  const gate = await requirePermission('grooming.order.manage')
  if (gate instanceof NextResponse) return gate
  return { userId: gate.userId, branchId: getPosBranchId(gate, await cookies()) }
}

export function groomingOrderErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof GroomingOrderError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error(`${context} error:`, error)
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 })
}

/** Awal hari WIB (UTC+7) untuk tanggal `YYYY-MM-DD`; null bila formatnya salah. */
export function wibDayStart(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00+07:00`)
  return Number.isNaN(d.getTime()) ? null : d
}
