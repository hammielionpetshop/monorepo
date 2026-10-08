import { db, openBills, bulkSaleDrafts, eq, sql } from '../db'
import { loadUomRatios } from './ibt-bulk-sale-match'

export interface HeldLine {
  productId: number
  uomId: number
  qty: number
}

function toHeldLine(raw: unknown): HeldLine | null {
  if (!raw || typeof raw !== 'object') return null
  const { productId, uomId, qty } = raw as Record<string, unknown>
  const p = Number(productId)
  const u = Number(uomId)
  const q = Number(qty)
  if (!Number.isInteger(p) || !Number.isInteger(u) || !Number.isFinite(q) || q <= 0) return null
  return { productId: p, uomId: u, qty: q }
}

/**
 * Isi `open_bills.items` dari POS. Bentuk yang tersimpan: array berisi satu string JSON
 * `{ cartItems, customer }` (begitulah HoldBillDialog mengirimnya), tapi baris item mentah juga
 * diterima supaya data lama/format lain tidak bikin reservasi hilang diam-diam.
 */
export function parseOpenBillLines(items: unknown): HeldLine[] {
  if (!Array.isArray(items)) return []
  const lines: HeldLine[] = []
  for (const entry of items) {
    let value: unknown = entry
    if (typeof entry === 'string') {
      try {
        value = JSON.parse(entry)
      } catch {
        continue
      }
    }
    const cartItems = (value as { cartItems?: unknown } | null)?.cartItems
    for (const raw of Array.isArray(cartItems) ? cartItems : [value]) {
      const line = toHeldLine(raw)
      if (line) lines.push(line)
    }
  }
  return lines
}

/** Isi `bulk_sale_drafts.payload.rows`. */
export function parseBulkSaleDraftLines(payload: unknown): HeldLine[] {
  const rows = (payload as { rows?: unknown } | null)?.rows
  if (!Array.isArray(rows)) return []
  return rows.map(toHeldLine).filter((line): line is HeldLine => line !== null)
}

/** Jumlahkan qty tertahan per produk dalam satuan dasar. Satuan tanpa rasio dilewati. */
export function sumHeldBase(lines: HeldLine[], ratioMap: Map<string, number>): Map<number, number> {
  const result = new Map<number, number>()
  for (const line of lines) {
    const ratio = ratioMap.get(`${line.productId}-${line.uomId}`)
    if (ratio === undefined) continue
    result.set(line.productId, (result.get(line.productId) ?? 0) + line.qty * ratio)
  }
  return result
}

/**
 * Stok yang sedang "dipegang" Daftar Tunggu POS dan Bulk Sale di satu cabang, per produk dalam
 * satuan dasar (kanban #56). Hanya reservasi tampilan — stok fisik & FIFO tidak disentuh, jadi
 * daftar tunggu yang dihapus/dilanjutkan otomatis melepas reservasinya.
 */
export async function getReservedStockBase(branchId: number, productIds: number[]): Promise<Map<number, number>> {
  if (productIds.length === 0) return new Map()
  const wanted = new Set(productIds)

  const [bills, drafts] = await Promise.all([
    db.select({ items: openBills.items }).from(openBills).where(eq(openBills.branchId, branchId)),
    db
      .select({ payload: bulkSaleDrafts.payload })
      .from(bulkSaleDrafts)
      .where(sql`${bulkSaleDrafts.payload}->>'branchId' = ${String(branchId)}`),
  ])

  const lines = [
    ...bills.flatMap((bill) => parseOpenBillLines(bill.items)),
    ...drafts.flatMap((draft) => parseBulkSaleDraftLines(draft.payload)),
  ].filter((line) => wanted.has(line.productId))
  if (lines.length === 0) return new Map()

  const { ratioMap } = await loadUomRatios(db, [...new Set(lines.map((line) => line.productId))])
  return sumHeldBase(lines, ratioMap)
}
