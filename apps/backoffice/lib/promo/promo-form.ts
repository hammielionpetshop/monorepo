import {
  checkNewPromo, promoUnitPrice, PROMO_KIND_LABEL,
  type PromoKind, type PromoRule, type PromoRewardType,
} from './promo-engine'

// Isian layar Promo Back Office (P2b bagian 2) → bentuk kiriman `POST /api/bo/promos`, dan
// kalimat ringkas untuk daftar promo. Murni, tanpa database; aturan promo tetap di mesin promo
// (promo-engine.ts) — berkas ini hanya menerjemahkan isian form ke bentuk aturannya.

export const PROMO_FORM_SHAPES = ['POTONGAN', 'MULAI_N', 'BELI_A_POTONG_B', 'FLASH_SALE'] as const
export type PromoFormShape = (typeof PROMO_FORM_SHAPES)[number]

export const PROMO_FORM_SHAPE_LABEL: Record<PromoFormShape, string> = {
  POTONGAN: 'Potongan harga satu barang',
  MULAI_N: 'Harga khusus mulai sekian pcs',
  BELI_A_POTONG_B: 'Beli barang A, barang B lebih murah',
  FLASH_SALE: 'Flash sale (jam tertentu)',
}

export const PROMO_FORM_SHAPE_HINT: Record<PromoFormShape, string> = {
  POTONGAN: 'Semua pcs barang ini lebih murah selama masa promo.',
  MULAI_N: 'Begitu pelanggan membeli sekian pcs atau lebih, semua pcs barang ini lebih murah.',
  BELI_A_POTONG_B: 'Bila barang syarat ada di keranjang (sejumlah minimalnya), barang yang dipotong lebih murah sekian pcs.',
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
  rewards: (PromoFormItem & { qty: string })[]
  isMultiple: boolean
  maxPerNote: string
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
  conditions: { productId: number; uomId: number; minQty: number }[]
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
    rewards: [],
    isMultiple: true,
    maxPerNote: '',
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

  const value = parseWholeNumber(form.cutValue)
  if (!value) return { error: 'Isi besar potongan / harga promo dalam rupiah' }

  let conditions: PromoPayload['conditions']
  let rewards: PromoPayload['rewards']
  let isMultiple = form.isMultiple
  let maxPerNote: number | null = null

  if (form.shape === 'BELI_A_POTONG_B') {
    if (form.conditions.length === 0) return { error: 'Pilih sekurangnya satu barang syarat' }
    if (form.rewards.length === 0) return { error: 'Pilih sekurangnya satu barang yang dipotong' }
    conditions = []
    for (const c of form.conditions) {
      const minQty = parseWholeNumber(c.minQty)
      if (!minQty) return { error: 'Isi jumlah minimal tiap barang syarat' }
      conditions.push({ productId: c.productId, uomId: c.uomId, minQty })
    }
    rewards = []
    for (const r of form.rewards) {
      const qty = parseWholeNumber(r.qty)
      if (!qty) return { error: 'Isi berapa pcs barang yang dipotong untuk tiap kali promo terpakai' }
      rewards.push({ productId: r.productId, uomId: r.uomId, type: form.cutType, value, qty })
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

  const payload: PromoPayload = {
    name: form.name.trim(),
    kind: form.shape === 'FLASH_SALE' ? 'FLASH_SALE' : 'POTONGAN',
    note: form.note.trim() || null,
    branchIds: [...new Set(form.branchIds)],
    startsAt,
    endsAt,
    dailyStartMinute,
    dailyEndMinute,
    isMultiple,
    maxPerNote,
    conditions,
    rewards,
  }
  const problem = checkNewPromo({ ...payload, isActive: true })
  return problem ? { error: problem } : { payload }
}

// ── Kalimat ringkas untuk daftar promo ─────────────────────────────────────────────────────

type NamedItem = { productName: string; uomCode: string }
type DescribedRule = Pick<PromoRule, 'kind' | 'isMultiple' | 'maxPerNote'> & {
  conditions: (PromoRule['conditions'][number] & NamedItem)[]
  rewards: (PromoRule['rewards'][number] & NamedItem)[]
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
    return lines
  }
  lines.push(`Syarat: ${rule.conditions.map((c) => `${c.minQty} pcs ${itemName(c)}`).join(' + ')}`)
  for (const r of rule.rewards) {
    const pcs = r.qty == null ? 'semua pcs' : `${r.qty} pcs tiap kali terpakai`
    lines.push(`Dipotong: ${itemName(r)} — ${cutText(r)}, ${pcs}`)
  }
  const multiple = rule.isMultiple
    ? rule.maxPerNote != null ? `Berlaku kelipatan, paling banyak ${rule.maxPerNote}× per nota` : 'Berlaku kelipatan'
    : 'Satu kali per nota'
  lines.push(multiple)
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
