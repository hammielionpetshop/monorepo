import Big from 'big.js'

// ── MESIN DISKON MANUAL ─────────────────────────────────────────────────────────────────────
// Satu-satunya tempat aturan diskon yang diketik kasir pada satu baris barang
// (docs/work/specs/2026-10-12-promo-otomatis-design.md, keputusan owner butir 3, 6, 7, 8).
// Layar kasir dan server WAJIB lewat sini supaya hitungannya tidak pernah berbeda.
//
// Aturan bisnisnya:
// - Diskon diisi PER BARANG (bukan total nota): potongan per pcs atau potongan untuk barisnya.
// - Tidak boleh melebihi nilai baris; tidak boleh di baris yang sudah kena promo.
// - Alasan wajib dari daftar pilihan; "Lainnya" wajib diketik.
// - Batas diskon kasir: owner belum menetapkan ("dibahas nanti") → bawaan TANPA BATAS.
//   Begitu diputuskan, cukup isi `DEFAULT_MANUAL_DISCOUNT_POLICY` (atau baca dari Pengaturan).

export const DISCOUNT_KIND_MANUAL = 'MANUAL'
export const DISCOUNT_KIND_PROMO = 'PROMO'
export type DiscountKind = typeof DISCOUNT_KIND_MANUAL | typeof DISCOUNT_KIND_PROMO

export const MANUAL_DISCOUNT_OTHER_REASON = 'LAINNYA'
export const MANUAL_DISCOUNT_NOTE_MIN = 3
export const MANUAL_DISCOUNT_NOTE_MAX = 200

// Daftar SEMENTARA — isi akhirnya menunggu owner (spec "Hal terbuka" butir 2). Kode alasan yang
// sudah pernah dipakai nota tidak boleh dihapus dari sini, hanya ditambah.
export const MANUAL_DISCOUNT_REASONS = [
  { code: 'KEMASAN_RUSAK', label: 'Kemasan rusak' },
  { code: 'HAMPIR_KEDALUWARSA', label: 'Hampir kedaluwarsa' },
  { code: 'LANGGANAN', label: 'Pelanggan langganan' },
  { code: MANUAL_DISCOUNT_OTHER_REASON, label: 'Lainnya' },
] as const

export type ManualDiscountReasonCode = (typeof MANUAL_DISCOUNT_REASONS)[number]['code']

export function isManualDiscountReason(code: string | null | undefined): code is ManualDiscountReasonCode {
  return MANUAL_DISCOUNT_REASONS.some((r) => r.code === code)
}

/** Tulisan alasan untuk struk & laporan: pilihan, atau ketikan kasir bila "Lainnya". */
export function manualDiscountReasonLabel(code: string | null | undefined, note?: string | null): string {
  const trimmed = note?.trim()
  if (code === MANUAL_DISCOUNT_OTHER_REASON && trimmed) return trimmed
  return MANUAL_DISCOUNT_REASONS.find((r) => r.code === code)?.label ?? (trimmed || '-')
}

/** Batas diskon kasir. `null` = tidak dibatasi. */
export interface ManualDiscountPolicy {
  /** Paling banyak sekian persen dari nilai baris (0–100). */
  maxPercentOfLine: number | null
  /** Paling banyak sekian rupiah per baris. */
  maxAmountPerLine: number | null
}

export const DEFAULT_MANUAL_DISCOUNT_POLICY: ManualDiscountPolicy = {
  maxPercentOfLine: null,
  maxAmountPerLine: null,
}

export type ManualDiscountMode = 'PER_PCS' | 'PER_BARIS'

/** Nilai baris sebelum potongan = qty × harga satuan (rupiah bulat). */
export function lineGrossAmount(qty: number, unitPrice: string | number): number {
  return Number(new Big(unitPrice).times(qty).round(0).toString())
}

/** Potongan untuk seluruh baris dari isian kasir (per pcs dikali qty, atau langsung per baris). */
export function manualDiscountAmount(mode: ManualDiscountMode, value: number, qty: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(qty)) return 0
  return mode === 'PER_PCS' ? Number(new Big(value).times(qty).round(0).toString()) : Math.round(value)
}

/** Potongan terbesar yang diizinkan untuk satu baris menurut batas yang berlaku. */
export function maxManualDiscount(lineGross: number, policy: ManualDiscountPolicy = DEFAULT_MANUAL_DISCOUNT_POLICY): number {
  let max = Math.max(0, lineGross)
  if (policy.maxPercentOfLine != null) {
    max = Math.min(max, Number(new Big(lineGross).times(policy.maxPercentOfLine).div(100).round(0, Big.roundDown).toString()))
  }
  if (policy.maxAmountPerLine != null) max = Math.min(max, policy.maxAmountPerLine)
  return Math.max(0, max)
}

export interface ManualDiscountCheck {
  /** qty × harga satuan baris itu. */
  lineGross: number
  /** Potongan manual untuk seluruh baris. */
  amount: number
  reasonCode: string | null | undefined
  reasonNote?: string | null
  /** Baris ini sudah kena promo (atau gratis ongkir) — tidak boleh didiskon manual lagi. */
  hasOtherDiscount?: boolean
  policy?: ManualDiscountPolicy
}

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

/** Pemeriksaan diskon manual satu baris. Null = sah; selain itu pesan untuk kasir. */
export function checkManualDiscount(params: ManualDiscountCheck): string | null {
  const { lineGross, amount, reasonCode } = params
  const policy = params.policy ?? DEFAULT_MANUAL_DISCOUNT_POLICY
  if (!Number.isInteger(amount) || amount <= 0) return 'Potongan harus angka rupiah lebih dari 0'
  if (params.hasOtherDiscount) return 'Barang ini sudah mendapat promo, tidak bisa didiskon lagi'
  if (amount > lineGross) return `Potongan tidak boleh melebihi harga barangnya (${rupiah(Math.max(0, lineGross))})`
  const max = maxManualDiscount(lineGross, policy)
  if (amount > max) return `Potongan melebihi batas diskon (paling banyak ${rupiah(max)} untuk barang ini)`
  if (!isManualDiscountReason(reasonCode)) return 'Pilih alasan diskon'
  const note = params.reasonNote?.trim() ?? ''
  if (reasonCode === MANUAL_DISCOUNT_OTHER_REASON && note.length < MANUAL_DISCOUNT_NOTE_MIN) {
    return 'Alasan "Lainnya" wajib diketik'
  }
  if (note.length > MANUAL_DISCOUNT_NOTE_MAX) return `Catatan alasan paling panjang ${MANUAL_DISCOUNT_NOTE_MAX} huruf`
  return null
}

// ── Pemeriksaan server (nota yang membawa diskon per barang) ───────────────────────────────

/** Diskon manual satu baris seperti dikirim layar kasir. */
export interface ManualDiscountInput {
  /** Potongan untuk seluruh baris (rupiah). */
  amount: number
  reasonCode: string
  reasonNote?: string | null
}

export interface ManualDiscountLine {
  qty: number
  unitPrice: number
  /** Jumlah semua potongan baris itu menurut layar. */
  discountAmount: number
  /** Yang ditagih untuk baris itu menurut layar. */
  subtotal: number
  manualDiscount?: ManualDiscountInput | null
  /** Baris ini sudah punya potongan lain (promo / gratis ongkir). */
  hasOtherDiscount?: boolean
}

/**
 * Server sebagai hakim untuk satu baris berdiskon manual: aturan mesin + angka layar harus
 * cocok (potongan baris = diskon manual, tagihan = qty × harga − potongan). Null = sah atau
 * baris tanpa diskon manual.
 */
export function checkManualDiscountLine(line: ManualDiscountLine, policy?: ManualDiscountPolicy): string | null {
  const manual = line.manualDiscount
  if (!manual) return null
  const lineGross = lineGrossAmount(line.qty, line.unitPrice)
  const rule = checkManualDiscount({
    lineGross,
    amount: manual.amount,
    reasonCode: manual.reasonCode,
    reasonNote: manual.reasonNote,
    hasOtherDiscount: line.hasOtherDiscount,
    policy,
  })
  if (rule) return rule
  if (line.discountAmount !== manual.amount || line.subtotal !== lineGross - manual.amount) {
    return 'Hitungan diskon barang tidak cocok. Muat ulang halaman kasir, lalu ulangi.'
  }
  return null
}

export interface ManualDiscountTotals {
  /** Jumlah tagihan semua baris menurut layar. */
  subtotal: number
  /** Diskon total nota (cara lama). */
  discountTotal: number
  grandTotal: number
}

/**
 * Nota yang memakai diskon per barang tidak boleh sekaligus memakai diskon total nota, dan
 * totalnya harus sama dengan jumlah tagihan baris. Nota tanpa diskon per barang tidak
 * diperiksa di sini (cara lama masih diterima sampai layar kasir diganti).
 */
export function checkManualDiscountTotals(lines: ManualDiscountLine[], totals: ManualDiscountTotals): string | null {
  if (!lines.some((l) => l.manualDiscount)) return null
  if (totals.discountTotal !== 0) return 'Diskon per barang tidak bisa digabung dengan diskon total nota'
  const sum = lines.reduce((acc, l) => acc + l.subtotal, 0)
  if (totals.subtotal !== sum || totals.grandTotal !== sum) {
    return 'Total nota tidak cocok dengan isi keranjang. Muat ulang halaman kasir, lalu ulangi.'
  }
  return null
}
