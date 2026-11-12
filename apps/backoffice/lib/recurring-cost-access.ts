import { NextResponse } from 'next/server'
import { closedMonthMessage } from '@/lib/db-errors'
import { z } from 'zod'
import { getAuth, hasPermission } from '@/lib/authz'
import { RecurringCostError, type CostActor } from '@/lib/services/recurring-cost-service'

/** Akses & validasi bersama rute/halaman Biaya Rutin F2-5a (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §2). */

type Payload = NonNullable<Awaited<ReturnType<typeof getAuth>>>

/** Pengatur Biaya Rutin lewat peran, tanpa hak baru (tidak perlu keluar-masuk lagi). */
const MANAGE_ROLES = ['OWNER', 'GM']

export function canViewRecurringCosts(payload: Payload): boolean {
  return MANAGE_ROLES.includes(payload.role) || hasPermission(payload, 'cashflow.record') || hasPermission(payload, 'cashflow.cancel')
}

export function canManageRecurringCosts(payload: Payload): boolean {
  return MANAGE_ROLES.includes(payload.role)
}

export function costActorOf(payload: Payload): CostActor {
  return { userId: payload.userId, isOwner: payload.role === 'OWNER', canCancelAny: hasPermission(payload, 'cashflow.cancel') }
}

export function recurringCostErrorResponse(error: unknown, where: string, fallback: string) {
  const closedMonth = closedMonthMessage(error)
  if (closedMonth) return NextResponse.json({ error: closedMonth }, { status: 409 })
  if (error instanceof RecurringCostError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error(`${where} error:`, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export const costSchema = z.object({
  name: z.string({ message: 'Nama wajib diisi' }).trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  categoryId: z.number({ message: 'Kategori wajib dipilih' }).int().positive('Kategori wajib dipilih'),
  // null = Bersama.
  branchId: z.number().int().positive().nullable(),
  dueDay: z.number({ message: 'Tanggal jatuh tempo wajib diisi' }).int().min(1, 'Tanggal jatuh tempo 1–31').max(31, 'Tanggal jatuh tempo 1–31'),
  startMonth: z.string().regex(MONTH_RE, 'Berlaku mulai tidak valid'),
  endMonth: z.string().regex(MONTH_RE, 'Berlaku sampai tidak valid').nullable(),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').nullable().optional(),
})
