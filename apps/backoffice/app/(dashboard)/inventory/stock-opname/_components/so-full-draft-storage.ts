// Draft input SO Besar (backoffice) disimpan di browser, bukan di server —
// supaya reload halaman sebelum sempat "Simpan Koreksi" tidak menghapus qty
// fisik yang sudah diketik. Ikut hilang kalau data situs dibersihkan, sama
// seperti draft bulk sale (lihat transactions/bulk-sale/_components/bulk-sale-drafts.ts).

export interface SOFullDraftItem {
  physicalQty: string
  varianceReason: string
}

export type SOFullDraftItems = Record<string, SOFullDraftItem>

interface SOFullDraft {
  savedAt: string
  items: SOFullDraftItems
}

function storageKey(soId: number) {
  return `so_full_draft_v1_${soId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseDraftItem(value: unknown): SOFullDraftItem | null {
  if (!isRecord(value)) return null
  if (typeof value.physicalQty !== 'string' || typeof value.varianceReason !== 'string') return null
  return { physicalQty: value.physicalQty, varianceReason: value.varianceReason }
}

function parseDraft(raw: string | null): SOFullDraftItems {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !isRecord(parsed.items)) return {}
    const items: SOFullDraftItems = {}
    for (const [key, value] of Object.entries(parsed.items)) {
      const item = parseDraftItem(value)
      if (item) items[key] = item
    }
    return items
  } catch {
    return {}
  }
}

export function readSOFullDraft(soId: number): SOFullDraftItems {
  if (typeof window === 'undefined') return {}
  try {
    return parseDraft(window.localStorage.getItem(storageKey(soId)))
  } catch {
    return {}
  }
}

// Cuma menyimpan baris yang benar-benar dirty (dipanggil pemanggil dengan subset
// yang sudah difilter) — bukan seluruh kandidat, supaya localStorage tidak membengkak.
export function writeSOFullDraft(soId: number, items: SOFullDraftItems) {
  if (typeof window === 'undefined') return
  if (Object.keys(items).length === 0) {
    clearSOFullDraft(soId)
    return
  }
  const draft: SOFullDraft = { savedAt: new Date().toISOString(), items }
  window.localStorage.setItem(storageKey(soId), JSON.stringify(draft))
}

export function clearSOFullDraft(soId: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(soId))
  } catch {
    // storage tidak tersedia (mode privat dsb) — tidak fatal, abaikan
  }
}
