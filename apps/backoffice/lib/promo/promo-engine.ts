import Big from 'big.js'

// ── MESIN PROMO ─────────────────────────────────────────────────────────────────────────────
// Satu-satunya tempat aturan promo otomatis
// (docs/work/specs/2026-10-12-promo-otomatis-design.md, keputusan owner butir 1–5, 9–11).
// Layar kasir dan server WAJIB lewat sini supaya hitungannya tidak pernah berbeda. Berkas ini
// murni hitungan: tidak membaca database dan tidak membaca jam sendiri (jam dikirim pemanggil,
// dan pemanggilnya server).
//
// Satu promo = SYARAT (barang + jumlah minimal di keranjang) + HADIAH (barang yang dipotong)
// + BATAS (cabang, masa berlaku, jam tiap hari, kelipatan, maksimal per nota).
//
// Aturan bisnisnya:
// - Hanya golongan Retail: pelanggan Reseller / Grosir tidak kena promo, dan baris yang
//   harganya bukan harga Retail tidak dihitung.
// - "Satu kali pakai" promo = semua syarat terpenuhi satu kali. Kelipatan menentukan boleh
//   dipakai berkali-kali dalam satu nota; "maksimal per nota" membatasi berapa kali.
// - Hadiah mengenai sekian pcs per satu kali pakai, atau SEMUA pcs barang itu di nota (qty
//   hadiah kosong — mis. flash sale, harga khusus mulai N pcs).
// - Satu barang hanya ikut SATU promo (sebagai syarat maupun hadiah). Bila beberapa promo
//   berebut barang yang sama, dipilih gabungan yang total potongannya paling besar — paling
//   murah untuk pelanggan. Promo yang barangnya berbeda tetap berlaku bersama.
// - Promo tidak pernah menaikkan harga dan tidak pernah memotong melebihi harga barangnya.
// - Nota PO Internal dan saklar darurat "matikan semua promo" → tidak ada promo sama sekali.

export const PROMO_TIER = 'RETAIL'

export const PROMO_KINDS = ['POTONGAN', 'FLASH_SALE', 'BELI_GRATIS', 'BUNDLING', 'HADIAH_PILIHAN'] as const
export type PromoKind = (typeof PROMO_KINDS)[number]

export const PROMO_KIND_LABEL: Record<PromoKind, string> = {
  POTONGAN: 'Potongan per barang',
  FLASH_SALE: 'Flash sale',
  BELI_GRATIS: 'Beli X gratis Y',
  BUNDLING: 'Bundling',
  HADIAH_PILIHAN: 'Gratis barang pilihan',
}

export const PROMO_REWARD_TYPES = ['POTONG_PER_PCS', 'HARGA_JADI', 'GRATIS'] as const
export type PromoRewardType = (typeof PROMO_REWARD_TYPES)[number]

// Kuota total promo, dihitung terpisah tiap cabang (jatah tidak dicampur antar cabang).
// PCS = jatah berapa pcs barang hadiah; NOTA = jatah berapa nota. Pilih salah satu per promo.
export const PROMO_QUOTA_KINDS = ['PCS', 'NOTA'] as const
export type PromoQuotaKind = (typeof PROMO_QUOTA_KINDS)[number]

export const PROMO_QUOTA_KIND_LABEL: Record<PromoQuotaKind, string> = {
  PCS: 'Jatah pcs barang',
  NOTA: 'Jatah jumlah nota',
}

export const PROMO_NAME_MAX = 100
const MINUTES_PER_DAY = 1440
const WIB_OFFSET_MINUTES = 7 * 60
// Di atas jumlah ini pemilihan gabungan promo memakai cara cepat (potongan terbesar dulu).
const EXHAUSTIVE_PICK_LIMIT = 16

export interface PromoCondition {
  productId: number
  uomId: number
  /** Jumlah minimal barang ini untuk satu kali pakai promo. */
  minQty: number
}

export interface PromoReward {
  productId: number
  uomId: number
  type: PromoRewardType
  /** Rupiah per pcs: besar potongan (POTONG_PER_PCS) atau harga jadinya (HARGA_JADI). */
  value: number
  /** Sekian pcs per satu kali pakai; null = semua pcs barang itu di nota. */
  qty: number | null
}

export interface PromoRule {
  id: number
  name: string
  kind: PromoKind
  branchIds: number[]
  startsAt: Date | string
  endsAt: Date | string
  /** Jam berlaku tiap hari, menit sejak 00.00 WIB. Dua-duanya null = sepanjang hari. */
  dailyStartMinute: number | null
  dailyEndMinute: number | null
  isMultiple: boolean
  maxPerNote: number | null
  /** Jenis kuota total per cabang; null/undefined = tanpa kuota. */
  quotaKind?: PromoQuotaKind | null
  /** Jatah kuota per cabang (pcs atau nota, sesuai quotaKind). Wajib bila quotaKind terisi. */
  quotaPerBranch?: number | null
  /** Promo hanya ditawarkan bila stok barang hadiah di cabang itu masih ada (> 0). */
  requireStock?: boolean
  isActive: boolean
  conditions: PromoCondition[]
  rewards: PromoReward[]
}

const isPositiveInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0
const itemKey = (item: { productId: number; uomId: number }) => `${item.productId}:${item.uomId}`
const hasDuplicateItem = (items: { productId: number; uomId: number }[]) =>
  new Set(items.map(itemKey)).size !== items.length

/** Pemeriksaan bentuk satu promo. Null = sah; selain itu pesan untuk pembuat promo. */
export function checkPromoRule(rule: Omit<PromoRule, 'id'>): string | null {
  const name = rule.name?.trim() ?? ''
  if (!name) return 'Nama promo wajib diisi'
  if (name.length > PROMO_NAME_MAX) return `Nama promo paling panjang ${PROMO_NAME_MAX} huruf`
  if (!PROMO_KINDS.includes(rule.kind)) return 'Jenis promo tidak dikenal'
  if (rule.branchIds.length === 0) return 'Pilih sekurangnya satu cabang'
  const startsAt = new Date(rule.startsAt).getTime()
  const endsAt = new Date(rule.endsAt).getTime()
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return 'Masa berlaku promo wajib diisi'
  if (endsAt <= startsAt) return 'Promo harus berakhir sesudah waktu mulainya'
  const { dailyStartMinute: from, dailyEndMinute: to } = rule
  if ((from == null) !== (to == null)) return 'Jam mulai dan jam selesai harus diisi dua-duanya'
  if (from != null && to != null) {
    const valid = (m: number) => Number.isInteger(m) && m >= 0 && m < MINUTES_PER_DAY
    if (!valid(from) || !valid(to)) return 'Jam promo tidak sah'
    if (from === to) return 'Jam mulai dan jam selesai tidak boleh sama'
  }
  if (rule.maxPerNote != null && !isPositiveInt(rule.maxPerNote)) return 'Maksimal per nota harus angka bulat lebih dari 0'
  if (rule.quotaKind != null) {
    if (!PROMO_QUOTA_KINDS.includes(rule.quotaKind)) return 'Jenis kuota tidak dikenal'
    if (!isPositiveInt(rule.quotaPerBranch)) return 'Jatah kuota per cabang harus angka bulat lebih dari 0'
  } else if (rule.quotaPerBranch != null) {
    return 'Jatah kuota diisi tetapi jenis kuota belum dipilih'
  }
  if (rule.conditions.length === 0) return 'Promo harus punya sekurangnya satu barang syarat'
  if (rule.rewards.length === 0) return 'Promo harus punya sekurangnya satu barang yang dipotong'
  if (rule.conditions.some((c) => !isPositiveInt(c.minQty))) return 'Jumlah minimal barang syarat harus angka bulat lebih dari 0'
  if (hasDuplicateItem(rule.conditions)) return 'Barang syarat yang sama tidak boleh ditulis dua kali'
  if (hasDuplicateItem(rule.rewards)) return 'Barang yang dipotong tidak boleh ditulis dua kali'
  for (const reward of rule.rewards) {
    if (!PROMO_REWARD_TYPES.includes(reward.type)) return 'Cara potong tidak dikenal'
    if (reward.qty != null && !isPositiveInt(reward.qty)) return 'Jumlah barang yang dipotong harus angka bulat lebih dari 0'
    if (reward.type === 'GRATIS') {
      // Barang gratis = baris tambahan; harus jelas berapa pcs gratis per satu kali pakai.
      if (!isPositiveInt(reward.qty)) return 'Barang gratis harus diisi berapa pcs gratis per satu kali pakai'
    } else if (!isPositiveInt(reward.value)) {
      return 'Nilai potongan / harga promo harus angka rupiah lebih dari 0'
    }
  }
  return null
}

/**
 * Promo yang bisa dihitung mesin: hadiahnya potongan harga (POTONG_PER_PCS / HARGA_JADI) atau
 * barang gratis (GRATIS — beli X gratis Y, mulai P4). Ketiga jenis hadiah kini dilayani; sisakan
 * fungsi ini sebagai penjaga bentuk bila ada jenis hadiah baru yang belum didukung.
 */
export function isPromoSupported(rule: Pick<PromoRule, 'rewards'>): boolean {
  return rule.rewards.every((r) => PROMO_REWARD_TYPES.includes(r.type))
}

/** Menit sejak 00.00 WIB untuk satu waktu (server berjalan di UTC). */
export function wibMinuteOfDay(now: Date): number {
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes()
  return (utc + WIB_OFFSET_MINUTES) % MINUTES_PER_DAY
}

export interface PromoContext {
  branchId: number
  /** Golongan pelanggan nota; null = tanpa pelanggan (umum). */
  customerTier: string | null
  /** Waktu menurut SERVER. */
  now: Date
  /** Keranjang PO Internal — di luar jangkauan promo. */
  internalPo?: boolean
  /** Saklar darurat: false = semua promo dimatikan. */
  enabled?: boolean
  /**
   * Sisa jatah kuota per promo untuk CABANG ini (pcs atau nota, sesuai quotaKind). Disuplai
   * pemanggil (server membaca `promo_branch_usage`). Promo berkuota yang tidak ada di peta ini
   * dianggap jatahnya masih penuh (`quotaPerBranch`) — layar kasir optimistis, server yang menghakimi.
   */
  remainingQuota?: Map<number, number>
  /**
   * Sisa stok barang hadiah per `produk:satuan` di CABANG ini (untuk promo `requireStock`).
   * Nilai > 0 = ada. Barang yang tidak ada di peta dianggap tersedia (server yang menghakimi).
   */
  stock?: Map<string, number>
  /**
   * Harga Retail satu pcs barang hadiah per `produk:satuan` di CABANG ini — dipakai hanya untuk
   * hadiah `GRATIS` (barang gratis tidak ada di keranjang, jadi harganya disuplai pemanggil:
   * server dari DB, layar dari katalog). Barang hadiah tanpa harga di peta ini tidak bisa
   * digratiskan (dilewati). Mesin tetap murni — tidak membaca database.
   */
  rewardPrices?: Map<string, number>
}

/** Promo ini sedang berlaku untuk cabang, pelanggan, dan waktu tersebut? */
export function isPromoRunning(rule: PromoRule, ctx: PromoContext): boolean {
  if (ctx.enabled === false || ctx.internalPo) return false
  if (ctx.customerTier != null && ctx.customerTier !== PROMO_TIER) return false
  if (!rule.isActive || !rule.branchIds.includes(ctx.branchId)) return false
  const now = ctx.now.getTime()
  if (!(new Date(rule.startsAt).getTime() <= now && now < new Date(rule.endsAt).getTime())) return false
  const { dailyStartMinute: from, dailyEndMinute: to } = rule
  if (from == null || to == null) return true
  const minute = wibMinuteOfDay(ctx.now)
  // Jam yang melewati tengah malam (mis. 22.00–02.00) berlaku sebelum dan sesudah pukul 00.00.
  return from < to ? minute >= from && minute < to : minute >= from || minute < to
}

export interface PromoCartLine {
  /** Kunci baris milik pemanggil; dikembalikan apa adanya di hasil. */
  key: string
  productId: number
  uomId: number
  qty: number
  unitPrice: string | number
  priceTier: string
  /** Baris yang tidak boleh kena promo (ongkos kirim). */
  excluded?: boolean
}

export interface PromoLineResult {
  key: string
  promoId: number
  promoName: string
  /** Berapa pcs di baris ini yang dipotong. */
  units: number
  /** Potongan untuk seluruh baris (rupiah). */
  amount: number
}

/** Barang gratis (hadiah `GRATIS`) yang harus DITAMBAHKAN ke keranjang sebagai baris tersendiri. */
export interface PromoGift {
  promoId: number
  promoName: string
  productId: number
  uomId: number
  /** Harga Retail satu pcs barang itu (snapshot; dipakai sebagai harga baris sebelum dipotong). */
  unitPrice: number
  /** Berapa pcs gratis. */
  qty: number
  /** Nilai potongan untuk baris gratis = unitPrice × qty (barisnya jadi Rp0). */
  amount: number
}

export interface PromoApplied {
  promoId: number
  promoName: string
  /** Berapa kali promo dipakai di nota ini. */
  times: number
  amount: number
}

export interface PromoResult {
  lines: PromoLineResult[]
  /** Barang gratis yang harus ditambahkan ke keranjang (hadiah `GRATIS`). */
  gifts: PromoGift[]
  applied: PromoApplied[]
  total: number
}

interface Candidate {
  rule: PromoRule
  times: number
  amount: number
  /** Barang (produk:satuan) yang dipakai promo ini, sebagai syarat maupun hadiah. */
  items: Set<string>
  lines: PromoLineResult[]
  gifts: PromoGift[]
}

const EMPTY_RESULT: PromoResult = { lines: [], gifts: [], applied: [], total: 0 }

function unitDiscount(reward: PromoReward, unitPrice: string | number): Big {
  const price = new Big(unitPrice)
  if (reward.type === 'GRATIS') return price // gratis = potongan penuh harga barangnya
  const cut = reward.type === 'HARGA_JADI' ? price.minus(reward.value) : new Big(reward.value)
  if (cut.lte(0)) return new Big(0)
  return cut.gt(price) ? price : cut
}

/** Sisa jatah kuota promo untuk cabang ini; tanpa kuota = Infinity. Tak disuplai = jatah penuh. */
function remainingQuotaOf(rule: PromoRule, ctx: PromoContext): number {
  if (rule.quotaKind == null || rule.quotaPerBranch == null) return Infinity
  return ctx.remainingQuota?.get(rule.id) ?? rule.quotaPerBranch
}

function buildCandidate(rule: PromoRule, groups: Map<string, PromoCartLine[]>, ctx: PromoContext): Candidate | null {
  const qtyOf = (key: string) => (groups.get(key) ?? []).reduce((acc, l) => acc + l.qty, 0)
  let possible = Infinity
  for (const condition of rule.conditions) {
    possible = Math.min(possible, Math.floor(qtyOf(itemKey(condition)) / condition.minQty))
  }
  if (!Number.isFinite(possible) || possible < 1) return null
  let times = rule.isMultiple ? possible : 1
  if (rule.maxPerNote != null) times = Math.min(times, rule.maxPerNote)

  // Kuota per cabang. Kuota nota: satu nota makan 1 jatah → habis berarti promo tidak berlaku
  // sama sekali. Kuota pcs: jatah membatasi jumlah pcs hadiah yang kebagian (potong sebagian).
  const remainingQuota = remainingQuotaOf(rule, ctx)
  if (rule.quotaKind === 'NOTA' && remainingQuota < 1) return null
  let pcsLeft = rule.quotaKind === 'PCS' ? remainingQuota : Infinity
  if (pcsLeft < 1) return null

  const lines: PromoLineResult[] = []
  const gifts: PromoGift[] = []
  const items = new Set(rule.conditions.map(itemKey))
  for (const reward of rule.rewards) {
    if (pcsLeft <= 0) break
    const key = itemKey(reward)
    // Syarat stok: barang hadiah yang stoknya habis di cabang ini tidak kena promo.
    if (rule.requireStock && (ctx.stock?.get(key) ?? Infinity) <= 0) continue

    // Hadiah GRATIS: barang gratis DITAMBAHKAN sebagai baris tersendiri (bukan dari baris yang
    // sudah ada). Harganya disuplai pemanggil (ctx.rewardPrices); tanpa harga tidak bisa digratiskan.
    if (reward.type === 'GRATIS') {
      const unitPrice = ctx.rewardPrices?.get(key)
      if (unitPrice == null || unitPrice <= 0) continue
      const giftQty = Math.min((reward.qty ?? 0) * times, pcsLeft)
      if (giftQty <= 0) continue
      const amount = Number(unitDiscount(reward, unitPrice).times(giftQty).round(0, Big.roundDown).toString())
      if (amount <= 0) continue
      pcsLeft -= giftQty
      items.add(key)
      gifts.push({ promoId: rule.id, promoName: rule.name, productId: reward.productId, uomId: reward.uomId, unitPrice, qty: giftQty, amount })
      continue
    }

    let remaining = reward.qty == null ? Infinity : reward.qty * times
    for (const line of groups.get(key) ?? []) {
      if (pcsLeft <= 0) break
      const units = Math.min(line.qty, remaining, pcsLeft)
      if (units <= 0) break
      const amount = Number(unitDiscount(reward, line.unitPrice).times(units).round(0, Big.roundDown).toString())
      // Jatah pcs hanya terpakai bila baris benar-benar dapat potongan (harga sudah lebih murah → tidak).
      if (amount <= 0) { remaining -= units; continue }
      remaining -= units
      pcsLeft -= units
      items.add(key)
      lines.push({ key: line.key, promoId: rule.id, promoName: rule.name, units, amount })
    }
  }
  const amount = lines.reduce((acc, l) => acc + l.amount, 0) + gifts.reduce((acc, g) => acc + g.amount, 0)
  return amount > 0 ? { rule, times, amount, items, lines, gifts } : null
}

const overlaps = (a: Set<string>, b: Set<string>) => [...a].some((key) => b.has(key))

/** Gabungan promo yang tidak berebut barang dengan total potongan terbesar. */
function pickBest(candidates: Candidate[]): Candidate[] {
  if (candidates.length > EXHAUSTIVE_PICK_LIMIT) {
    const picked: Candidate[] = []
    for (const c of [...candidates].sort((a, b) => b.amount - a.amount || a.rule.id - b.rule.id)) {
      if (!picked.some((p) => overlaps(p.items, c.items))) picked.push(c)
    }
    return picked
  }
  let best: Candidate[] = []
  let bestAmount = 0
  const walk = (index: number, picked: Candidate[], amount: number) => {
    if (index === candidates.length) {
      // Hanya yang benar-benar lebih besar yang menggantikan: bila seri, promo ber-id kecil menang.
      if (amount > bestAmount) {
        best = picked
        bestAmount = amount
      }
      return
    }
    const candidate = candidates[index]!
    if (!picked.some((p) => overlaps(p.items, candidate.items))) {
      walk(index + 1, [...picked, candidate], amount + candidate.amount)
    }
    walk(index + 1, picked, amount)
  }
  walk(0, [], 0)
  return best
}

/**
 * Hitung promo untuk satu keranjang. Hasilnya potongan per baris (satu baris paling banyak
 * satu promo) dan daftar promo yang dipakai. Keranjang tanpa promo → hasil kosong.
 */
export function applyPromos(lines: PromoCartLine[], rules: PromoRule[], ctx: PromoContext): PromoResult {
  const running = rules
    .filter((rule) => isPromoSupported(rule) && checkPromoRule(rule) === null && isPromoRunning(rule, ctx))
    .sort((a, b) => a.id - b.id)
  if (running.length === 0) return EMPTY_RESULT

  const groups = new Map<string, PromoCartLine[]>()
  for (const line of lines) {
    if (line.excluded || line.priceTier !== PROMO_TIER || !isPositiveInt(line.qty)) continue
    const key = itemKey(line)
    groups.set(key, [...(groups.get(key) ?? []), line])
  }
  if (groups.size === 0) return EMPTY_RESULT

  const candidates = running
    .map((rule) => buildCandidate(rule, groups, ctx))
    .filter((c): c is Candidate => c !== null)
  const picked = pickBest(candidates).sort((a, b) => a.rule.id - b.rule.id)
  return {
    lines: picked.flatMap((c) => c.lines),
    gifts: picked.flatMap((c) => c.gifts),
    applied: picked.map((c) => ({ promoId: c.rule.id, promoName: c.rule.name, times: c.times, amount: c.amount })),
    total: picked.reduce((acc, c) => acc + c.amount, 0),
  }
}

// ── Pembuatan promo (layar Promo Back Office, P2b) ─────────────────────────────────────────────

/** Bentuk promo yang sudah bisa dibuat. Beli X gratis Y, bundling, dan hadiah pilihan menyusul. */
export const CREATABLE_PROMO_KINDS: readonly PromoKind[] = ['POTONGAN', 'FLASH_SALE']

/** Jenis hadiah yang sudah bisa dibuat lewat layar Promo. Hadiah GRATIS menyusul di P4b. */
const CREATABLE_REWARD_TYPES: readonly PromoRewardType[] = ['POTONG_PER_PCS', 'HARGA_JADI']

/** Pemeriksaan saat membuat promo: bentuknya sah DAN bentuknya sudah bisa dibuat lewat layar. */
export function checkNewPromo(rule: Omit<PromoRule, 'id'>): string | null {
  const problem = checkPromoRule(rule)
  if (problem) return problem
  if (!CREATABLE_PROMO_KINDS.includes(rule.kind) || rule.rewards.some((r) => !CREATABLE_REWARD_TYPES.includes(r.type))) {
    return 'Bentuk promo ini belum bisa dibuat — baru potongan harga dan flash sale'
  }
  return null
}

/** Harga satu pcs sesudah promo (tidak pernah naik, tidak pernah di bawah 0). */
export function promoUnitPrice(reward: Pick<PromoReward, 'type' | 'value'>, unitPrice: number): number {
  return Number(new Big(unitPrice).minus(unitDiscount({ ...reward, productId: 0, uomId: 0, qty: null }, unitPrice)).toString())
}

export type PromoStatus = 'BERJALAN' | 'BELUM_MULAI' | 'BERAKHIR' | 'NONAKTIF'

export const PROMO_STATUS_LABEL: Record<PromoStatus, string> = {
  BERJALAN: 'Berjalan',
  BELUM_MULAI: 'Belum mulai',
  BERAKHIR: 'Berakhir',
  NONAKTIF: 'Dinonaktifkan',
}

/** Keadaan promo menurut masa berlakunya (jam harian tidak dihitung). */
export function promoStatus(rule: Pick<PromoRule, 'isActive' | 'startsAt' | 'endsAt'>, now: Date): PromoStatus {
  if (!rule.isActive) return 'NONAKTIF'
  const t = now.getTime()
  if (t < new Date(rule.startsAt).getTime()) return 'BELUM_MULAI'
  if (t >= new Date(rule.endsAt).getTime()) return 'BERAKHIR'
  return 'BERJALAN'
}
