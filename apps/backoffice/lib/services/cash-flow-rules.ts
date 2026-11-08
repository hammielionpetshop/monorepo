/**
 * Aturan murni Arus Kas F2-4b (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §3).
 * Dipakai rute API (server) dan tes; tidak menyentuh DB.
 */

export type CashFlowType = 'INCOME' | 'EXPENSE'
export type ReportKind = 'COST' | 'NON_COST' | 'INCOME' | 'NON_INCOME'

/** Tanggal uang boleh mundur paling jauh sekian hari (lebih jauh: Owner saja). */
export const BACKDATE_DAYS = 7
/** "Untuk bulan" boleh dipilih sekian bulan ke belakang/ke depan dari bulan tanggal uang. */
export const FOR_MONTH_RANGE = 12

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  COST: 'Biaya',
  NON_COST: 'Bukan biaya',
  INCOME: 'Pendapatan lain',
  NON_INCOME: 'Bukan pendapatan',
}

export function reportKindsFor(type: CashFlowType): ReportKind[] {
  return type === 'EXPENSE' ? ['COST', 'NON_COST'] : ['INCOME', 'NON_INCOME']
}

export interface RuleCategory {
  type: string
  isActive: boolean
  isSystem: boolean
  ownerOnly: boolean
  noteRequired: boolean
}

export interface RulePlace {
  kind: string
  isActive: boolean
}

export interface EntryRuleInput {
  type: CashFlowType
  occurredOn: string // YYYY-MM-DD
  forMonth: string // YYYY-MM
  note: string | null
  category: RuleCategory | null
  place: RulePlace | null
  isOwner: boolean
  today: string // YYYY-MM-DD (WIB)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function monthIndex(yyyyMm: string): number {
  const [y, m] = yyyyMm.split('-').map(Number)
  return y * 12 + (m - 1)
}

/** Kembalikan pesan galat pertama, atau null bila catatan sah. */
export function checkEntry(input: EntryRuleInput): string | null {
  const { category, place } = input
  if (!category) return 'Kategori tidak ditemukan'
  if (category.type !== input.type) return 'Kategori tidak sesuai dengan tipe yang dipilih'
  if (category.isSystem) return 'Kategori ini dicatat otomatis oleh sistem dan tidak bisa dipilih'
  if (!category.isActive) return 'Kategori sudah nonaktif'
  if (category.ownerOnly && !input.isOwner) return 'Kategori ini hanya boleh dicatat Owner'
  if (category.noteRequired && !input.note?.trim()) return 'Catatan wajib diisi untuk kategori ini'

  if (!validDate(input.occurredOn)) return 'Tanggal uang tidak valid'
  if (input.occurredOn > input.today) return 'Tanggal uang tidak boleh melewati hari ini'
  if (daysBetween(input.occurredOn, input.today) > BACKDATE_DAYS && !input.isOwner) {
    return `Tanggal uang paling jauh ${BACKDATE_DAYS} hari ke belakang; lebih dari itu hanya Owner`
  }

  if (!MONTH_RE.test(input.forMonth)) return 'Untuk bulan tidak valid'
  const gap = Math.abs(monthIndex(input.forMonth) - monthIndex(input.occurredOn.slice(0, 7)))
  if (gap > FOR_MONTH_RANGE) return `Untuk bulan paling jauh ${FOR_MONTH_RANGE} bulan dari tanggal uang`

  if (!place) return input.type === 'EXPENSE' ? 'Pilih "Dibayar dari" (Tempat Uang)' : 'Pilih "Masuk ke" (Tempat Uang)'
  if (place.kind === 'DRAWER') return 'Laci kasir tidak bisa dipakai di Arus Kas (uang laci lewat Pengeluaran Kasir & Setoran)'
  if (!place.isActive) return 'Tempat Uang sudah nonaktif'
  return null
}

export interface CancelRuleInput {
  isCancelled: boolean
  isSystemCategory: boolean
  createdBy: number | null
  createdOn: string // tanggal simpan (WIB) YYYY-MM-DD
  actorId: number
  actorCanCancelAny: boolean // hak cashflow.cancel (Owner/GM)
  today: string
}

/** Pencatat boleh membatalkan catatannya sendiri pada hari yang sama; sesudahnya hanya Owner/GM. */
export function checkCancel(input: CancelRuleInput): string | null {
  if (input.isCancelled) return 'Catatan ini sudah dibatalkan'
  if (input.isSystemCategory) return 'Catatan otomatis dibatalkan lewat asalnya, bukan dari Arus Kas'
  if (input.actorCanCancelAny) return null
  if (input.createdBy === input.actorId && input.createdOn === input.today) return null
  return 'Catatan hanya bisa dibatalkan pencatatnya pada hari yang sama; sesudah itu oleh Owner/GM'
}

export interface CategoryChangeInput {
  current: { type: string; reportKind: string | null; isSystem: boolean }
  next: { type: string; reportKind: string | null }
  usedCount: number
}

/** Ganti tipe/jenis laporan hanya selama belum dipakai; jenis yang masih kosong boleh dipilih kapan saja. */
export function checkCategoryChange({ current, next, usedCount }: CategoryChangeInput): string | null {
  if (next.reportKind && !reportKindsFor(next.type as CashFlowType).includes(next.reportKind as ReportKind)) {
    return 'Jenis laporan tidak cocok dengan tipe kategori'
  }
  const typeChanged = current.type !== next.type
  const kindChanged = current.reportKind !== next.reportKind
  if (current.isSystem && (typeChanged || kindChanged)) return 'Kategori sistem tidak bisa diubah tipe atau jenisnya'
  if (usedCount === 0) return null
  if (typeChanged) return 'Tipe kategori yang sudah dipakai tidak bisa diganti; buat kategori baru lalu nonaktifkan yang lama'
  if (kindChanged && current.reportKind !== null) {
    return 'Jenis laporan kategori yang sudah dipakai tidak bisa diganti; buat kategori baru lalu nonaktifkan yang lama'
  }
  if (kindChanged && next.reportKind === null) return 'Jenis laporan tidak bisa dikosongkan lagi'
  return null
}

/** "YYYY-MM" → "YYYY-MM-01" untuk kolom for_month. */
export function monthStart(yyyyMm: string): string {
  return `${yyyyMm}-01`
}
