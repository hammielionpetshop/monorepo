import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import {
  db, transactions, transactionItems, branches, customers, users,
  eq, and, inArray, desc, sql,
} from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  tier: z.string().regex(/^[A-Z_]+$/, 'Kelas harga tidak valid'),
  branchId: z.string().regex(/^\d+$/).optional(),
})

/**
 * Daftar nota di balik angka "Jml Transaksi" per kelas harga (Laporan Laba Rugi → Penjualan &
 * Laba Kotor per Kelas Harga). Filter sengaja disamakan dengan penghitung tier di
 * report-service (COMPLETED, rentang tanggal WIB, cabang, punya minimal satu baris item kelas
 * harga tsb — COUNT DISTINCT transaksi), supaya jumlah baris popup = angka yang diklik.
 */
export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
    }
    const { startDate, endDate, tier, branchId } = parsed.data
    if (startDate > endDate) {
      return NextResponse.json({ error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai' }, { status: 400 })
    }

    const branchFilter = branchId != null ? eq(transactions.branchId, Number(branchId)) : undefined

    const rows = await db
      .selectDistinct({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        createdAt: transactions.createdAt,
        cashierId: transactions.cashierId,
        customerId: transactions.customerId,
        branchId: transactions.branchId,
        payableAmount: transactions.payableAmount,
      })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
      .where(
        and(
          eq(transactions.status, 'COMPLETED'),
          eq(transactionItems.priceTier, tier),
          sql`(${transactions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${startDate}::date`,
          sql`(${transactions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${endDate}::date`,
          branchFilter,
        )
      )
      .orderBy(desc(transactions.createdAt))

    const customerIds = [...new Set(rows.map((r) => r.customerId).filter((v): v is number => v != null))]
    const cashierIds = [...new Set(rows.map((r) => r.cashierId))]
    const branchIds = [...new Set(rows.map((r) => r.branchId))]

    const [customerRows, cashierRows, branchRows] = await Promise.all([
      customerIds.length > 0
        ? db.select({ id: customers.id, name: customers.name }).from(customers).where(inArray(customers.id, customerIds))
        : Promise.resolve([] as { id: number; name: string }[]),
      cashierIds.length > 0
        ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, cashierIds))
        : Promise.resolve([] as { id: number; name: string }[]),
      branchIds.length > 0
        ? db.select({ id: branches.id, name: branches.name }).from(branches).where(inArray(branches.id, branchIds))
        : Promise.resolve([] as { id: number; name: string }[]),
    ])

    const customerMap = Object.fromEntries(customerRows.map((c) => [c.id, c.name]))
    const cashierMap = Object.fromEntries(cashierRows.map((u) => [u.id, u.name]))
    const branchMap = Object.fromEntries(branchRows.map((b) => [b.id, b.name]))

    const items = rows.map((r) => ({
      id: r.id,
      trxNumber: r.trxNumber,
      createdAt: r.createdAt,
      cashierName: cashierMap[r.cashierId] ?? null,
      customerName: r.customerId != null ? (customerMap[r.customerId] ?? null) : null,
      branchName: branchMap[r.branchId] ?? null,
      payableAmount: Number(r.payableAmount),
    }))

    return NextResponse.json({ transactions: items })
  } catch (error: unknown) {
    console.error('[bo/reports/profit-loss/tier-transactions] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar transaksi kelas harga' }, { status: 500 })
  }
}
