import {
  checkNewPromo, conditionUnits, promoUnitPrice, CREATABLE_PROMO_KINDS, PROMO_KIND_LABEL, PROMO_QUOTA_KIND_LABEL,
  type PromoKind, type PromoQuotaKind, type PromoRule, type PromoRewardType,
} from './promo-engine'

export { PROMO_QUOTA_KIND_LABEL }
export type { PromoQuotaKind }

// Isian layar Promo Back Office (P2b bagian 2) → bentuk kiriman `POST /api/bo/promos`, dan
// kalimat ringkas untuk daftar promo. Murni, tanpa database; aturan promo tetap di mesin promo
// (promo-engine.ts) — berkas ini hanya menerjemahkan isian form ke bentuk aturannya.

export const PROMO_FORM_SHAPES = ['POTONGAN', 'MULAI_N', 'BELI_A_POTONG_B', 'BELI_GRATIS', 'BUNDLING', 'FLASH_SALE'] as const
export type PromoFormShape = (typeof PROMO_FORM_SHAPES)[number]

/** Bentuk yang baru di P4 (beli X gratis Y & bundling) — untuk tanda "Baru" di form. */
export const PROMO_FORM_SHAPES_BARU: readonly PromoFormShape[] = ['BELI_GRATIS', 'BUNDLING']

/** Bentuk yang memakai daftar barang syarat + daftar barang hadiah (bukan satu barang target). */
export function usesConditionList(shape: PromoFormShape): boolean {
  return shape === 'BELI_A_POTONG_B' || shape === 'BELI_GRATIS' || shape === 'BUNDLING'
}

/** Bentuk yang hadiahnya barang GRATIS (bukan potongan harga) → tanpa isian "cara potong". */
export function isGiftShape(shape: PromoFormShape): boolean {
  return shape === 'BELI_GRATIS'
}

export const PROMO_FORM_SHAPE_LABEL: Record<PromoFormShape, string> = {
  POTONGAN: 'Potongan harga satu barang',
  MULAI_N: 'Harga khusus mulai sekian pcs',
  BELI_A_POTONG_B: 'Beli barang A, barang B lebih murah',
  BELI_GRATIS: 'Beli X gratis Y',
  BUNDLING: 'Bundling (beberapa barang → potongan)',
  FLASH_SALE: 'Flash sale (jam tertentu)',
}

export const PROMO_FORM_SHAPE_HINT: Record<PromoFormShape, string> = {
  POTONGAN: 'Semua pcs barang ini lebih murah selama masa promo.',
  MULAI_N: 'Begitu pelanggan membeli sekian pcs atau lebih, semua pcs barang ini lebih murah.',
  BELI_A_POTONG_B: 'Bila barang syarat ada di keranjang (sejumlah minimalnya), barang yang dipotong lebih murah sekian pcs.',
  BELI_GRATIS: 'Bila barang syarat cukup di keranjang, barang hadiah ditambahkan otomatis sebagai baris GRATIS (Rp 0). Beli 2 gratis 1 (barang sama) atau beli A gratis B.',
  BUNDLING: 'Beberapa barang syarat harus ada bersama di keranjang → barang yang Anda tentukan dipotong harganya.',
  FLASH_SALE: 'Seperti potongan harga satu barang, biasanya untuk waktu singkat atau jam tertentu tiap hari.',
}

export const PROMO_CUT_LABEL: Record<Exclude<PromoRewardType, 'GRATIS'>, string> = {
  POTONG_PER_PCS: 'Potong per pcs (Rp)',
  HARGA_JADI: 'Harga jadi per pcs (Rp)',
}

export interface PromoFormItem {
  productId: number
  uomId: number
}

export interface PromoFormState {
  shape: PromoFormShape
  name: string
  note: string
  branchIds: number[]
  /** Tanggal & jam WIB: `YYYY-MM-DD` dan `HH:MM`. */
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  useDailyHours: boolean
  dailyFrom: string
  dailyTo: string
  cutType: Exclude<PromoRewardType, 'GRATIS'>
  cutValue: string
  /** Barang promo untuk bentuk potongan / mulai N / flash sale. */
  target: PromoFormItem | null
  /** Jumlah minimal untuk bentuk "mulai N pcs". */
  minQty: string
  /** Bentuk "beli A, B lebih murah". */
  conditions: (PromoFormItem & { minQty: string })[]
  /** Kelompok campur: anggota (rasa/aroma) dihitung bersama terhadap satu jumlah minimal. */
  conditionGroups: { members: PromoFormItem[]; minQty: string }[]
  rewards: (PromoFormItem & { qty: string })[]
  isMultiple: boolean
  maxPerNote: string
  /** Kuota total per cabang: '' = tanpa kuota, PCS = jatah pcs hadiah, NOTA = jatah nota. */
  quotaKind: '' | PromoQuotaKind
  /** Jatah per cabang bila berkuota (pcs atau nota, sesuai quotaKind). */
  quotaPerBranch: string
  /** Promo hanya ditawarkan selama stok barang hadiah di cabang itu masih ada. */
  requireStock: boolean
}

/** Bentuk kiriman ke `POST /api/bo/promos` (sama dengan `newPromoSchema`). */
export interface PromoPayload {
  name: string
  kind: PromoKind
  note: string | null
  branchIds: number[]
  startsAt: string
  endsAt: string
  dailyStartMinute: number | null
  dailyEndMinute: number | null
  isMultiple: boolean
  maxPerNote: number | null
  quotaKind: PromoQuotaKind | null
  quotaPerBranch: number | null
  requireStock: boolean
  conditions: { productId: number; uomId: number; minQty: number; groupNo?: number | null }[]
  rewards: { productId: number; uomId: number; type: PromoRewardType; value: number; qty: number | null }[]
  acceptLoss?: boolean
}

export function emptyPromoForm(today: string, branchIds: number[]): PromoFormState {
  return {
    shape: 'POTONGAN',
    name: '',
    note: '',
    branchIds,
    startDate: today,
    startTime: '00:00',
    endDate: today,
    endTime: '23:59',
    useDailyHours: false,
    dailyFrom: '',
    dailyTo: '',
    cutType: 'POTONG_PER_PCS',
    cutValue: '',
    target: null,
    minQty: '',
    conditions: [],
    conditionGroups: [],
    rewards: [],
    isMultiple: true,
    maxPerNote: '',
    quotaKind: '',
    quotaPerBranch: '',
    requireStock: false,
  }
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** "HH:MM" → menit sejak 00.00; selain itu null. */
export function timeToMinute(time: string): number | null {
  const m = TIME_RE.exec(time.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function minuteToTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}.${String(minute % 60).padStart(2, '0')}`
}

/** Angka bulat dari isian (titik ribuan dan huruf diabaikan); kosong → null. */
export function parseWholeNumber(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

/** Tanggal + jam WIB → waktu ISO berzona +07:00 (bentuk yang diterima server). */
export function wibDateTime(date: string, time: string): string | null {
  if (!DATE_RE.test(date) || timeToMinute(time) === null) return null
  const iso = `${date}T${time.trim()}:00+07:00`
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

/**
 * Isian form → kiriman ke server, atau pesan untuk pembuat promo. Pemeriksaan akhir tetap
 * `checkNewPromo` milik mesin promo (server memeriksa ulang dengan aturan yang sama).
 */
export function buildPromoPayload(form: PromoFormState): { payload: PromoPayload } | { error: string } {
  const startsAt = wibDateTime(form.startDate, form.startTime)
  const endsAt = wibDateTime(form.endDate, form.endTime)
  if (!startsAt || !endsAt) return { error: 'Masa berlaku promo wajib diisi (tanggal dan jam)' }

  let dailyStartMinute: number | null = null
  let dailyEndMinute: number | null = null
  if (form.useDailyHours) {
    dailyStartMinute = timeToMinute(form.dailyFrom)
    dailyEndMinute = timeToMinute(form.dailyTo)
    if (dailyStartMinute === null || dailyEndMinute === null) return { error: 'Jam promo tiap hari wajib diisi (jam mulai dan jam selesai)' }
  }

  const gift = isGiftShape(form.shape)
  // Hadiah gratis tidak punya nilai potongan (baris Rp 0); bentuk lain wajib isi nilainya.
  let value = 0
  if (!gift) {
    const parsed = parseWholeNumber(form.cutValue)
    if (!parsed) return { error: 'Isi besar potongan / harga promo dalam rupiah' }
    value = parsed
  }

  let quotaKind: PromoQuotaKind | null = null
  let quotaPerBranch: number | null = null
  if (form.quotaKind) {
    quotaKind = form.quotaKind
    quotaPerBranch = parseWholeNumber(form.quotaPerBranch)
    if (!quotaPerBranch) return { error: 'Isi jatah kuota per cabang (angka lebih dari 0), atau pilih tanpa kuota' }
  }

  let conditions: PromoPayload['conditions']
  let rewards: PromoPayload['rewards']
  let isMultiple = form.isMultiple
  let maxPerNote: number | null = null

  if (usesConditionList(form.shape)) {
    if (form.conditions.length === 0 && form.conditionGroups.length === 0) return { error: 'Pilih sekurangnya satu barang syarat' }
    if (form.rewards.length === 0) return { error: gift ? 'Pilih sekurangnya satu barang hadiah gratis' : 'Pilih sekurangnya satu barang yang dipotong' }
    conditions = []
    for (const c of form.conditions) {
      const minQty = parseWholeNumber(c.minQty)
      if (!minQty) return { error: 'Isi jumlah minimal tiap barang syarat' }
      conditions.push({ productId: c.productId, uomId: c.uomId, minQty })
    }
    for (const [index, group] of form.conditionGroups.entries()) {
      const minQty = parseWholeNumber(group.minQty)
      if (!minQty) return { error: 'Isi jumlah minimal tiap kelompok campur' }
      if (group.members.length < 2) return { error: 'Kelompok campur harus berisi sekurangnya 2 barang' }
      for (const m of group.members) conditions.push({ productId: m.productId, uomId: m.uomId, minQty, groupNo: index + 1 })
    }
    rewards = []
    for (const r of form.rewards) {
      const qty = parseWholeNumber(r.qty)
      if (!qty) return { error: gift ? 'Isi berapa pcs gratis untuk tiap kali promo terpakai' : 'Isi berapa pcs barang yang dipotong untuk tiap kali promo terpakai' }
      rewards.push({ productId: r.productId, uomId: r.uomId, type: gift ? 'GRATIS' : form.cutType, value: gift ? 0 : value, qty })
    }
    if (form.maxPerNote.trim()) {
      maxPerNote = parseWholeNumber(form.maxPerNote)
      if (!maxPerNote) return { error: 'Maksimal per nota harus angka lebih dari 0, atau kosongkan' }
    }
  } else {
    if (!form.target) return { error: 'Pilih barang promonya' }
    const minQty = form.shape === 'MULAI_N' ? parseWholeNumber(form.minQty) : 1
    if (!minQty) return { error: 'Isi mulai berapa pcs harga khusus berlaku' }
    if (form.shape === 'MULAI_N' && minQty < 2) return { error: 'Harga khusus mulai sekian pcs: isi 2 pcs atau lebih (1 pcs = potongan harga biasa)' }
    // Semua pcs barang itu dipotong begitu syaratnya terpenuhi; kelipatan tidak berpengaruh.
    conditions = [{ ...form.target, minQty }]
    rewards = [{ ...form.target, type: form.cutType, value, qty: null }]
    isMultiple = false
  }

  const kind: PromoKind =
    form.shape === 'FLASH_SALE' ? 'FLASH_SALE'
      : form.shape === 'BELI_GRATIS' ? 'BELI_GRATIS'
        : form.shape === 'BUNDLING' ? 'BUNDLING'
          : 'POTONGAN'

  const payload: PromoPayload = {
    name: form.name.trim(),
    kind,
    note: form.note.trim() || null,
    branchIds: [...new Set(form.branchIds)],
    startsAt,
    endsAt,
    dailyStartMinute,
    dailyEndMinute,
    isMultiple,
    maxPerNote,
    quotaKind,
    quotaPerBranch,
    requireStock: form.requireStock,
    conditions,
    rewards,
  }
  const problem = checkNewPromo({ ...payload, isActive: true })
  return problem ? { error: problem } : { payload }
}

// ── Kalimat ringkas untuk daftar promo ─────────────────────────────────────────────────────

type NamedItem = { productName: string; uomCode: string }
type DescribedRule = Pick<PromoRule, 'kind' | 'isMultiple' | 'maxPerNote' | 'quotaKind' | 'quotaPerBranch' | 'requireStock'> & {
  conditions: (PromoRule['conditions'][number] & NamedItem)[]
  rewards: (PromoRule['rewards'][number] & NamedItem)[]
}

/** Kalimat kuota per cabang & syarat stok (bila ada); kosong bila promo tanpa batas ini. */
function quotaStockLines(rule: Pick<DescribedRule, 'quotaKind' | 'quotaPerBranch' | 'requireStock'>): string[] {
  const lines: string[] = []
  if (rule.quotaKind && rule.quotaPerBranch != null) {
    const unit = rule.quotaKind === 'PCS' ? 'pcs hadiah' : 'nota'
    lines.push(`Kuota: ${rule.quotaPerBranch} ${unit} per cabang`)
  }
  if (rule.requireStock) lines.push('Hanya selama stok barang hadiah di cabang itu masih ada')
  return lines
}

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const itemName = (i: NamedItem) => `${i.productName} (${i.uomCode})`

/** "potong Rp 2.000 per pcs" / "harga jadi Rp 15.000 per pcs". */
export function cutText(reward: Pick<PromoRule['rewards'][number], 'type' | 'value'>): string {
  if (reward.type === 'HARGA_JADI') return `harga jadi ${rupiah(reward.value)} per pcs`
  if (reward.type === 'POTONG_PER_PCS') return `potong ${rupiah(reward.value)} per pcs`
  return 'gratis'
}

/** Harga satu pcs sebelum → sesudah promo, untuk pratinjau di form. */
export function promoPricePreview(reward: Pick<PromoRule['rewards'][number], 'type' | 'value'>, price: number): string {
  return `${rupiah(price)} → ${rupiah(promoUnitPrice(reward, price))}`
}

/** Beberapa kalimat yang menjelaskan isi promo untuk Owner/GM. */
export function describePromo(rule: DescribedRule): string[] {
  const lines: string[] = []
  const sameItem = rule.conditions.length === 1 && rule.rewards.length === 1
    && rule.conditions[0]!.productId === rule.rewards[0]!.productId
    && rule.conditions[0]!.uomId === rule.rewards[0]!.uomId
    && rule.rewards[0]!.qty == null
  if (sameItem) {
    const c = rule.conditions[0]!
    const r = rule.rewards[0]!
    const from = c.minQty > 1 ? `mulai ${c.minQty} pcs, ` : ''
    lines.push(`${itemName(r)}: ${from}${cutText(r)} (semua pcs)`)
    lines.push(...quotaStockLines(rule))
    return lines
  }
  const units = conditionUnits(rule.conditions) as DescribedRule['conditions'][]
  lines.push(`Syarat: ${units.map((unit) => unit[0]!.groupNo == null
    ? `${unit[0]!.minQty} pcs ${itemName(unit[0]!)}`
    : `${unit[0]!.minQty} ${unit[0]!.uomCode} campur dari ${unit.map((c) => c.productName).join(' / ')}`).join(' + ')}`)
  for (const r of rule.rewards) {
    if (r.type === 'GRATIS') {
      lines.push(`Gratis: ${itemName(r)} — ${r.qty ?? 1} pcs tiap kali terpakai`)
      continue
    }
    const pcs = r.qty == null ? 'semua pcs' : `${r.qty} pcs tiap kali terpakai`
    lines.push(`Dipotong: ${itemName(r)} — ${cutText(r)}, ${pcs}`)
  }
  const multiple = rule.isMultiple
    ? rule.maxPerNote != null ? `Berlaku kelipatan, paling banyak ${rule.maxPerNote}× per nota` : 'Berlaku kelipatan'
    : 'Satu kali per nota'
  lines.push(multiple)
  lines.push(...quotaStockLines(rule))
  return lines
}

export function promoKindLabel(kind: string): string {
  return PROMO_KIND_LABEL[kind as PromoKind] ?? kind
}

const PERIOD_FORMAT = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})

/** "13 Okt 2026 08.00 – 20 Okt 2026 22.00 WIB · tiap hari 10.00–12.00". */
export function formatPromoPeriod(rule: Pick<PromoRule, 'startsAt' | 'endsAt' | 'dailyStartMinute' | 'dailyEndMinute'>): string {
  const range = `${PERIOD_FORMAT.format(new Date(rule.startsAt))} – ${PERIOD_FORMAT.format(new Date(rule.endsAt))} WIB`
  if (rule.dailyStartMinute == null || rule.dailyEndMinute == null) return range
  return `${range} · tiap hari ${minuteToTime(rule.dailyStartMinute)}–${minuteToTime(rule.dailyEndMinute)}`
}

// ── Salin promo & ubah tanggal ─────────────────────────────────────────────────────────────

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Waktu → tanggal & jam WIB untuk isian form (`YYYY-MM-DD`, `HH:MM`). */
export function wibParts(at: Date | string): { date: string; time: string } {
  const iso = new Date(new Date(at).getTime() + WIB_OFFSET_MS).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** `YYYY-MM-DD` + n hari. */
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

const hhmm = (minute: number) => minuteToTime(minute).replace('.', ':')

type CopiedRule = Pick<PromoRule,
  'name' | 'kind' | 'branchIds' | 'startsAt' | 'endsAt' | 'dailyStartMinute' | 'dailyEndMinute'
  | 'isMultiple' | 'maxPerNote' | 'quotaKind' | 'quotaPerBranch' | 'requireStock' | 'conditions' | 'rewards'
> & { note: string | null }

/**
 * Isian form dari promo yang sudah ada, untuk "Salin jadi promo baru". Null = bentuknya belum bisa
 * dibuat lewat layar. Masa berlaku disalin apa adanya bila promo belum berakhir; bila sudah
 * berakhir, digeser mulai `today` dengan lama hari yang sama. Cabang yang tidak bisa dipilih
 * (`allowedBranchIds`) dibuang.
 */
export function promoToForm(rule: CopiedRule, today: string, now: Date, allowedBranchIds: number[]): PromoFormState | null {
  if (!CREATABLE_PROMO_KINDS.includes(rule.kind) || rule.conditions.length === 0 || rule.rewards.length === 0) return null
  const first = rule.rewards[0]!
  const sameItem = rule.conditions.length === 1 && rule.rewards.length === 1
    && rule.conditions[0]!.productId === first.productId && rule.conditions[0]!.uomId === first.uomId
    && first.qty == null && first.type !== 'GRATIS'

  let shape: PromoFormShape
  if (rule.kind === 'BELI_GRATIS') shape = 'BELI_GRATIS'
  else if (rule.kind === 'BUNDLING') shape = 'BUNDLING'
  else if (!sameItem) shape = 'BELI_A_POTONG_B'
  else if (rule.kind === 'FLASH_SALE') shape = 'FLASH_SALE'
  else shape = rule.conditions[0]!.minQty > 1 ? 'MULAI_N' : 'POTONGAN'
  if (rule.kind === 'FLASH_SALE' && !sameItem) return null

  let start = wibParts(rule.startsAt)
  let end = wibParts(rule.endsAt)
  if (new Date(rule.endsAt).getTime() <= now.getTime()) {
    const days = Math.round((Date.parse(`${end.date}T00:00:00Z`) - Date.parse(`${start.date}T00:00:00Z`)) / DAY_MS)
    start = { date: today, time: start.time }
    end = { date: addDays(today, days), time: end.time }
  }

  const form = emptyPromoForm(today, rule.branchIds.filter((id) => allowedBranchIds.includes(id)))
  form.shape = shape
  form.name = rule.name
  form.note = rule.note ?? ''
  form.startDate = start.date
  form.startTime = start.time
  form.endDate = end.date
  form.endTime = end.time
  if (rule.dailyStartMinute != null && rule.dailyEndMinute != null) {
    form.useDailyHours = true
    form.dailyFrom = hhmm(rule.dailyStartMinute)
    form.dailyTo = hhmm(rule.dailyEndMinute)
  }
  if (first.type !== 'GRATIS') {
    form.cutType = first.type
    form.cutValue = String(first.value)
  }
  form.isMultiple = rule.isMultiple
  form.maxPerNote = rule.maxPerNote != null ? String(rule.maxPerNote) : ''
  form.quotaKind = rule.quotaKind ?? ''
  form.quotaPerBranch = rule.quotaPerBranch != null ? String(rule.quotaPerBranch) : ''
  form.requireStock = rule.requireStock ?? false

  if (sameItem) {
    const c = rule.conditions[0]!
    form.target = { productId: c.productId, uomId: c.uomId }
    form.minQty = shape === 'MULAI_N' ? String(c.minQty) : ''
    return form
  }
  for (const unit of conditionUnits(rule.conditions)) {
    if (unit[0]!.groupNo == null) {
      for (const c of unit) form.conditions.push({ productId: c.productId, uomId: c.uomId, minQty: String(c.minQty) })
    } else {
      form.conditionGroups.push({ members: unit.map((c) => ({ productId: c.productId, uomId: c.uomId })), minQty: String(unit[0]!.minQty) })
    }
  }
  form.rewards = rule.rewards.map((r) => ({ productId: r.productId, uomId: r.uomId, qty: String(r.qty ?? 1) }))
  return form
}

/**
 * Isian ubah tanggal → kiriman `PATCH /api/bo/promos/[id]/dates`, atau pesan. Pemeriksaan akhir
 * (promo sudah berjalan, sudah nonaktif) tetap di server.
 */
export function buildPromoDatesPayload(
  input: { startDate: string; startTime: string; endDate: string; endTime: string },
  now: Date,
): { payload: { startsAt: string; endsAt: string } } | { error: string } {
  const startsAt = wibDateTime(input.startDate, input.startTime)
  const endsAt = wibDateTime(input.endDate, input.endTime)
  if (!startsAt || !endsAt) return { error: 'Masa berlaku promo wajib diisi (tanggal dan jam)' }
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return { error: 'Promo harus berakhir sesudah waktu mulainya' }
  if (new Date(endsAt).getTime() <= now.getTime()) return { error: 'Waktu berakhir harus di masa depan. Untuk menghentikan promo, pakai Nonaktifkan.' }
  return { payload: { startsAt, endsAt } }
}
