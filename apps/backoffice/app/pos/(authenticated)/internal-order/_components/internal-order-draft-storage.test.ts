import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearInternalOrderDraft,
  hasInternalOrderDraft,
  readInternalOrderDraft,
  writeInternalOrderDraft,
} from './internal-order-draft-storage'
import type { ItemRow } from './types'

function makeItem(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: 1,
    productId: 10,
    productName: 'Produk Uji',
    productCode: 'SKU-1',
    uomId: 1,
    uomName: 'Base',
    availableUoms: [{ id: 1, name: 'Base', ratio: 1 }],
    baseDefaultCostPrice: 5000,
    qtyRequested: 3,
    costPrice: 5000,
    ...overrides,
  }
}

function createFakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  }
}

let storage: ReturnType<typeof createFakeStorage>

beforeEach(() => {
  storage = createFakeStorage()
  vi.stubGlobal('window', { localStorage: storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('internal order draft storage', () => {
  it('menyimpan dan memulihkan draft untuk cabang yang sama', () => {
    writeInternalOrderDraft(7, {
      destinationBranchId: 7,
      sourceBranchId: 2,
      notes: 'stok menipis',
      items: [makeItem()],
    })

    const draft = readInternalOrderDraft(7)
    expect(draft).not.toBeNull()
    expect(draft!.destinationBranchId).toBe(7)
    expect(draft!.sourceBranchId).toBe(2)
    expect(draft!.notes).toBe('stok menipis')
    expect(draft!.items).toHaveLength(1)
    expect(draft!.items[0].productId).toBe(10)
    expect(typeof draft!.savedAt).toBe('string')
  })

  it('draf di-scope per cabang — cabang lain tidak melihatnya', () => {
    writeInternalOrderDraft(7, {
      destinationBranchId: 7,
      sourceBranchId: 2,
      notes: '',
      items: [makeItem()],
    })
    expect(hasInternalOrderDraft(7)).toBe(true)
    expect(hasInternalOrderDraft(9)).toBe(false)
  })

  it('menulis tanpa item akan menghapus draf, bukan menyimpan form kosong', () => {
    writeInternalOrderDraft(7, {
      destinationBranchId: 7,
      sourceBranchId: 2,
      notes: '',
      items: [makeItem()],
    })
    writeInternalOrderDraft(7, {
      destinationBranchId: 7,
      sourceBranchId: 2,
      notes: 'catatan tanpa produk',
      items: [],
    })
    expect(readInternalOrderDraft(7)).toBeNull()
  })

  it('clearInternalOrderDraft menghapus draf', () => {
    writeInternalOrderDraft(7, {
      destinationBranchId: 7,
      sourceBranchId: null,
      notes: '',
      items: [makeItem()],
    })
    clearInternalOrderDraft(7)
    expect(readInternalOrderDraft(7)).toBeNull()
  })

  it('menolak JSON rusak / bentuk yang tidak sesuai', () => {
    storage.setItem('internal_order_draft_v1_7', '{bukan json')
    expect(readInternalOrderDraft(7)).toBeNull()

    storage.setItem(
      'internal_order_draft_v1_7',
      JSON.stringify({ destinationBranchId: 7, items: [{ id: 1 }] }),
    )
    expect(readInternalOrderDraft(7)).toBeNull()

    storage.setItem(
      'internal_order_draft_v1_7',
      JSON.stringify({ destinationBranchId: 7, items: [] }),
    )
    expect(readInternalOrderDraft(7)).toBeNull()
  })

  it('membuang item yang availableUoms-nya rusak', () => {
    storage.setItem(
      'internal_order_draft_v1_7',
      JSON.stringify({
        savedAt: new Date().toISOString(),
        destinationBranchId: 7,
        sourceBranchId: 2,
        notes: '',
        items: [makeItem(), { ...makeItem({ id: 2 }), availableUoms: [] }],
      }),
    )
    const draft = readInternalOrderDraft(7)
    expect(draft).not.toBeNull()
    expect(draft!.items).toHaveLength(1)
    expect(draft!.items[0].id).toBe(1)
  })
})
