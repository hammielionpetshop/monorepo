import Big from 'big.js'

/**
 * Aturan murni Aset & Penyusutan F2-6d-1 (spec docs/work/specs/2026-11-12-f2-6d-aset-penyusutan-design.md §0, §1.6).
 * Penyusutan garis lurus mulai bulan beli; sisa pembulatan di bulan terakhir; tanpa nilai sisa.
 * Web Finance (F2-6d-2) memakai rumus yang sama.
 */

export const ASSET_MIN_PRICE = 1_000_000
export const ASSET_START_DATE = '2026-11-01'
export const MAX_LIFE_MONTHS = 120

export type AssetType = 'ELECTRONICS' | 'MACHINE' | 'FURNITURE' | 'VEHICLE' | 'LEASEHOLD_IMPROVEMENT'
export type AssetStatus = 'IN_USE' | 'DAMAGED' | 'LOST' | 'SOLD'
export type DisposalStatus = Exclude<AssetStatus, 'IN_USE'>

export const ASSET_TYPES: { value: AssetType; label: string; defaultLifeMonths: number | null }[] = [
  { value: 'ELECTRONICS', label: 'Elektronik (komputer, printer, HP, CCTV)', defaultLifeMonths: 48 },
  { value: 'MACHINE', label: 'Mesin & alat (timbangan, alat grooming, AC, kulkas/freezer)', defaultLifeMonths: 48 },
  { value: 'FURNITURE', label: 'Perabot (rak, etalase, meja)', defaultLifeMonths: 96 },
  { value: 'VEHICLE', label: 'Kendaraan milik usaha', defaultLifeMonths: 96 },
  { value: 'LEASEHOLD_IMPROVEMENT', label: 'Perbaikan bangunan sewaan (umur sampai kontrak berakhir)', defaultLifeMonths: null },
]

export const ASSET_TYPE_SHORT: Record<AssetType, string> = {
  ELECTRONICS: 'Elektronik',
  MACHINE: 'Mesin & alat',
  FURNITURE: 'Perabot',
  VEHICLE: 'Kendaraan',
  LEASEHOLD_IMPROVEMENT: 'Perbaikan bangunan sewaan',
}

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  IN_USE: 'Dipakai',
  DAMAGED: 'Rusak',
  LOST: 'Hilang',
  SOLD: 'Dijual',
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function monthIndex(yyyyMm: string): number {
  const [y, m] = yyyyMm.split('-').map(Number)
  return y * 12 + (m - 1)
}

export function monthOf(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export interface DepreciationAsset {
  purchasePrice: number
  usefulLifeMonths: number
  /** YYYY-MM-DD */
  purchasedOn: string
  status: AssetStatus
  /** YYYY-MM-DD; diisi bila status ≠ IN_USE. */
  disposedOn: string | null
  saleAmount: number | null
}

/** Bagian penyusutan bulan ke-k (1…N). Bulan terakhir menampung sisa pembulatan. */
export function monthlyPortion(price: number, life: number, k: number): number {
  if (k < 1 || k > life) return 0
  const base = Number(new Big(price).div(life).round(0, Big.roundDown))
  return k === life ? Number(new Big(price).minus(new Big(base).times(life - 1))) : base
}

/** Bulan terakhir penyusutan dihitung (inklusif), null bila tidak ada sama sekali. */
function lastDepreciationIndex(a: DepreciationAsset): number | null {
  const start = monthIndex(a.purchasedOn.slice(0, 7))
  let last = start + a.usefulLifeMonths - 1
  if (a.status !== 'IN_USE' && a.disposedOn) last = Math.min(last, monthIndex(a.disposedOn.slice(0, 7)) - 1)
  return last >= start ? last : null
}

/** Penyusutan yang jatuh di bulan YYYY-MM. */
export function depreciationFor(a: DepreciationAsset, month: string): number {
  const start = monthIndex(a.purchasedOn.slice(0, 7))
  const last = lastDepreciationIndex(a)
  const m = monthIndex(month)
  if (last === null || m < start || m > last) return 0
  return monthlyPortion(a.purchasePrice, a.usefulLifeMonths, m - start + 1)
}

/** Akumulasi penyusutan sampai akhir bulan YYYY-MM (inklusif). */
export function accumulatedThrough(a: DepreciationAsset, month: string): number {
  const start = monthIndex(a.purchasedOn.slice(0, 7))
  const last = lastDepreciationIndex(a)
  if (last === null) return 0
  const end = Math.min(last, monthIndex(month))
  let total = new Big(0)
  for (let m = start; m <= end; m++) total = total.plus(monthlyPortion(a.purchasePrice, a.usefulLifeMonths, m - start + 1))
  return Number(total)
}

/** Sisa nilai di akhir bulan YYYY-MM. Aset yang sudah dilepas sebelum/di bulan itu bernilai 0. */
export function bookValueAt(a: DepreciationAsset, month: string): number {
  if (monthIndex(month) < monthIndex(a.purchasedOn.slice(0, 7))) return 0
  if (a.status !== 'IN_USE' && a.disposedOn && monthIndex(month) >= monthIndex(a.disposedOn.slice(0, 7))) return 0
  return Number(new Big(a.purchasePrice).minus(accumulatedThrough(a, month)))
}

/**
 * Hasil pelepasan di bulan kejadian: sisa nilai akhir bulan sebelumnya − uang jual.
 * Positif = Kerugian aset; negatif = Untung jual aset. Null bila aset masih dipakai.
 */
export function disposalResult(a: DepreciationAsset): { month: string; loss: number } | null {
  if (a.status === 'IN_USE' || !a.disposedOn) return null
  const month = a.disposedOn.slice(0, 7)
  const before = monthOf(monthIndex(month) - 1)
  const remaining = new Big(a.purchasePrice).minus(accumulatedThrough(a, before))
  return { month, loss: Number(remaining.minus(a.saleAmount ?? 0)) }
}

export interface DepreciationRow {
  month: string
  portion: number
  accumulated: number
  bookValue: number
}

/** Jadwal penyusutan lengkap (untuk Rincian). Berhenti di bulan sebelum dilepas. */
export function depreciationSchedule(a: DepreciationAsset): DepreciationRow[] {
  const start = monthIndex(a.purchasedOn.slice(0, 7))
  const last = lastDepreciationIndex(a)
  if (last === null) return []
  const rows: DepreciationRow[] = []
  let acc = new Big(0)
  for (let m = start; m <= last; m++) {
    const portion = monthlyPortion(a.purchasePrice, a.usefulLifeMonths, m - start + 1)
    acc = acc.plus(portion)
    rows.push({ month: monthOf(m), portion, accumulated: Number(acc), bookValue: Number(new Big(a.purchasePrice).minus(acc)) })
  }
  return rows
}

export interface PurchaseRuleInput {
  name: string
  assetType: string
  usefulLifeMonths: number
  purchasePrice: number
  purchasedOn: string
  today: string
}

export function checkPurchase(input: PurchaseRuleInput): string | null {
  if (!input.name.trim()) return 'Nama barang wajib diisi'
  if (!ASSET_TYPES.some((t) => t.value === input.assetType)) return 'Jenis aset tidak valid'
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths < 1 || input.usefulLifeMonths > MAX_LIFE_MONTHS) {
    return `Umur pakai 1–${MAX_LIFE_MONTHS} bulan`
  }
  if (!Number.isInteger(input.purchasePrice) || input.purchasePrice < ASSET_MIN_PRICE) {
    return 'Harga aset minimal Rp1.000.000; barang di bawahnya dicatat sebagai Biaya di Pendapatan & Pengeluaran'
  }
  if (input.purchasedOn < ASSET_START_DATE) return 'Tanggal beli paling awal 1 November 2026'
  if (input.purchasedOn > input.today) return 'Tanggal beli tidak boleh melewati hari ini'
  return null
}

export interface DisposalRuleInput {
  current: AssetStatus
  isCancelled: boolean
  next: string
  disposedOn: string
  purchasedOn: string
  today: string
  reason: string
  saleAmount: number | null
}

export function checkDisposal(input: DisposalRuleInput): string | null {
  if (input.isCancelled) return 'Aset sudah dibatalkan'
  if (input.current !== 'IN_USE') return 'Keadaan aset sudah tidak Dipakai dan tidak bisa diubah lagi'
  if (!['DAMAGED', 'LOST', 'SOLD'].includes(input.next)) return 'Keadaan baru tidak valid'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.disposedOn)) return 'Tanggal kejadian tidak valid'
  if (input.disposedOn < input.purchasedOn) return 'Tanggal kejadian tidak boleh sebelum tanggal beli'
  if (input.disposedOn > input.today) return 'Tanggal kejadian tidak boleh melewati hari ini'
  if (input.reason.trim().length < 3) return 'Alasan wajib diisi (minimal 3 huruf)'
  if (input.next === 'SOLD') {
    if (input.saleAmount === null || !Number.isInteger(input.saleAmount) || input.saleAmount < 0) return 'Uang hasil jual wajib diisi (boleh 0)'
  } else if (input.saleAmount !== null) {
    return 'Uang hasil jual hanya untuk aset yang dijual'
  }
  return null
}

export function isMonth(v: string): boolean {
  return MONTH_RE.test(v)
}
