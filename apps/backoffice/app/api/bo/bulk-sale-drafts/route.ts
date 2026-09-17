import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/authz'
import { db, bulkSaleDrafts, desc, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Batas draft per user — mirror MAX_BULK_SALE_DRAFTS yang dulu dipakai di localStorage,
// supaya daftar tunggu tidak menumpuk tanpa ada yang membersihkan.
const MAX_BULK_SALE_DRAFTS = 20

const draftSourceSchema = z.object({
  kind: z.enum(['IBT', 'ORDER']),
  id: z.number(),
  number: z.string(),
  destinationBranchName: z.string().nullable().optional(),
})

// `rows` sengaja tidak divalidasi mendalam per field (sama seperti versi localStorage lama
// yang hanya memastikan array-nya tidak kosong) — draft adalah snapshot form untuk dilanjutkan
// pemiliknya sendiri, bukan data yang langsung dipakai membuat transaksi.
const draftPostSchema = z.object({
  name: z.string().trim().min(1, 'Nama draft wajib diisi').max(100),
  branchId: z.number().int().positive(),
  branchName: z.string(),
  customerId: z.number().int().positive().nullable(),
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  paymentMethodId: z.number(),
  dpMethodId: z.number(),
  amountPaid: z.number(),
  transactionDiscount: z.number(),
  dueAt: z.string(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1, 'Item tidak boleh kosong'),
  grandTotal: z.number(),
  itemCount: z.number(),
  source: draftSourceSchema.nullable(),
})

function rowToDraft(row: { id: number; name: string; payload: unknown; createdAt: Date }) {
  const payload = (row.payload ?? {}) as Record<string, unknown>
  // id di-stringify supaya cocok dengan tipe BulkSaleDraft.id sisi klien (dulu string acak
  // dari localStorage, kini id serial DB — bentuknya berubah, tipenya sengaja dipertahankan).
  return { id: String(row.id), name: row.name, savedAt: row.createdAt, ...payload }
}

export async function GET() {
  try {
    const gate = await requirePermission('transaction.bulk_sale')
    if (gate instanceof NextResponse) return gate

    const rows = await db
      .select()
      .from(bulkSaleDrafts)
      .where(eq(bulkSaleDrafts.createdById, gate.userId))
      .orderBy(desc(bulkSaleDrafts.createdAt))

    return NextResponse.json(rows.map(rowToDraft))
  } catch (err) {
    console.error('GET /api/bo/bulk-sale-drafts error:', err)
    return NextResponse.json({ error: 'Gagal mengambil daftar tunggu bulk sale' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requirePermission('transaction.bulk_sale')
    if (gate instanceof NextResponse) return gate

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const parsed = draftPostSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }

    const { name, ...payload } = parsed.data

    const [created] = await db
      .insert(bulkSaleDrafts)
      .values({ createdById: gate.userId, name, payload })
      .returning()

    // Buang draft tertua milik user ini kalau sudah melewati batas.
    const existing = await db
      .select({ id: bulkSaleDrafts.id })
      .from(bulkSaleDrafts)
      .where(eq(bulkSaleDrafts.createdById, gate.userId))
      .orderBy(desc(bulkSaleDrafts.createdAt))

    const overflowIds = existing.slice(MAX_BULK_SALE_DRAFTS).map((r) => r.id)
    for (const id of overflowIds) {
      await db.delete(bulkSaleDrafts).where(eq(bulkSaleDrafts.id, id))
    }

    return NextResponse.json(rowToDraft(created), { status: 201 })
  } catch (err) {
    console.error('POST /api/bo/bulk-sale-drafts error:', err)
    return NextResponse.json({ error: 'Gagal menyimpan draft bulk sale' }, { status: 500 })
  }
}
