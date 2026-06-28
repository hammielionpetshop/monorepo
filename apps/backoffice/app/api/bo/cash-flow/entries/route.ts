import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, cashFlowEntries, cashFlowCategories, users, eq, and, desc } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE'], { message: 'Tipe harus pendapatan atau pengeluaran' }),
  categoryId: z.number({ message: 'Kategori wajib dipilih' }).int().positive('Kategori wajib dipilih'),
  amount: z.number({ message: 'Total wajib diisi' }).int('Total harus berupa angka bulat').positive('Total harus lebih dari 0'),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').optional(),
})

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const typeParam = req.nextUrl.searchParams.get('type')
    const conditions = [eq(cashFlowEntries.branchId, payload.branchId)]
    if (typeParam === 'INCOME' || typeParam === 'EXPENSE') {
      conditions.push(eq(cashFlowEntries.type, typeParam))
    }

    const result = await db
      .select({
        id: cashFlowEntries.id,
        type: cashFlowEntries.type,
        categoryId: cashFlowEntries.categoryId,
        categoryName: cashFlowCategories.name,
        amount: cashFlowEntries.amount,
        note: cashFlowEntries.note,
        createdBy: cashFlowEntries.createdBy,
        createdByName: users.name,
        createdAt: cashFlowEntries.createdAt,
      })
      .from(cashFlowEntries)
      .leftJoin(cashFlowCategories, eq(cashFlowEntries.categoryId, cashFlowCategories.id))
      .leftJoin(users, eq(cashFlowEntries.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(cashFlowEntries.createdAt))
      .limit(200)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/cash-flow/entries error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data transaksi kas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
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

    const created = await db.transaction(async (trx) => {
      const category = await trx
        .select({ id: cashFlowCategories.id, type: cashFlowCategories.type })
        .from(cashFlowCategories)
        .where(eq(cashFlowCategories.id, parsed.data.categoryId))
        .limit(1)
      if (category.length === 0) throw new Error('CATEGORY_NOT_FOUND')
      if (category[0].type !== parsed.data.type) throw new Error('TYPE_MISMATCH')

      return await trx
        .insert(cashFlowEntries)
        .values({
          type: parsed.data.type,
          categoryId: parsed.data.categoryId,
          branchId: payload.branchId,
          amount: parsed.data.amount,
          note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
          createdBy: payload.userId,
        })
        .returning()
    })

    return NextResponse.json(created[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'CATEGORY_NOT_FOUND') {
        return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 400 })
      }
      if (error.message === 'TYPE_MISMATCH') {
        return NextResponse.json({ error: 'Kategori tidak sesuai dengan tipe yang dipilih' }, { status: 400 })
      }
    }
    console.error('POST /api/bo/cash-flow/entries error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan transaksi kas' }, { status: 500 })
  }
}
