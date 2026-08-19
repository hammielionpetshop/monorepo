import { sql } from 'drizzle-orm'
import Big from 'big.js'
import * as XLSX from 'xlsx'
import { db, productPrices, productUomCosts, auditLogs, eq, and } from '@/lib/db'
import type { PriceTier } from '@petshop/shared'

// -------------------- Konstanta & Tipe --------------------

export const MAX_PRICE = new Big('9999999999')
export const MAX_IMPORT_ROWS = 50_000
export const APPLY_CHUNK_SIZE = 500

// Batas jumlah field yang detailnya ditulis ke audit_logs. Impor besar tetap tercatat
// (ringkasan + penanda truncated), tanpa menaruh JSON puluhan MB di satu baris.
export const AUDIT_DETAIL_LIMIT = 2000

// Siapa yang mengubah harga, untuk jejak audit. Tanpa ini `product_prices` tidak
// menyimpan apa pun soal riwayat — tidak ada updated_at, tidak ada trigger — sehingga
// pertanyaan "siapa yang mengembalikan harga ini" tak bisa dijawab.
export interface PriceMutationActor {
  userId: number
  source: 'MANUAL' | 'IMPORT'
  fileName?: string | null
}

export interface CurrentValueMap {
  priceByKey: Map<string, number>
  costByKey: Map<string, number>
}

type PriceMutationTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Layout XLSX/CSV. WIDE. Konsisten dengan tier yang di-expose di UI.
// Kolom `kategori` hanya ada di export supaya tim gampang filter — di-ignore saat import.
export const IMPORT_TIERS = ['RETAIL', 'RESELLER', 'GROSIR', 'MEMBER'] as const
export type ImportTier = typeof IMPORT_TIERS[number]

const TIER_TO_COLUMN: Record<ImportTier, string> = {
  RETAIL: 'harga_retail',
  RESELLER: 'harga_reseller',
  GROSIR: 'harga_grosir',
  MEMBER: 'harga_member',
}

export const EXPORT_COLUMNS = [
  'sku',
  'nama_produk',
  'kategori',
  'satuan',
  'modal',
  'harga_retail',
  'harga_reseller',
  'harga_grosir',
  'harga_member',
] as const

export interface PriceChange {
  productId: number
  uomId: number
  tierType: PriceTier
  price: number
}

export interface CostChange {
  productId: number
  uomId: number
  costPrice: number
}

export interface ExportRow {
  sku: string | null
  nama_produk: string
  kategori: string | null
  satuan: string
  modal: number | null
  harga_retail: number | null
  harga_reseller: number | null
  harga_grosir: number | null
  harga_member: number | null
}

export interface ParsedRow {
  rowNumber: number  // 1-based row di spreadsheet (header = 1, data mulai 2)
  sku: string | null
  namaProduk: string | null
  satuan: string | null
  modal: number | null
  tiers: Partial<Record<ImportTier, number>>
}

export type RowStatus = 'insert' | 'update' | 'unchanged' | 'rejected'

export interface ValidatedRow {
  rowNumber: number
  status: RowStatus
  reason: string | null
  productId: number | null
  productName: string | null
  uomId: number | null
  uomCode: string | null
  changes: PriceChange[]      // subset yang benar-benar berubah
  costChange: CostChange | null
  currentModal: number | null
  currentTiers: Partial<Record<ImportTier, number>>
  incomingModal: number | null
  incomingTiers: Partial<Record<ImportTier, number>>
}

export interface ValidationResult {
  branchId: number
  rows: ValidatedRow[]
  summary: {
    totalRows: number
    insert: number
    update: number
    unchanged: number
    rejected: number
    fieldsToApply: number
  }
  changes: PriceChange[]
  costChanges: CostChange[]
}

// -------------------- Helpers --------------------

function normName(s: string | null | undefined): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
}

function normCode(s: string | null | undefined): string {
  return String(s ?? '').trim().toUpperCase()
}

function parseIntCell(v: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === null || v === undefined || v === '') return { ok: true, value: null }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { ok: false, error: 'bukan angka' }
    if (Math.trunc(v) !== v) return { ok: false, error: 'harus bilangan bulat' }
    return { ok: true, value: v }
  }
  const s = String(v).trim()
  if (s === '' || s === '-') return { ok: true, value: null }
  // ponytail: hanya angka + separator ribuan (. atau ,) + minus opsional; huruf apapun langsung tolak
  if (!/^-?[\d.,]+$/.test(s)) return { ok: false, error: 'bukan angka' }
  const stripped = s.replace(/[.,]/g, '')
  const n = Number(stripped)
  if (!Number.isFinite(n)) return { ok: false, error: 'bukan angka' }
  const int = Math.trunc(n)
  if (int !== n) return { ok: false, error: 'harus bilangan bulat' }
  return { ok: true, value: int }
}

// -------------------- Extract dari route (dipakai PUT existing juga) --------------------

interface InvalidUomRow { product_name: string; uom_code: string }

export async function findUomWithoutConversion(
  pairs: { productId: number; uomId: number }[],
): Promise<{ productName: string; uomCode: string } | null> {
  if (pairs.length === 0) return null

  const uniq = new Map<string, { productId: number; uomId: number }>()
  for (const p of pairs) uniq.set(`${p.productId}:${p.uomId}`, p)
  const list = [...uniq.values()]

  const values = sql.join(
    list.map(p => sql`(${p.productId}::int, ${p.uomId}::int)`),
    sql`, `,
  )

  const rows = await db.execute(sql`
    SELECT pr.name AS product_name, u.code AS uom_code
    FROM (VALUES ${values}) AS v(product_id, uom_id)
    JOIN petshop.products pr ON pr.id = v.product_id
    JOIN petshop.units_of_measure u ON u.id = v.uom_id
    WHERE v.uom_id <> pr.base_uom_id
      AND NOT EXISTS (
        SELECT 1 FROM petshop.product_uom_conversions c
        WHERE c.product_id = v.product_id AND c.uom_id = v.uom_id
      )
    LIMIT 1
  `) as unknown as InvalidUomRow[]

  const row = rows[0]
  return row ? { productName: row.product_name, uomCode: row.uom_code } : null
}

// Terapkan bulk changes dalam SATU transaksi — semua berhasil atau tidak sama sekali.
// Chunking ada di dalam transaksi, bukan di caller: satu INSERT dengan 50.000 baris
// menembus batas 65.535 parameter Postgres, sementara caller yang memanggil fungsi ini
// per chunk akan meninggalkan impor separuh jadi kalau chunk ke-3 gagal.
// Throw Error dengan message untuk dilempar caller sebagai NextResponse.
export interface PriceDelete {
  productId: number
  uomId: number
  tierType: PriceTier
}

export async function applyPriceBulk(input: {
  branchId: number
  changes: PriceChange[]
  costChanges: CostChange[]
  deletes?: PriceDelete[]
  actor?: PriceMutationActor | null
}): Promise<{ updated: number }> {
  const { branchId, changes, costChanges, actor } = input
  const deletes = input.deletes ?? []
  if (changes.length === 0 && costChanges.length === 0 && deletes.length === 0) return { updated: 0 }

  for (const c of changes) {
    if (new Big(c.price).gt(MAX_PRICE)) {
      throw new Error('Harga melebihi batas maksimum yang diizinkan')
    }
  }
  for (const c of costChanges) {
    if (new Big(c.costPrice).gt(MAX_PRICE)) {
      throw new Error('Harga modal melebihi batas maksimum yang diizinkan')
    }
  }

  const invalidPair = await findUomWithoutConversion([...changes, ...costChanges])
  if (invalidPair) {
    throw new Error(
      `Satuan ${invalidPair.uomCode} pada produk "${invalidPair.productName}" belum punya konversi ke satuan dasar. Isi kolom Konversi dulu sebelum menyimpan harga.`,
    )
  }

  await db.transaction(async (tx) => {
    // Nilai sebelum ditimpa, dibaca di dalam transaksi yang sama supaya jejaknya
    // benar-benar mencerminkan apa yang berubah, bukan snapshot yang sudah basi.
    const before = actor ? await readCurrentValues(tx, branchId, [...changes, ...deletes], costChanges) : null

    for (let i = 0; i < changes.length; i += APPLY_CHUNK_SIZE) {
      const chunk = changes.slice(i, i + APPLY_CHUNK_SIZE)
      await tx
        .insert(productPrices)
        .values(chunk.map(c => ({
          productId: c.productId,
          branchId,
          uomId: c.uomId,
          tierType: c.tierType,
          price: c.price,
        })))
        .onConflictDoUpdate({
          target: [productPrices.productId, productPrices.branchId, productPrices.uomId, productPrices.tierType],
          set: { price: sql`excluded.price` },
        })
    }

    for (let i = 0; i < costChanges.length; i += APPLY_CHUNK_SIZE) {
      const chunk = costChanges.slice(i, i + APPLY_CHUNK_SIZE)
      await tx
        .insert(productUomCosts)
        .values(chunk.map(c => ({
          productId: c.productId,
          branchId,
          uomId: c.uomId,
          costPrice: c.costPrice,
        })))
        .onConflictDoUpdate({
          target: [productUomCosts.productId, productUomCosts.branchId, productUomCosts.uomId],
          set: { costPrice: sql`excluded.cost_price` },
        })
    }

    // Hapus satu-satu — dipakai editor per-produk dengan paling banyak beberapa
    // UOM × tier, jauh di bawah APPLY_CHUNK_SIZE, jadi chunking tidak perlu.
    for (const d of deletes) {
      await tx
        .delete(productPrices)
        .where(and(
          eq(productPrices.productId, d.productId),
          eq(productPrices.branchId, branchId),
          eq(productPrices.uomId, d.uomId),
          eq(productPrices.tierType, d.tierType),
        ))
    }

    if (actor && before) {
      await tx.insert(auditLogs).values(
        buildPriceAuditEntry({ branchId, changes, costChanges, deletes, actor, before }),
      )
    }
  })

  return { updated: changes.length + costChanges.length + deletes.length }
}

// Baca harga & modal yang berlaku sekarang untuk pasangan yang akan ditimpa/dihapus.
// Dipakai hanya untuk isi kolom old_data di audit_logs.
async function readCurrentValues(
  tx: PriceMutationTx,
  branchId: number,
  changes: { productId: number; uomId: number }[],
  costChanges: CostChange[],
): Promise<CurrentValueMap> {
  const priceByKey = new Map<string, number>()
  const costByKey = new Map<string, number>()

  const pricePairs = uniquePairs(changes)
  for (let i = 0; i < pricePairs.length; i += APPLY_CHUNK_SIZE) {
    const chunk = pricePairs.slice(i, i + APPLY_CHUNK_SIZE)
    const values = sql.join(chunk.map(p => sql`(${p.productId}::int, ${p.uomId}::int)`), sql`, `)
    const rows = await tx.execute(sql`
      SELECT pp.product_id, pp.uom_id, pp.tier_type, pp.price
      FROM petshop.product_prices pp
      JOIN (VALUES ${values}) AS v(product_id, uom_id)
        ON v.product_id = pp.product_id AND v.uom_id = pp.uom_id
      WHERE pp.branch_id = ${branchId}
    `) as unknown as Array<{ product_id: number; uom_id: number; tier_type: string; price: number }>
    for (const r of rows) priceByKey.set(`${r.product_id}:${r.uom_id}:${r.tier_type}`, r.price)
  }

  const costPairs = uniquePairs(costChanges)
  for (let i = 0; i < costPairs.length; i += APPLY_CHUNK_SIZE) {
    const chunk = costPairs.slice(i, i + APPLY_CHUNK_SIZE)
    const values = sql.join(chunk.map(p => sql`(${p.productId}::int, ${p.uomId}::int)`), sql`, `)
    const rows = await tx.execute(sql`
      SELECT pc.product_id, pc.uom_id, pc.cost_price
      FROM petshop.product_uom_costs pc
      JOIN (VALUES ${values}) AS v(product_id, uom_id)
        ON v.product_id = pc.product_id AND v.uom_id = pc.uom_id
      WHERE pc.branch_id = ${branchId}
    `) as unknown as Array<{ product_id: number; uom_id: number; cost_price: number }>
    for (const r of rows) costByKey.set(`${r.product_id}:${r.uom_id}`, r.cost_price)
  }

  return { priceByKey, costByKey }
}

function uniquePairs(items: { productId: number; uomId: number }[]): { productId: number; uomId: number }[] {
  const uniq = new Map<string, { productId: number; uomId: number }>()
  for (const it of items) uniq.set(`${it.productId}:${it.uomId}`, { productId: it.productId, uomId: it.uomId })
  return [...uniq.values()]
}

// Satu baris audit per aksi, bukan per harga: impor 900 harga tidak boleh membanjiri
// tabel audit. Detail per-field dipotong di AUDIT_DETAIL_LIMIT — ringkasannya tetap
// utuh, jadi jumlah yang berubah selalu benar walau daftarnya terpotong.
export function buildPriceAuditEntry(input: {
  branchId: number
  changes: PriceChange[]
  costChanges: CostChange[]
  deletes?: PriceDelete[]
  actor: PriceMutationActor
  before: CurrentValueMap
}) {
  const { branchId, changes, costChanges, actor, before } = input
  const deletes = input.deletes ?? []
  const truncated = changes.length + costChanges.length + deletes.length > AUDIT_DETAIL_LIMIT
  const priceDetail = changes.slice(0, AUDIT_DETAIL_LIMIT)
  const costDetail = costChanges.slice(0, Math.max(0, AUDIT_DETAIL_LIMIT - priceDetail.length))
  const deleteDetail = deletes.slice(0, Math.max(0, AUDIT_DETAIL_LIMIT - priceDetail.length - costDetail.length))

  return {
    branchId,
    userId: actor.userId,
    action: actor.source === 'IMPORT' ? 'PRICE_IMPORT' : 'PRICE_BULK_UPDATE',
    tableName: 'product_prices',
    recordId: `branch:${branchId}`,
    oldData: JSON.stringify({
      prices: priceDetail.map(c => ({
        p: c.productId,
        u: c.uomId,
        t: c.tierType,
        v: before.priceByKey.get(`${c.productId}:${c.uomId}:${c.tierType}`) ?? null,
      })),
      costs: costDetail.map(c => ({
        p: c.productId,
        u: c.uomId,
        v: before.costByKey.get(`${c.productId}:${c.uomId}`) ?? null,
      })),
      deletes: deleteDetail.map(d => ({
        p: d.productId,
        u: d.uomId,
        t: d.tierType,
        v: before.priceByKey.get(`${d.productId}:${d.uomId}:${d.tierType}`) ?? null,
      })),
      truncated,
    }),
    newData: JSON.stringify({
      source: actor.source,
      fileName: actor.fileName ?? null,
      summary: { priceCount: changes.length, costCount: costChanges.length, deleteCount: deletes.length },
      prices: priceDetail.map(c => ({ p: c.productId, u: c.uomId, t: c.tierType, v: c.price })),
      costs: costDetail.map(c => ({ p: c.productId, u: c.uomId, v: c.costPrice })),
      deletes: deleteDetail.map(d => ({ p: d.productId, u: d.uomId, t: d.tierType, v: null })),
      truncated,
    }),
  }
}

// -------------------- Export --------------------

interface RawExportRow {
  sku: string | null
  product_name: string
  category_name: string | null
  uom_code: string
  cost_price: number | null
  prices: Record<string, number> | null
}

export async function getPricesForExport(filter: {
  branchId: number
  categoryId?: number | null
  search?: string | null
}): Promise<ExportRow[]> {
  const { branchId } = filter
  const categoryId = filter.categoryId ?? null
  const search = filter.search?.trim() || null

  const whereCategory = categoryId !== null ? sql`AND p.category_id = ${categoryId}` : sql``
  const whereSearch = search ? sql`AND p.name ILIKE ${'%' + search + '%'}` : sql``

  // Baris export = satuan dasar produk + satuan lain yang punya harga di cabang ini.
  // Sama seperti GET listing tapi tanpa paginasi.
  const rows = await db.execute(sql`
    WITH filtered_products AS (
      SELECT p.id, p.sku, p.name, p.base_uom_id, p.category_id
      FROM petshop.products p
      WHERE p.is_active = true ${whereCategory} ${whereSearch}
    ),
    pairs AS (
      SELECT fp.id AS product_id, fp.base_uom_id AS uom_id FROM filtered_products fp
      UNION
      SELECT fp.id, pp.uom_id
      FROM filtered_products fp
      JOIN petshop.product_prices pp ON pp.product_id = fp.id AND pp.branch_id = ${branchId}
      UNION
      SELECT fp.id, puc.uom_id
      FROM filtered_products fp
      JOIN petshop.product_uom_costs puc ON puc.product_id = fp.id AND puc.branch_id = ${branchId}
    )
    SELECT
      fp.sku            AS sku,
      fp.name           AS product_name,
      c.name            AS category_name,
      u.code            AS uom_code,
      pc.cost_price     AS cost_price,
      COALESCE(
        json_object_agg(pp.tier_type, pp.price) FILTER (WHERE pp.tier_type IS NOT NULL),
        '{}'::json
      ) AS prices
    FROM pairs pr
    JOIN filtered_products fp ON fp.id = pr.product_id
    JOIN petshop.units_of_measure u ON u.id = pr.uom_id
    LEFT JOIN petshop.categories c ON c.id = fp.category_id
    LEFT JOIN petshop.product_uom_costs pc
      ON pc.product_id = pr.product_id AND pc.uom_id = pr.uom_id AND pc.branch_id = ${branchId}
    LEFT JOIN petshop.product_prices pp
      ON pp.product_id = pr.product_id AND pp.uom_id = pr.uom_id AND pp.branch_id = ${branchId}
    GROUP BY fp.sku, fp.name, c.name, u.code, pc.cost_price, (pr.uom_id <> fp.base_uom_id)
    ORDER BY fp.name, (pr.uom_id <> fp.base_uom_id), u.code
  `) as unknown as RawExportRow[]

  return rows.map(r => {
    const prices = r.prices ?? {}
    return {
      sku: r.sku,
      nama_produk: r.product_name,
      kategori: r.category_name,
      satuan: r.uom_code,
      modal: r.cost_price ?? null,
      harga_retail: prices.RETAIL ?? null,
      harga_reseller: prices.RESELLER ?? null,
      harga_grosir: prices.GROSIR ?? null,
      harga_member: prices.MEMBER ?? null,
    }
  })
}

// -------------------- Format export --------------------

// Sel yang diawali = + - @ diperlakukan Excel sebagai rumus, bukan teks — nama produk
// seperti "=cmd|..." akan dieksekusi saat file dibuka. Diberi awalan apostrof, sama
// seperti export laporan lain di app ini. parsePriceFile membuang apostrof itu lagi
// supaya file hasil export tetap bisa diimpor balik apa adanya.
function escapeCsvCell(v: string | number | null): string {
  if (v === null || v === undefined) return ''
  const raw = String(v)
  const s = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowsToCsv(rows: ExportRow[]): string {
  const header = EXPORT_COLUMNS.join(',')
  const body = rows.map(r =>
    EXPORT_COLUMNS.map(col => escapeCsvCell((r as unknown as Record<string, string | number | null>)[col])).join(','),
  )
  return [header, ...body].join('\n') + '\n'
}

export function rowsToXlsxBuffer(rows: ExportRow[]): Buffer {
  const aoa: (string | number | null)[][] = [
    [...EXPORT_COLUMNS],
    ...rows.map(r => EXPORT_COLUMNS.map(col => (r as unknown as Record<string, string | number | null>)[col])),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}

// -------------------- Parse import --------------------

// Sel teks: kosong jadi null, dan apostrof pembuka yang dipasang escapeCsvCell
// (pengaman rumus Excel) dibuang lagi supaya file hasil export bisa langsung diimpor.
function textCell(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim().replace(/^'(?=[=+\-@])/, '')
  return s === '' ? null : s
}

// Ambil rows sebagai array of objects dengan header lowercase. Support xlsx & csv.
// Throw Error dengan pesan Indonesia kalau file tidak bisa dibaca.
export function parsePriceFile(buffer: Buffer, fileName: string): ParsedRow[] {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  let wb: XLSX.WorkBook
  try {
    if (ext === 'csv') {
      const text = buffer.toString('utf-8').replace(/^\uFEFF/, '')
      wb = XLSX.read(text, { type: 'string' })
    } else if (ext === 'xlsx' || ext === 'xls') {
      wb = XLSX.read(buffer, { type: 'buffer' })
    } else {
      throw new Error(`Format file tidak didukung: .${ext}. Gunakan .xlsx atau .csv`)
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Format file')) throw e
    throw new Error('File tidak bisa dibaca. Pastikan file XLSX atau CSV yang valid.')
  }

  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('File tidak berisi sheet apapun')
  const ws = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
  })

  if (raw.length === 0) return []
  if (raw.length > MAX_IMPORT_ROWS) {
    throw new Error(`File terlalu besar (${raw.length} baris). Maksimal ${MAX_IMPORT_ROWS.toLocaleString('id-ID')} baris per file.`)
  }

  // Normalisasi key ke lowercase + parsing angka per-cell (marker NaN untuk invalid,
  // validator baca dan reject baris tersebut).
  return raw.map((row, idx) => {
    const norm: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      norm[k.toLowerCase().trim()] = v
    }

    const modalRes = parseIntCell(norm.modal)
    const modal: number | null = modalRes.ok ? modalRes.value : Number.NaN

    const tiers: Partial<Record<ImportTier, number>> = {}
    let cellError = false
    for (const tier of IMPORT_TIERS) {
      const col = TIER_TO_COLUMN[tier]
      const res = parseIntCell(norm[col])
      if (!res.ok) {
        cellError = true
        continue
      }
      if (res.value !== null) tiers[tier] = res.value
    }

    const base: ParsedRow & { _tierError?: boolean } = {
      rowNumber: idx + 2, // +1 header, +1 karena 1-based
      sku: textCell(norm.sku),
      namaProduk: textCell(norm.nama_produk),
      satuan: textCell(norm.satuan),
      modal,
      tiers,
    }
    if (cellError) base._tierError = true
    return base
  })
}

// -------------------- Validate --------------------

interface ProductLookup {
  id: number
  sku: string | null
  name: string
  baseUomId: number
}

interface UomLookup {
  id: number
  code: string
}

interface CurrentStateRow {
  product_id: number
  uom_id: number
  tier_type: string | null
  price: number | null
  cost_price: number | null
}

export async function validatePriceRows(
  parsed: ParsedRow[],
  branchId: number,
): Promise<ValidationResult> {
  // 1. Load master data yang dipakai
  const skus = new Set<string>()
  const names = new Set<string>()
  const uomCodes = new Set<string>()
  for (const r of parsed) {
    if (r.sku) skus.add(r.sku)
    if (r.namaProduk) names.add(normName(r.namaProduk))
    if (r.satuan) uomCodes.add(normCode(r.satuan))
  }

  const [productsRows, uomsRows] = await Promise.all([
    db.execute(sql`
      SELECT id, sku, name, base_uom_id
      FROM petshop.products
      WHERE is_active = true
    `) as unknown as Promise<Array<{ id: number; sku: string | null; name: string; base_uom_id: number }>>,
    db.execute(sql`
      SELECT id, code FROM petshop.units_of_measure
    `) as unknown as Promise<Array<{ id: number; code: string }>>,
  ])

  const products: ProductLookup[] = productsRows.map(p => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    baseUomId: p.base_uom_id,
  }))
  const uoms: UomLookup[] = uomsRows.map(u => ({ id: u.id, code: u.code }))

  // Index
  const bySku = new Map<string, ProductLookup>()
  const byName = new Map<string, ProductLookup[]>()
  for (const p of products) {
    if (p.sku) bySku.set(p.sku, p)
    const nk = normName(p.name)
    const arr = byName.get(nk) ?? []
    arr.push(p)
    byName.set(nk, arr)
  }

  const uomByCode = new Map<string, UomLookup>()
  for (const u of uoms) uomByCode.set(normCode(u.code), u)

  // 2. Prevalidasi & resolve
  type PreRow = {
    parsed: ParsedRow
    product: ProductLookup | null
    uom: UomLookup | null
    reason: string | null
    tierError: boolean
  }

  const pre: PreRow[] = parsed.map(r => {
    if ((r as ParsedRow & { _tierError?: boolean })._tierError || Number.isNaN(r.modal)) {
      return { parsed: r, product: null, uom: null, reason: 'nilai angka tidak valid (harus bilangan bulat)', tierError: true }
    }
    if (!r.satuan) return { parsed: r, product: null, uom: null, reason: 'kolom "satuan" kosong', tierError: false }
    const uom = uomByCode.get(normCode(r.satuan))
    if (!uom) return { parsed: r, product: null, uom: null, reason: `satuan "${r.satuan}" tidak dikenal`, tierError: false }

    // match: SKU dulu, fallback nama
    let product: ProductLookup | null = null
    if (r.sku) {
      product = bySku.get(r.sku) ?? null
      if (!product) return { parsed: r, product: null, uom, reason: `SKU "${r.sku}" tidak ditemukan`, tierError: false }
    } else if (r.namaProduk) {
      const matches = byName.get(normName(r.namaProduk)) ?? []
      if (matches.length === 0) return { parsed: r, product: null, uom, reason: `Produk "${r.namaProduk}" tidak ditemukan`, tierError: false }
      if (matches.length > 1) return { parsed: r, product: null, uom, reason: `Nama "${r.namaProduk}" cocok ke ${matches.length} produk (ambigu). Sertakan SKU.`, tierError: false }
      product = matches[0]
    } else {
      return { parsed: r, product: null, uom, reason: 'harus punya SKU atau nama_produk', tierError: false }
    }
    return { parsed: r, product, uom, reason: null, tierError: false }
  })

  // 3. Cek duplikat (productId, uomId) — baris kedua dst tolak
  const seen = new Set<string>()
  for (const row of pre) {
    if (row.reason || !row.product || !row.uom) continue
    const key = `${row.product.id}:${row.uom.id}`
    if (seen.has(key)) {
      row.reason = 'baris duplikat (produk & satuan yang sama sudah muncul di baris sebelumnya)'
    } else {
      seen.add(key)
    }
  }

  // 4. Cek non-baseUom tanpa konversi (batch)
  const pairsToCheck: { productId: number; uomId: number }[] = []
  for (const row of pre) {
    if (row.reason || !row.product || !row.uom) continue
    if (row.uom.id !== row.product.baseUomId) {
      pairsToCheck.push({ productId: row.product.id, uomId: row.uom.id })
    }
  }
  const invalidUomSet = new Set<string>()
  if (pairsToCheck.length > 0) {
    // ambil SEMUA pasangan invalid, bukan cuma satu
    const uniq = new Map<string, { productId: number; uomId: number }>()
    for (const p of pairsToCheck) uniq.set(`${p.productId}:${p.uomId}`, p)
    const list = [...uniq.values()]
    const values = sql.join(
      list.map(p => sql`(${p.productId}::int, ${p.uomId}::int)`),
      sql`, `,
    )
    const rows = await db.execute(sql`
      SELECT v.product_id, v.uom_id
      FROM (VALUES ${values}) AS v(product_id, uom_id)
      JOIN petshop.products pr ON pr.id = v.product_id
      WHERE v.uom_id <> pr.base_uom_id
        AND NOT EXISTS (
          SELECT 1 FROM petshop.product_uom_conversions c
          WHERE c.product_id = v.product_id AND c.uom_id = v.uom_id
        )
    `) as unknown as Array<{ product_id: number; uom_id: number }>
    for (const r of rows) invalidUomSet.add(`${r.product_id}:${r.uom_id}`)
  }
  for (const row of pre) {
    if (row.reason || !row.product || !row.uom) continue
    if (invalidUomSet.has(`${row.product.id}:${row.uom.id}`)) {
      row.reason = `satuan "${row.uom.code}" belum punya konversi ke satuan dasar produk. Lengkapi di halaman Harga & Konversi dulu.`
    }
  }

  // 5. Range check harga (>= 0, <= MAX_PRICE) untuk baris yang lolos
  for (const row of pre) {
    if (row.reason || !row.product || !row.uom) continue
    const p = row.parsed
    if (p.modal !== null && p.modal < 0) {
      row.reason = 'harga modal tidak boleh negatif'
      continue
    }
    if (p.modal !== null && new Big(p.modal).gt(MAX_PRICE)) {
      row.reason = 'harga modal melebihi batas maksimum'
      continue
    }
    for (const tier of IMPORT_TIERS) {
      const v = p.tiers[tier]
      if (v === undefined) continue
      if (v <= 0) { row.reason = `${TIER_TO_COLUMN[tier]} harus lebih dari 0`; break }
      if (new Big(v).gt(MAX_PRICE)) { row.reason = `${TIER_TO_COLUMN[tier]} melebihi batas maksimum`; break }
    }
  }

  // 6. Load current state untuk baris valid supaya bisa hitung insert/update/unchanged
  const validPairs = pre
    .filter(r => !r.reason && r.product && r.uom)
    .map(r => ({ productId: r.product!.id, uomId: r.uom!.id }))
  const currentByKey = new Map<string, { cost: number | null; tiers: Partial<Record<ImportTier, number>> }>()
  if (validPairs.length > 0) {
    const uniq = new Map<string, { productId: number; uomId: number }>()
    for (const p of validPairs) uniq.set(`${p.productId}:${p.uomId}`, p)
    const list = [...uniq.values()]
    const values = sql.join(
      list.map(p => sql`(${p.productId}::int, ${p.uomId}::int)`),
      sql`, `,
    )
    const currentRows = await db.execute(sql`
      WITH pairs(product_id, uom_id) AS (VALUES ${values})
      SELECT
        pr.product_id, pr.uom_id, NULL::text AS tier_type, NULL::int AS price, pc.cost_price
      FROM pairs pr
      LEFT JOIN petshop.product_uom_costs pc
        ON pc.product_id = pr.product_id AND pc.uom_id = pr.uom_id AND pc.branch_id = ${branchId}
      UNION ALL
      SELECT pp.product_id, pp.uom_id, pp.tier_type, pp.price, NULL::int
      FROM petshop.product_prices pp
      JOIN pairs pr ON pr.product_id = pp.product_id AND pr.uom_id = pp.uom_id
      WHERE pp.branch_id = ${branchId}
    `) as unknown as CurrentStateRow[]

    for (const cr of currentRows) {
      const key = `${cr.product_id}:${cr.uom_id}`
      const entry = currentByKey.get(key) ?? { cost: null, tiers: {} }
      if (cr.tier_type === null) {
        entry.cost = cr.cost_price
      } else if (IMPORT_TIERS.includes(cr.tier_type as ImportTier)) {
        entry.tiers[cr.tier_type as ImportTier] = cr.price ?? undefined
      }
      currentByKey.set(key, entry)
    }
  }

  // 7. Build result
  const rows: ValidatedRow[] = []
  const outChanges: PriceChange[] = []
  const outCostChanges: CostChange[] = []
  let insertCount = 0, updateCount = 0, unchangedCount = 0, rejectedCount = 0

  for (const row of pre) {
    if (row.reason || !row.product || !row.uom) {
      rejectedCount++
      rows.push({
        rowNumber: row.parsed.rowNumber,
        status: 'rejected',
        reason: row.reason,
        productId: row.product?.id ?? null,
        productName: row.product?.name ?? row.parsed.namaProduk,
        uomId: row.uom?.id ?? null,
        uomCode: row.uom?.code ?? row.parsed.satuan,
        changes: [],
        costChange: null,
        currentModal: null,
        currentTiers: {},
        incomingModal: null,
        incomingTiers: {},
      })
      continue
    }

    const key = `${row.product.id}:${row.uom.id}`
    const current = currentByKey.get(key) ?? { cost: null, tiers: {} }
    const changesForRow: PriceChange[] = []
    let costChangeForRow: CostChange | null = null
    let anyInsert = false
    let anyUpdate = false

    // Modal
    if (row.parsed.modal !== null) {
      if (current.cost === null) anyInsert = true
      else if (current.cost !== row.parsed.modal) anyUpdate = true
      if (current.cost !== row.parsed.modal) {
        costChangeForRow = { productId: row.product.id, uomId: row.uom.id, costPrice: row.parsed.modal }
      }
    }

    // Tiers
    for (const tier of IMPORT_TIERS) {
      const incoming = row.parsed.tiers[tier]
      if (incoming === undefined) continue
      const cur = current.tiers[tier]
      if (cur === undefined) anyInsert = true
      else if (cur !== incoming) anyUpdate = true
      if (cur !== incoming) {
        changesForRow.push({ productId: row.product.id, uomId: row.uom.id, tierType: tier, price: incoming })
      }
    }

    let status: RowStatus
    if (changesForRow.length === 0 && !costChangeForRow) {
      status = 'unchanged'
      unchangedCount++
    } else if (anyInsert && !anyUpdate) {
      status = 'insert'
      insertCount++
    } else {
      status = 'update'
      updateCount++
    }

    for (const c of changesForRow) outChanges.push(c)
    if (costChangeForRow) outCostChanges.push(costChangeForRow)

    rows.push({
      rowNumber: row.parsed.rowNumber,
      status,
      reason: null,
      productId: row.product.id,
      productName: row.product.name,
      uomId: row.uom.id,
      uomCode: row.uom.code,
      changes: changesForRow,
      costChange: costChangeForRow,
      currentModal: current.cost,
      currentTiers: current.tiers,
      incomingModal: row.parsed.modal,
      incomingTiers: row.parsed.tiers,
    })
  }

  return {
    branchId,
    rows,
    summary: {
      totalRows: parsed.length,
      insert: insertCount,
      update: updateCount,
      unchanged: unchangedCount,
      rejected: rejectedCount,
      fieldsToApply: outChanges.length + outCostChanges.length,
    },
    changes: outChanges,
    costChanges: outCostChanges,
  }
}
