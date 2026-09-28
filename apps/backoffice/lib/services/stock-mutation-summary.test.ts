import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {}, sql: () => ({}) }))

const { summarizeStockMutations, resolveTimelineLink } = await import('./stock-mutation-summary')

const names = new Map([
  [1, 'Toko Pusat'],
  [2, 'Gudang'],
])

describe('summarizeStockMutations', () => {
  it('menghitung stok akhir mundur dari stok kini dikurangi mutasi sesudah periode', () => {
    const { branches } = summarizeStockMutations(
      [
        { branchId: 1, movementType: 'PO_IN', inPeriod: 50, afterPeriod: 0 },
        { branchId: 1, movementType: 'SALE_OUT', inPeriod: -30, afterPeriod: -5 },
      ],
      [{ branchId: 1, qty: 40 }],
      names,
    )

    expect(branches).toEqual([
      {
        branchId: 1,
        branchName: 'Toko Pusat',
        // akhir = 40 − (−5) = 45; awal = 45 − (50 − 30) = 25
        openingQty: 25,
        closingQty: 45,
        currentQty: 40,
        movements: { PO_IN: 50, SALE_OUT: -30 },
      },
    ])
  })

  it('tidak memasukkan mutasi sesudah periode ke kolom mutasi', () => {
    const { branches } = summarizeStockMutations(
      [{ branchId: 1, movementType: 'TRANSFER_IN', inPeriod: 0, afterPeriod: 10 }],
      [{ branchId: 1, qty: 10 }],
      names,
    )
    expect(branches[0].movements).toEqual({})
    expect(branches[0].openingQty).toBe(0)
    expect(branches[0].closingQty).toBe(0)
  })

  it('tetap menampilkan cabang yang punya mutasi tapi tanpa baris stok', () => {
    const { branches } = summarizeStockMutations(
      [{ branchId: 2, movementType: 'TRANSFER_OUT', inPeriod: -8, afterPeriod: 0 }],
      [],
      names,
    )
    expect(branches[0]).toMatchObject({ branchName: 'Gudang', openingQty: 8, closingQty: 0 })
  })

  it('membuang cabang yang semuanya nol', () => {
    const { branches } = summarizeStockMutations([], [{ branchId: 1, qty: 0 }], names)
    expect(branches).toEqual([])
  })

  it('menjumlahkan total lintas cabang per jenis mutasi', () => {
    const { total } = summarizeStockMutations(
      [
        { branchId: 1, movementType: 'TRANSFER_IN', inPeriod: 12, afterPeriod: 0 },
        { branchId: 2, movementType: 'TRANSFER_OUT', inPeriod: -12, afterPeriod: 0 },
        { branchId: 1, movementType: 'SALE_OUT', inPeriod: -4, afterPeriod: 0 },
      ],
      [
        { branchId: 1, qty: 20 },
        { branchId: 2, qty: 100 },
      ],
      names,
    )
    expect(total).toEqual({
      openingQty: 124,
      closingQty: 120,
      currentQty: 120,
      movements: { TRANSFER_IN: 12, TRANSFER_OUT: -12, SALE_OUT: -4 },
    })
  })
})

describe('resolveTimelineLink', () => {
  it('menautkan penjualan, void, dan koreksi ke transaksinya', () => {
    for (const id of ['SALE_10', 'SALEVOID_10', 'TRXEDIT_10']) {
      expect(resolveTimelineLink(id, '77', 'TRX-1')).toEqual({ kind: 'TRANSACTION', id: '77', number: 'TRX-1' })
    }
  })

  it('Bulk Sale PO Internal tetap ke transaksi walau movement-nya TRANSFER_OUT', () => {
    // Pemetaan dari prefiks id, bukan dari movement_type.
    expect(resolveTimelineLink('SALE_5', '12', 'TRX-9')?.kind).toBe('TRANSACTION')
    expect(resolveTimelineLink('IBTOUT_5', '12', 'IBT-9')?.kind).toBe('INTERNAL_TRANSFER')
  })

  it('menautkan PO, IBT masuk, dan stock opname', () => {
    expect(resolveTimelineLink('PO_3', '4', 'PO-1')?.kind).toBe('PURCHASE_ORDER')
    expect(resolveTimelineLink('IBTIN_3', '4', 'IBT-1')?.kind).toBe('INTERNAL_TRANSFER')
    expect(resolveTimelineLink('SO_3', '4', 'SO-1')?.kind).toBe('STOCK_OPNAME')
  })

  it('tanpa tautan untuk jenis yang belum punya halaman detail', () => {
    for (const id of ['ADJ_1', 'DMG_1', 'RET_1', 'BRKIN_1', 'BRKOUT_1']) {
      expect(resolveTimelineLink(id, '1', 'X')).toBeNull()
    }
    expect(resolveTimelineLink('SALE_1', null, 'TRX-1')).toBeNull()
  })
})
