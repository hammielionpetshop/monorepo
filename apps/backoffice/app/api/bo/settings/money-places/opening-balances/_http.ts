import { NextResponse } from 'next/server'
import { closedMonthMessage } from '@/lib/db-errors'
import { getAuth } from '@/lib/authz'
import { OPENING_BALANCE_ROLES, OpeningBalanceError } from '@/lib/services/money-place-opening-balance-service'

type Payload = NonNullable<Awaited<ReturnType<typeof getAuth>>>

/** Saldo awal hanya diisi/dibatalkan Owner/GM (spec F2-6 §2), lewat peran. */
export async function requireOpeningBalanceManager(): Promise<Payload | NextResponse> {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!OPENING_BALANCE_ROLES.includes(payload.role)) {
    return NextResponse.json({ error: 'Saldo awal hanya bisa diisi atau dibatalkan Owner dan GM' }, { status: 403 })
  }
  return payload
}

export function openingBalanceErrorResponse(error: unknown, context: string): NextResponse {
  const closedMonth = closedMonthMessage(error)
  if (closedMonth) return NextResponse.json({ error: closedMonth }, { status: 409 })
  if (error instanceof OpeningBalanceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error(`${context} error:`, error)
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 })
}
