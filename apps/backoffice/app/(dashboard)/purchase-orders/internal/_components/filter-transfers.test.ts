import { describe, expect, it } from 'vitest'

import { EMPTY_TRANSFER_FILTERS, filterTransfers, hasActiveTransferFilters, toWibDateKey } from './filter-transfers'
import type { InternalTransfer } from './types'

function transfer(overrides: Partial<InternalTransfer>): InternalTransfer {
  return {
    id: 1,
    ibtNumber: 'IBT-20260920-0001',
    sourceBranchId: 1,
    destinationBranchId: 2,
    requestedById: 10,
    approvedById: null,
    status: 'PENDING_APPROVAL',
    totalTransferValue: 100000,
    shippedValue: 0,
    receivedValue: 0,
    notes: null,
    createdAt: '2026-09-20T03:00:00.000Z',
    updatedAt: '2026-09-20T03:00:00.000Z',
    sourceBranchName: 'Gudang',
    destinationBranchName: 'Toko Pusat',
    requestedByName: 'Andi',
    productNames: 'WHISKAS TUNA 1KG | ROYAL CANIN KITTEN',
    ...overrides,
  }
}

describe('filterTransfers', () => {
  const rows = [
    transfer({ id: 1 }),
    transfer({
      id: 2,
      ibtNumber: 'IBT-20260925-0003',
      sourceBranchId: 1,
      destinationBranchId: 3,
      destinationBranchName: 'Toko Depan',
      requestedById: 11,
      requestedByName: 'Budi',
      notes: 'Stok untuk promo',
      productNames: 'PW CRYSTAL 10L',
      createdAt: '2026-09-25T02:00:00.000Z',
    }),
  ]

  it('tanpa filter mengembalikan semua baris', () => {
    expect(filterTransfers(rows, EMPTY_TRANSFER_FILTERS)).toHaveLength(2)
  })

  it('mencari di nomor, cabang, pemohon, catatan, dan produk (semua kata wajib cocok)', () => {
    const search = (q: string) => filterTransfers(rows, { ...EMPTY_TRANSFER_FILTERS, search: q }).map((r) => r.id)
    expect(search('0003')).toEqual([2])
    expect(search('toko depan')).toEqual([2])
    expect(search('andi')).toEqual([1])
    expect(search('PROMO')).toEqual([2])
    expect(search('whiskas')).toEqual([1])
    expect(search('whiskas budi')).toEqual([])
  })

  it('filter cabang tujuan dan pemohon', () => {
    expect(filterTransfers(rows, { ...EMPTY_TRANSFER_FILTERS, destinationBranchId: '3' }).map((r) => r.id)).toEqual([2])
    expect(filterTransfers(rows, { ...EMPTY_TRANSFER_FILTERS, requestedById: '10' }).map((r) => r.id)).toEqual([1])
  })

  it('filter tanggal memakai tanggal WIB, inklusif di kedua ujung', () => {
    const late = transfer({ id: 3, createdAt: '2026-09-21T18:30:00.000Z' })
    expect(toWibDateKey(late.createdAt)).toBe('2026-09-22')
    const byRange = (startDate: string, endDate: string) =>
      filterTransfers([...rows, late], { ...EMPTY_TRANSFER_FILTERS, startDate, endDate }).map((r) => r.id)
    expect(byRange('2026-09-22', '2026-09-22')).toEqual([3])
    expect(byRange('2026-09-20', '')).toEqual([1, 2, 3])
    expect(byRange('', '2026-09-20')).toEqual([1])
  })

  it('hasActiveTransferFilters mengabaikan spasi kosong', () => {
    expect(hasActiveTransferFilters({ ...EMPTY_TRANSFER_FILTERS, search: '  ' })).toBe(false)
    expect(hasActiveTransferFilters({ ...EMPTY_TRANSFER_FILTERS, startDate: '2026-09-01' })).toBe(true)
  })
})
