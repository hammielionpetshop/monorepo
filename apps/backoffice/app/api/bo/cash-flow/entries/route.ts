import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, hasPermission } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { proofPhotoUrlSchema } from '@/lib/proof-photo'
import { checkCancel, checkEntry, monthStart } from '@/lib/services/cash-flow-rules'
import { db, cashFlowEntries, cashFlowCategories, moneyPlaces, branches, users, recurringCostPayments, eq, and, desc, gte, lte, isNull } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { createdOnWibSql } from '@/lib/services/cash-flow-sql'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE'], { message: 'Tipe harus pendapatan atau pengeluaran' }),
  categoryId: z.number({ message: 'Kategori wajib dipilih' }).int().positive('Kategori wajib dipilih'),
  amount: z.number({ message: 'Total wajib diisi' }).int('Total harus berupa angka bulat').positive('Total harus lebih dari 0'),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').optional(),
  occurredOn: z.string({ message: 'Tanggal uang wajib diisi' }),
  forMonth: z.string({ message: 'Untuk bulan wajib diisi' }),
  // null = "Bersama" (biaya beberapa cabang; pembagiannya di Finance).
  branchId: z.number().int().positive().nullable(),
  moneyPlaceId: z.number({ message: 'Tempat Uang wajib dipilih' }).int().positive('Tempat Uang wajib dipilih'),
  proofPhotoUrl: proofPhotoUrlSchema,
})

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/


export async function GET(req: NextRequest) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }
    const canRecord = hasPermission(payload, 'cashflow.record')
    const canCancelAny = hasPermission(payload, 'cashflow.cancel')
    const p = req.nextUrl.searchParams

    const conditions = []
    // Pencatat (Owner/GM/Finance) melihat semua cabang; yang lain hanya cabang aktifnya seperti dulu.
    const branchParam = p.get('branch')
    if (!canRecord) conditions.push(eq(cashFlowEntries.branchId, payload.branchId))
    else if (branchParam === 'shared') conditions.push(isNull(cashFlowEntries.branchId))
    else if (branchParam && /^\d+$/.test(branchParam)) conditions.push(eq(cashFlowEntries.branchId, Number(branchParam)))

    const typeParam = p.get('type')
    if (typeParam === 'INCOME' || typeParam === 'EXPENSE') conditions.push(eq(cashFlowEntries.type, typeParam))
    const from = p.get('from')
    if (from && DATE_RE.test(from)) conditions.push(gte(cashFlowEntries.occurredOn, from))
    const to = p.get('to')
    if (to && DATE_RE.test(to)) conditions.push(lte(cashFlowEntries.occurredOn, to))
    const categoryParam = p.get('categoryId')
    if (categoryParam && /^\d+$/.test(categoryParam)) conditions.push(eq(cashFlowEntries.categoryId, Number(categoryParam)))
    const placeParam = p.get('moneyPlaceId')
    if (placeParam === 'unknown') conditions.push(isNull(cashFlowEntries.moneyPlaceId))
    else if (placeParam && /^\d+$/.test(placeParam)) conditions.push(eq(cashFlowEntries.moneyPlaceId, Number(placeParam)))
    if (p.get('includeCancelled') !== '1') conditions.push(isNull(cashFlowEntries.cancelledAt))

    const canceller = alias(users, 'canceller')
    const rows = await db
      .select({
        id: cashFlowEntries.id,
        type: cashFlowEntries.type,
        categoryId: cashFlowEntries.categoryId,
        categoryName: cashFlowCategories.name,
        categoryIsSystem: cashFlowCategories.isSystem,
        reportKind: cashFlowCategories.reportKind,
        amount: cashFlowEntries.amount,
        note: cashFlowEntries.note,
        branchId: cashFlowEntries.branchId,
        branchName: branches.name,
        moneyPlaceId: cashFlowEntries.moneyPlaceId,
        moneyPlaceName: moneyPlaces.name,
        occurredOn: cashFlowEntries.occurredOn,
        forMonth: cashFlowEntries.forMonth,
        proofPhotoUrl: cashFlowEntries.proofPhotoUrl,
        createdBy: cashFlowEntries.createdBy,
        createdByName: users.name,
        createdAt: cashFlowEntries.createdAt,
        createdOn: createdOnWibSql,
        cancelledAt: cashFlowEntries.cancelledAt,
        cancelledByName: canceller.name,
        cancelReason: cashFlowEntries.cancelReason,
        recurringCostId: recurringCostPayments.recurringCostId,
      })
      .from(cashFlowEntries)
      .leftJoin(cashFlowCategories, eq(cashFlowEntries.categoryId, cashFlowCategories.id))
      .leftJoin(users, eq(cashFlowEntries.createdBy, users.id))
      .leftJoin(canceller, eq(cashFlowEntries.cancelledBy, canceller.id))
      .leftJoin(branches, eq(cashFlowEntries.branchId, branches.id))
      .leftJoin(moneyPlaces, eq(cashFlowEntries.moneyPlaceId, moneyPlaces.id))
      .leftJoin(recurringCostPayments, eq(recurringCostPayments.cashFlowEntryId, cashFlowEntries.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(cashFlowEntries.occurredOn), desc(cashFlowEntries.createdAt), desc(cashFlowEntries.id))
      .limit(500)

    const today = todayWibDate()
    const result = rows.map(({ createdOn, recurringCostId, ...r }) => ({
      ...r,
      fromRecurringCost: recurringCostId !== null,
      canCancel:
        checkCancel({
          isCancelled: r.cancelledAt !== null,
          isSystemCategory: (r.categoryIsSystem ?? false) || recurringCostId !== null,
          createdBy: r.createdBy,
          createdOn,
          actorId: payload.userId,
          actorCanCancelAny: canCancelAny,
          today,
        }) === null,
    }))
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/cash-flow/entries error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data transaksi kas' }, { status: 500 })
  }
}

class EntryRuleError extends Error {}

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }
    if (!hasPermission(payload, 'cashflow.record')) {
      return NextResponse.json({ error: 'Hanya Owner, GM, dan Finance yang boleh mencatat Arus Kas' }, { status: 403 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const data = parsed.data
    const note = data.note?.trim() ? data.note.trim() : null

    const created = await db.transaction(async (trx) => {
      const [category] = await trx
        .select({
          type: cashFlowCategories.type,
          isActive: cashFlowCategories.isActive,
          isSystem: cashFlowCategories.isSystem,
          ownerOnly: cashFlowCategories.ownerOnly,
          noteRequired: cashFlowCategories.noteRequired,
        })
        .from(cashFlowCategories)
        .where(eq(cashFlowCategories.id, data.categoryId))
        .limit(1)
      const [place] = await trx
        .select({ kind: moneyPlaces.kind, isActive: moneyPlaces.isActive })
        .from(moneyPlaces)
        .where(eq(moneyPlaces.id, data.moneyPlaceId))
        .limit(1)
      if (data.branchId !== null) {
        const [branch] = await trx.select({ id: branches.id }).from(branches).where(eq(branches.id, data.branchId)).limit(1)
        if (!branch) throw new EntryRuleError('Cabang tidak ditemukan')
      }
      const error = checkEntry({
        type: data.type,
        occurredOn: data.occurredOn,
        forMonth: data.forMonth,
        note,
        category: category ?? null,
        place: place ?? null,
        isOwner: payload.role === 'OWNER',
        today: todayWibDate(),
      })
      if (error) throw new EntryRuleError(error)

      return await trx
        .insert(cashFlowEntries)
        .values({
          type: data.type,
          categoryId: data.categoryId,
          branchId: data.branchId,
          amount: data.amount,
          note,
          occurredOn: data.occurredOn,
          forMonth: monthStart(data.forMonth),
          moneyPlaceId: data.moneyPlaceId,
          proofPhotoUrl: data.proofPhotoUrl ?? null,
          createdBy: payload.userId,
        })
        .returning()
    })

    return NextResponse.json(created[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof EntryRuleError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('POST /api/bo/cash-flow/entries error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan transaksi kas' }, { status: 500 })
  }
}
