import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { db, moneyPlaces, branches, eq, and, ne, asc } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Pilihan "Dibayar dari" di form bayar supplier (F2-4a): Tempat Uang aktif selain Laci kasir. */
export async function GET() {
  const gate = await requirePermission('payable.pay')
  if (gate instanceof NextResponse) return gate
  try {
    const rows = await db
      .select({
        id: moneyPlaces.id,
        name: moneyPlaces.name,
        kind: moneyPlaces.kind,
        branchName: branches.name,
        bankName: moneyPlaces.bankName,
        accountNumber: moneyPlaces.accountNumber,
      })
      .from(moneyPlaces)
      .innerJoin(branches, eq(branches.id, moneyPlaces.branchId))
      .where(and(eq(moneyPlaces.isActive, true), ne(moneyPlaces.kind, 'DRAWER')))
      .orderBy(asc(moneyPlaces.kind), asc(moneyPlaces.sortOrder), asc(moneyPlaces.name))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/bo/supplier-payables/money-places error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar Tempat Uang' }, { status: 500 })
  }
}
