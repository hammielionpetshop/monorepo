import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/authz'
import { db, bulkSaleDrafts, desc, eq, users } from '@/lib/db'

import { canSeeAllBranches, draftBranchFilter } from './scope'

export const dynamic = 'force-dynamic'

// Batas draft per penahan — mirror MAX_BULK_SALE_DRAFTS yang dulu dipakai di localStorage,
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

function rowToDraft(row: {
  id: number
  name: string
  payload: unknown
  createdAt: Date
  createdByName?: string | null
}) {
  const payload = (row.payload ?? {}) as Record<string, unknown>
  // id di-stringify supaya cocok dengan tipe BulkSaleDraft.id sisi klien (dulu string acak
  // dari localStorage, kini id serial DB — bentuknya berubah, tipenya sengaja dipertahankan).
  return {
    ...payload,
    id: String(row.id),
    name: row.name,
    savedAt: row.createdAt,
    createdByName: row.createdByName ?? null,
  }
}

export async function GET() {
  try {
    const gate = await requirePermission('transaction.bulk_sale')
    if (gate instanceof NextResponse) return gate

    // Dibagi per cabang (seperti Daftar Tunggu POS), bukan per user: draf yang ditahan satu
    // orang harus bisa dilanjutkan/dibersihkan rekan secabang, karena barangnya ikut menahan
    // stok cabang itu (lihat lib/services/stock-reservation.ts).
    const rows = await db
      .select({
        id: bulkSaleDrafts.id,
        name: bulkSaleDrafts.name,
        payload: bulkSaleDrafts.payload,
        createdAt: bulkSaleDrafts.createdAt,
        createdByName: users.name,
      })
      .from(bulkSaleDrafts)
      .leftJoin(users, eq(users.id, bulkSaleDrafts.createdById))
      .where(draftBranchFilter(gate))
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

    // Draf terlihat oleh seluruh cabangnya, jadi cabangnya harus cabang sesi penahan —
    // bukan nilai bebas dari body.
    if (!canSeeAllBranches(gate) && payload.branchId !== gate.branchId) {
      return NextResponse.json({ error: 'Cabang draf tidak sesuai dengan sesi' }, { status: 403 })
    }

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

    return NextResponse.json(rowToDraft({ ...created, createdByName: gate.userName ?? null }), { status: 201 })
  } catch (err) {
    console.error('POST /api/bo/bulk-sale-drafts error:', err)
    return NextResponse.json({ error: 'Gagal menyimpan draft bulk sale' }, { status: 500 })
  }
}
