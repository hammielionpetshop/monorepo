import type { ItemRow } from './types'

// Draft pembuatan PO Internal disimpan di browser, bukan di server: draf hanya ada
// di komputer & browser tempat ia ditahan, dan ikut hilang kalau data situs
// dibersihkan. Pola sama dengan draf bulk sale
// (transactions/bulk-sale/_components/bulk-sale-drafts.ts) dan draf SO Besar.
// Satu draf per cabang — cukup, karena satu cabang jarang menyusun dua PO
// sekaligus, dan form-nya memang di-scope ke cabang kasir yang login.

const KEY_PREFIX = 'internal_order_draft_v1_'

export interface InternalOrderDraft {
  savedAt: string
  destinationBranchId: number
  sourceBranchId: number | null
  notes: string
  items: ItemRow[]
}

function storageKey(branchId: number) {
  return `${KEY_PREFIX}${branchId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseUom(value: unknown): ItemRow['availableUoms'][number] | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.ratio !== 'number'
  ) {
    return null
  }
  return { id: value.id, name: value.name, ratio: value.ratio }
}

function parseItem(value: unknown): ItemRow | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'number' ||
    typeof value.productId !== 'number' ||
    typeof value.productName !== 'string' ||
    typeof value.productCode !== 'string' ||
    typeof value.uomId !== 'number' ||
    typeof value.uomName !== 'string' ||
    typeof value.baseDefaultCostPrice !== 'number' ||
    typeof value.qtyRequested !== 'number' ||
    typeof value.costPrice !== 'number' ||
    !Array.isArray(value.availableUoms)
  ) {
    return null
  }
  const availableUoms = value.availableUoms
    .map(parseUom)
    .filter((u): u is ItemRow['availableUoms'][number] => u !== null)
  if (availableUoms.length === 0) return null
  return {
    id: value.id,
    productId: value.productId,
    productName: value.productName,
    productCode: value.productCode,
    uomId: value.uomId,
    uomName: value.uomName,
    availableUoms,
    baseDefaultCostPrice: value.baseDefaultCostPrice,
    qtyRequested: value.qtyRequested,
    costPrice: value.costPrice,
  }
}

function parseDraft(raw: string | null): InternalOrderDraft | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    if (typeof parsed.destinationBranchId !== 'number') return null
    if (!Array.isArray(parsed.items)) return null
    const items = parsed.items
      .map(parseItem)
      .filter((i): i is ItemRow => i !== null)
    if (items.length === 0) return null
    return {
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      destinationBranchId: parsed.destinationBranchId,
      sourceBranchId: typeof parsed.sourceBranchId === 'number' ? parsed.sourceBranchId : null,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      items,
    }
  } catch {
    return null
  }
}

export function readInternalOrderDraft(branchId: number): InternalOrderDraft | null {
  if (typeof window === 'undefined') return null
  try {
    return parseDraft(window.localStorage.getItem(storageKey(branchId)))
  } catch {
    return null
  }
}

export function hasInternalOrderDraft(branchId: number): boolean {
  return readInternalOrderDraft(branchId) !== null
}

// Menyimpan hanya kalau ada isi yang berarti (minimal satu produk); kalau form
// dikosongkan lagi, draf ikut dibuang supaya banner "lanjutkan draf" tidak
// menyangkut untuk form kosong.
export function writeInternalOrderDraft(
  branchId: number,
  draft: Omit<InternalOrderDraft, 'savedAt'>,
) {
  if (typeof window === 'undefined') return
  if (draft.items.length === 0) {
    clearInternalOrderDraft(branchId)
    return
  }
  try {
    const payload: InternalOrderDraft = { ...draft, savedAt: new Date().toISOString() }
    window.localStorage.setItem(storageKey(branchId), JSON.stringify(payload))
  } catch {
    // storage penuh / ditolak (mode privat) — tidak fatal, abaikan
  }
}

export function clearInternalOrderDraft(branchId: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(branchId))
  } catch {
    // abaikan
  }
}
