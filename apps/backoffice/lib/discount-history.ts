import { matchesSearchWords } from './search-words'

// ── LAPORAN RIWAYAT DISKON ──────────────────────────────────────────────────────────────────
// Aturan pengelompokan dan tulisan laporan Riwayat Diskon
// (docs/work/specs/2026-10-12-promo-otomatis-design.md, P1f). Berkas ini hanya MEMBACA angka
// yang sudah tersimpan di nota; tidak ada rumus diskon di sini — rumusnya tetap di
// `lib/manual-discount.ts` dan `lib/line-net-value.ts`.
//
// Empat sumber potongan, sengaja dipisah supaya owner tahu mana yang beralasan dan mana tidak:
// - MANUAL  : diskon per barang yang diketik kasir (ada alasan, tercatat di tabel potongan);
// - PROMO   : promo otomatis (mulai tahap P2; tercatat di tabel potongan);
// - GROSIR  : potongan per barang tanpa catatan alasan — Penjualan Grosir, atau nota kasir lama
//             yang barisnya dipotong sebelum ada catatan potongan;
// - NOTA    : diskon total nota cara lama / diskon transaksi Grosir. Tidak menempel ke barang,
//             jadi tidak bisa dipecah per produk.

export const DISCOUNT_SOURCES = ['MANUAL', 'PROMO', 'GROSIR', 'NOTA'] as const
export type DiscountSource = (typeof DISCOUNT_SOURCES)[number]

export const DISCOUNT_SOURCE_LABEL: Record<DiscountSource, string> = {
  MANUAL: 'Diskon kasir',
  PROMO: 'Promo',
  GROSIR: 'Potongan tanpa alasan',
  NOTA: 'Diskon nota (tidak per barang)',
}

export function isDiscountSource(value: string | null | undefined): value is DiscountSource {
  return DISCOUNT_SOURCES.includes(value as DiscountSource)
}

/** Satu potongan pada satu baris nota (atau satu diskon nota, bila `source` = NOTA). */
export interface DiscountHistoryRow {
  key: string
  source: DiscountSource
  transactionId: number
  trxNumber: string
  /** ISO — waktu nota terbit. */
  createdAt: string
  branchId: number
  branchName: string
  /** Yang memberi potongan: pencatat potongan, atau kasir notanya. */
  byName: string
  /** `BULK` = Penjualan Grosir. */
  saleType: string
  customerName: string | null
  productId: number | null
  productName: string
  productSku: string | null
  uomCode: string | null
  qty: number
  unitPrice: number
  amount: number
  /** Alasan / nama promo / keterangan sumber — siap tampil. */
  reason: string
}

export interface DiscountProductGroup {
  key: string
  productName: string
  productSku: string | null
  /** Berapa kali barang ini dipotong (jumlah baris nota). */
  count: number
  noteCount: number
  total: number
  sources: DiscountSource[]
  /** Alasan terbanyak di depan. */
  reasons: { label: string; count: number }[]
  rows: DiscountHistoryRow[]
}

export interface DiscountHistorySummary {
  total: number
  noteCount: number
  bySource: Record<DiscountSource, { count: number; total: number }>
}

export interface DiscountHistoryView {
  summary: DiscountHistorySummary
  products: DiscountProductGroup[]
  /** Diskon nota (tidak per barang) — terbaru di atas. */
  noteLevel: DiscountHistoryRow[]
}

export interface DiscountHistoryFilter {
  source?: DiscountSource | ''
  q?: string
}

const byNewest = (a: DiscountHistoryRow, b: DiscountHistoryRow) =>
  b.createdAt.localeCompare(a.createdAt) || b.transactionId - a.transactionId

const productKey = (row: DiscountHistoryRow) =>
  row.productId != null ? `p${row.productId}` : `n:${row.productName.trim().toLowerCase()}`

/** Menyaring lalu mengelompokkan per produk. Total potongan terbesar di atas. */
export function buildDiscountHistory(rows: DiscountHistoryRow[], filter: DiscountHistoryFilter = {}): DiscountHistoryView {
  const q = (filter.q ?? '').trim()
  const kept = rows.filter((row) => {
    if (row.amount <= 0) return false
    if (filter.source && row.source !== filter.source) return false
    // Diskon nota tidak punya barang — kata pencarian dicocokkan ke nomor nota & pelanggannya.
    return matchesSearchWords(q, [row.productName, row.productSku, row.trxNumber, row.customerName])
  })

  const bySource = Object.fromEntries(DISCOUNT_SOURCES.map((s) => [s, { count: 0, total: 0 }])) as DiscountHistorySummary['bySource']
  const notes = new Set<number>()
  const groups = new Map<string, DiscountProductGroup>()
  const noteLevel: DiscountHistoryRow[] = []
  let total = 0

  for (const row of kept) {
    total += row.amount
    notes.add(row.transactionId)
    bySource[row.source].count += 1
    bySource[row.source].total += row.amount
    if (row.source === 'NOTA') {
      noteLevel.push(row)
      continue
    }
    const key = productKey(row)
    let group = groups.get(key)
    if (!group) {
      group = { key, productName: row.productName, productSku: row.productSku, count: 0, noteCount: 0, total: 0, sources: [], reasons: [], rows: [] }
      groups.set(key, group)
    }
    group.count += 1
    group.total += row.amount
    group.rows.push(row)
  }

  const products = [...groups.values()].map((group) => {
    const reasonCount = new Map<string, number>()
    for (const row of group.rows) reasonCount.set(row.reason, (reasonCount.get(row.reason) ?? 0) + 1)
    return {
      ...group,
      rows: [...group.rows].sort(byNewest),
      noteCount: new Set(group.rows.map((r) => r.transactionId)).size,
      sources: DISCOUNT_SOURCES.filter((s) => group.rows.some((r) => r.source === s)),
      reasons: [...reasonCount.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }
  })
  products.sort((a, b) => b.total - a.total || a.productName.localeCompare(b.productName))

  return { summary: { total, noteCount: notes.size, bySource }, products, noteLevel: noteLevel.sort(byNewest) }
}
