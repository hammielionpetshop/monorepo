import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requirePermission } from '@/lib/authz'
import { db } from '@/lib/db'
import {
  parsePriceFile,
  validatePriceRows,
  IMPORT_TIERS,
  type ImportTier,
  type ValidatedRow,
} from '@/lib/services/price-service'
import { createSession } from '@/lib/services/price-import-session'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
export const runtime = 'nodejs'

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB

const TIER_TO_FIELD: Record<ImportTier, string> = {
  RETAIL: 'harga_retail',
  RESELLER: 'harga_reseller',
  GROSIR: 'harga_grosir',
  MEMBER: 'harga_member',
}

type FieldAction = 'insert' | 'update' | 'unchanged'
type FieldDelta = { old: number | null; new: number; action: FieldAction }

function reshapeRow(r: ValidatedRow) {
  const fields: Record<string, FieldDelta | undefined> = {}

  // Modal
  if (r.incomingModal !== null && r.incomingModal !== undefined) {
    const oldVal = r.currentModal
    const action: FieldAction =
      oldVal === null ? 'insert' : oldVal === r.incomingModal ? 'unchanged' : 'update'
    fields.modal = { old: oldVal, new: r.incomingModal, action }
  }

  // Tier prices
  for (const tier of IMPORT_TIERS) {
    const incoming = r.incomingTiers[tier]
    if (incoming === undefined) continue
    const oldVal = r.currentTiers[tier] ?? null
    const action: FieldAction =
      oldVal === null ? 'insert' : oldVal === incoming ? 'unchanged' : 'update'
    fields[TIER_TO_FIELD[tier]] = { old: oldVal, new: incoming, action }
  }

  return {
    rowNumber: r.rowNumber,
    sku: null as string | null, // input SKU tak dibawa di ValidatedRow — sisipkan dari parsed nanti kalau perlu
    namaProduk: null as string | null,
    satuan: null as string | null,
    productId: r.productId,
    productName: r.productName,
    uomCode: r.uomCode,
    status: r.status,
    reason: r.reason ?? undefined,
    fields,
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('master.price.manage')
    if (gate instanceof NextResponse) return gate

    const contentType = req.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type harus multipart/form-data' }, { status: 415 })
    }

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Body form tidak valid' }, { status: 400 })
    }

    const branchIdRaw = form.get('branchId')
    const file = form.get('file')

    if (typeof branchIdRaw !== 'string' || !/^\d+$/.test(branchIdRaw)) {
      return NextResponse.json({ error: 'branchId wajib diisi' }, { status: 400 })
    }
    const branchId = Number(branchIdRaw)

    // `product_prices.branch_id` tidak punya foreign key — branchId ngawur akan
    // membuat baris harga yatim yang tak muncul di cabang mana pun. Tolak di sini.
    const branchRows = await db.execute(sql`
      SELECT id FROM petshop.branches WHERE id = ${branchId} LIMIT 1
    `) as unknown as Array<{ id: number }>
    if (branchRows.length === 0) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'File kosong' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `File terlalu besar (${Math.round(file.size/1024/1024)} MB). Maksimal 20 MB.` }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let parsed
    try {
      parsed = parsePriceFile(buffer, file.name)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'File tidak bisa dibaca'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'File tidak berisi baris data' }, { status: 400 })
    }

    const result = await validatePriceRows(parsed, branchId)

    // Simpan session hanya kalau ada perubahan yang bisa diterapkan
    let sessionId: string | null = null
    if (result.changes.length > 0 || result.costChanges.length > 0) {
      const session = createSession({
        branchId,
        changes: result.changes,
        costChanges: result.costChanges,
        createdBy: gate.userId,
        fileName: file.name,
      })
      sessionId = session.id
    }

    // Tambahkan sku/namaProduk/satuan dari input mentah ke tiap baris untuk konteks UI
    const inputByRow = new Map(parsed.map(p => [p.rowNumber, p]))
    const rows = result.rows.map(r => {
      const shape = reshapeRow(r)
      const src = inputByRow.get(r.rowNumber)
      if (src) {
        shape.sku = src.sku
        shape.namaProduk = src.namaProduk
        shape.satuan = src.satuan
      }
      return shape
    })

    return NextResponse.json({
      sessionId,
      branchId,
      summary: {
        totalRows: result.summary.totalRows,
        insertCount: result.summary.insert,
        updateCount: result.summary.update,
        unchangedCount: result.summary.unchanged,
        rejectedCount: result.summary.rejected,
        priceChangeCount: result.changes.length,
        costChangeCount: result.costChanges.length,
      },
      rows,
      fileName: file.name,
      expiresInSec: 15 * 60,
    })
  } catch (error) {
    console.error('POST /api/bo/master-data/prices/import/preview error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memproses file' }, { status: 500 })
  }
}
