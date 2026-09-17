import type { ItemRow } from './types'

// Draft pembuatan PO Internal disimpan di server (tabel `internal_order_drafts`), bukan
// localStorage lagi — supaya draft tetap ada walau kasir ganti device/browser (task kanban
// #38 Bagian A). Satu draft aktif per (cabang sesi POS, user yang login), lihat
// `app/api/pos/internal-order/draft/route.ts` untuk pembatasannya.

export interface InternalOrderDraft {
  savedAt: string
  destinationBranchId: number
  sourceBranchId: number | null
  notes: string
  items: ItemRow[]
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

function parseDraft(data: unknown): InternalOrderDraft | null {
  if (!isRecord(data)) return null
  if (typeof data.destinationBranchId !== 'number') return null
  if (!Array.isArray(data.items)) return null
  const items = data.items
    .map(parseItem)
    .filter((i): i is ItemRow => i !== null)
  if (items.length === 0) return null
  return {
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
    destinationBranchId: data.destinationBranchId,
    sourceBranchId: typeof data.sourceBranchId === 'number' ? data.sourceBranchId : null,
    notes: typeof data.notes === 'string' ? data.notes : '',
    items,
  }
}

export async function fetchInternalOrderDraft(): Promise<InternalOrderDraft | null> {
  try {
    const res = await fetch('/api/pos/internal-order/draft')
    if (!res.ok) return null
    return parseDraft(await res.json())
  } catch {
    return null
  }
}

// Menyimpan hanya kalau ada isi yang berarti (minimal satu produk); kalau form dikosongkan
// lagi, draf ikut dibuang di server supaya banner "lanjutkan draf" tidak menyangkut untuk
// form kosong.
export async function saveInternalOrderDraft(
  draft: Omit<InternalOrderDraft, 'savedAt'>,
): Promise<void> {
  if (draft.items.length === 0) {
    await clearInternalOrderDraft()
    return
  }
  try {
    await fetch('/api/pos/internal-order/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
  } catch {
    // gagal simpan draft tidak fatal — kasir tetap bisa lanjut mengetik, dicoba lagi
    // pada perubahan berikutnya
  }
}

export async function clearInternalOrderDraft(): Promise<void> {
  try {
    await fetch('/api/pos/internal-order/draft', { method: 'DELETE' })
  } catch {
    // abaikan
  }
}
