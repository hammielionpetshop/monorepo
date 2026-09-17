import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearInternalOrderDraft,
  fetchInternalOrderDraft,
  saveInternalOrderDraft,
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

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

describe('fetchInternalOrderDraft', () => {
  it('mengambil draft dari server dan mem-parsingnya', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        savedAt: '2026-09-17T00:00:00.000Z',
        destinationBranchId: 7,
        sourceBranchId: 2,
        notes: 'stok menipis',
        items: [makeItem()],
      }),
    )

    const draft = await fetchInternalOrderDraft()

    expect(fetchMock).toHaveBeenCalledWith('/api/pos/internal-order/draft')
    expect(draft).not.toBeNull()
    expect(draft!.destinationBranchId).toBe(7)
    expect(draft!.sourceBranchId).toBe(2)
    expect(draft!.notes).toBe('stok menipis')
    expect(draft!.items).toHaveLength(1)
    expect(draft!.items[0].productId).toBe(10)
  })

  it('mengembalikan null saat server tidak punya draft (body null)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null))
    expect(await fetchInternalOrderDraft()).toBeNull()
  })

  it('mengembalikan null saat response tidak ok', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ destinationBranchId: 7, items: [makeItem()] }, false))
    expect(await fetchInternalOrderDraft()).toBeNull()
  })

  it('mengembalikan null saat fetch gagal (network error)', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    expect(await fetchInternalOrderDraft()).toBeNull()
  })

  it('menolak bentuk yang tidak sesuai (items kosong / bukan array)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ destinationBranchId: 7, items: [{ id: 1 }] }))
    expect(await fetchInternalOrderDraft()).toBeNull()

    fetchMock.mockResolvedValue(jsonResponse({ destinationBranchId: 7, items: [] }))
    expect(await fetchInternalOrderDraft()).toBeNull()
  })

  it('membuang item yang availableUoms-nya rusak', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        savedAt: new Date().toISOString(),
        destinationBranchId: 7,
        sourceBranchId: 2,
        notes: '',
        items: [makeItem(), { ...makeItem({ id: 2 }), availableUoms: [] }],
      }),
    )
    const draft = await fetchInternalOrderDraft()
    expect(draft).not.toBeNull()
    expect(draft!.items).toHaveLength(1)
    expect(draft!.items[0].id).toBe(1)
  })
})

describe('saveInternalOrderDraft', () => {
  it('mengirim PUT dengan isi draft saat ada item', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ savedAt: '2026-09-17T00:00:00.000Z' }))

    await saveInternalOrderDraft({
      destinationBranchId: 7,
      sourceBranchId: 2,
      notes: 'catatan',
      items: [makeItem()],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pos/internal-order/draft',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('memanggil DELETE (bukan PUT) saat item kosong — tidak menyimpan form kosong', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ deleted: true }))

    await saveInternalOrderDraft({
      destinationBranchId: 7,
      sourceBranchId: 2,
      notes: 'catatan tanpa produk',
      items: [],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pos/internal-order/draft',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/pos/internal-order/draft',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('tidak melempar error saat request gagal', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    await expect(
      saveInternalOrderDraft({ destinationBranchId: 7, sourceBranchId: 2, notes: '', items: [makeItem()] }),
    ).resolves.toBeUndefined()
  })
})

describe('clearInternalOrderDraft', () => {
  it('mengirim DELETE', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ deleted: true }))
    await clearInternalOrderDraft()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pos/internal-order/draft',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('tidak melempar error saat request gagal', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    await expect(clearInternalOrderDraft()).resolves.toBeUndefined()
  })
})
