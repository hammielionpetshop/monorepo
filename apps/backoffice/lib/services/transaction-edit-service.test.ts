import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tables, db, deductStock, addStock } = vi.hoisted(() => ({
  tables: {
    transactions: {},
    transactionItems: {},
    transactionPayments: {},
    transactionEdits: {},
    paymentMethods: {},
    customerDebts: {},
    products: {},
    productStocks: {},
    shifts: {},
    returns: {},
    auditLogs: {},
  },
  db: { transaction: vi.fn() },
  deductStock: vi.fn(),
  addStock: vi.fn(),
}))

vi.mock('../db', () => ({
  db,
  ...tables,
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
  inArray: vi.fn((left, values) => ({ op: 'inArray', left, values })),
  isNull: vi.fn((left) => ({ op: 'isNull', left })),
}))

vi.mock('./stock-service', () => ({
  StockService: { deductStock, addStock },
}))

import { TransactionEditService, TransactionEditError } from './transaction-edit-service'

interface Scenario {
  trx?: Record<string, unknown>
  shift?: Record<string, unknown>
  returns?: unknown[]
  debts?: unknown[]
  items?: Record<string, unknown>[]
  products?: Record<string, unknown>[]
  paymentMethods?: Record<string, unknown>[]
}

type UpdateCall = { table: unknown; payload: Record<string, unknown> }
type InsertCall = { table: unknown; values: unknown }

function buildTx(scenario: Scenario, recorded: { updates: UpdateCall[]; inserts: InsertCall[] }) {
  const defaults = {
    trx: {
      id: 1,
      trxNumber: 'TRX-20260806-0001',
      branchId: 5,
      shiftId: 7,
      cashierId: 3,
      customerId: null,
      status: 'COMPLETED',
      revision: 1,
      totalAmount: 50_000,
      discountAmount: 0,
      payableAmount: 50_000,
      paidAmount: 50_000,
      changeAmount: 0,
      sourceIbtId: null,
      sourceOrderId: null,
    },
    shift: { status: 'OPEN' },
    returns: [] as unknown[],
    debts: [] as unknown[],
    items: [
      {
        id: 11,
        productId: 100,
        productName: 'Produk A',
        productSku: 'SKU-A',
        uomId: 1,
        qty: 5,
        unitPrice: 10_000,
        totalPrice: 50_000,
        discountAmount: 0,
        priceTier: 'RETAIL',
        cogs: 30_000,
        originalQty: null,
        originalCogs: null,
        isRemoved: false,
      },
    ],
    products: [{ id: 200, name: 'Produk B', sku: 'SKU-B' }],
    paymentMethods: [{ id: 1, type: 'CASH' }],
  }

  const data = { ...defaults, ...scenario }
  // Item transaksi dibaca dua kali: sebelum diubah (snapshot) dan sesudah (untuk afterData)
  let itemReads = 0

  function resultFor(table: unknown): unknown[] {
    if (table === tables.transactions) return [data.trx]
    if (table === tables.shifts) return [data.shift]
    if (table === tables.returns) return data.returns
    if (table === tables.customerDebts) return data.debts
    if (table === tables.transactionItems) {
      itemReads += 1
      return itemReads === 1 ? data.items : []
    }
    if (table === tables.products) return data.products
    if (table === tables.paymentMethods) return data.paymentMethods
    if (table === tables.productStocks) return []
    return []
  }

  function thenable(result: unknown[]): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      for: () => chain,
      then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    }
    return chain
  }

  return {
    select: () => ({ from: (table: unknown) => thenable(resultFor(table)) }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        recorded.inserts.push({ table, values })
        return Promise.resolve([{ id: 1 }])
      },
    }),
    update: (table: unknown) => ({
      set: (payload: Record<string, unknown>) => {
        recorded.updates.push({ table, payload })
        return { where: () => Promise.resolve([]) }
      },
    }),
    delete: () => ({ where: () => Promise.resolve([]) }),
  }
}

function runEdit(scenario: Scenario, params: Partial<Parameters<typeof TransactionEditService.editTransaction>[0]> = {}) {
  const recorded = { updates: [] as UpdateCall[], inserts: [] as InsertCall[] }
  db.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb(buildTx(scenario, recorded)),
  )

  const promise = TransactionEditService.editTransaction({
    txId: 1,
    branchId: 5,
    actorUserId: 3,
    approvedById: 9,
    reason: 'salah input qty',
    items: [
      {
        transactionItemId: 11,
        productId: 100,
        uomId: 1,
        qty: 2,
        unitPrice: 10_000,
        discountAmount: 0,
        priceTier: 'RETAIL',
      },
    ],
    payments: [{ paymentMethodId: 1, amount: 50_000 }],
    ...params,
  })

  return { promise, recorded }
}

function itemUpdates(recorded: { updates: UpdateCall[] }) {
  return recorded.updates.filter((u) => u.table === tables.transactionItems)
}

beforeEach(() => {
  vi.clearAllMocks()
  deductStock.mockResolvedValue({ totalCogs: 12_000 })
  addStock.mockResolvedValue(undefined)
})

describe('koreksi transaksi — penyesuaian stok', () => {
  it('mengembalikan stok sebesar selisih saat qty diturunkan', async () => {
    const { promise } = runEdit({})
    await promise

    expect(addStock).toHaveBeenCalledTimes(1)
    const [, branchId, productId, uomId, qty] = addStock.mock.calls[0]
    expect(branchId).toBe(5)
    expect(productId).toBe(100)
    expect(uomId).toBe(1)
    expect(qty).toBe('3') // 5 → 2
    expect(deductStock).not.toHaveBeenCalled()
  })

  it('mengembalikan stok dengan harga modal saat dipotong, bukan modal terkini', async () => {
    const { promise } = runEdit({})
    await promise

    // cogs 30.000 untuk 5 unit → 6.000/unit
    const costPerUom = addStock.mock.calls[0][5]
    expect(Number(costPerUom)).toBeCloseTo(6_000, 6)
  })

  it('memotong stok tambahan saat qty dinaikkan', async () => {
    const { promise } = runEdit(
      {},
      {
        items: [
          {
            transactionItemId: 11,
            productId: 100,
            uomId: 1,
            qty: 8,
            unitPrice: 10_000,
            discountAmount: 0,
            priceTier: 'RETAIL',
          },
        ],
        payments: [{ paymentMethodId: 1, amount: 80_000 }],
      },
    )
    await promise

    expect(deductStock).toHaveBeenCalledTimes(1)
    expect(deductStock.mock.calls[0][4]).toBe(3) // selisih 8 - 5
    expect(addStock).not.toHaveBeenCalled()
  })

  it('menyimpan qty & HPP asli sekali saja agar mutasi jam jual tidak berubah surut', async () => {
    const { promise, recorded } = runEdit({})
    await promise

    const update = itemUpdates(recorded)[0]
    expect(update.payload.originalQty).toBe(5)
    expect(update.payload.originalCogs).toBe(30_000)
    expect(update.payload.qty).toBe(2)
    // proporsional: 30.000 × 2/5
    expect(update.payload.cogs).toBe(12_000)
  })

  it('mempertahankan qty asli dari koreksi sebelumnya, bukan menimpanya', async () => {
    const { promise, recorded } = runEdit({
      items: [
        {
          id: 11,
          productId: 100,
          productName: 'Produk A',
          productSku: 'SKU-A',
          uomId: 1,
          qty: 4,
          unitPrice: 10_000,
          totalPrice: 40_000,
          discountAmount: 0,
          priceTier: 'RETAIL',
          cogs: 24_000,
          originalQty: 5,
          originalCogs: 30_000,
          isRemoved: false,
        },
      ],
    })
    await promise

    const update = itemUpdates(recorded)[0]
    expect(update.payload.originalQty).toBe(5)
    expect(update.payload.originalCogs).toBe(30_000)
  })

  it('menandai item yang dihapus tanpa menghapus barisnya', async () => {
    const { promise, recorded } = runEdit(
      {},
      {
        items: [
          {
            transactionItemId: null,
            productId: 200,
            uomId: 1,
            qty: 1,
            unitPrice: 20_000,
            discountAmount: 0,
            priceTier: 'RETAIL',
          },
        ],
        payments: [{ paymentMethodId: 1, amount: 20_000 }],
      },
    )
    await promise

    const removal = itemUpdates(recorded)[0]
    expect(removal.payload.isRemoved).toBe(true)
    expect(removal.payload.qty).toBe(0)
    expect(removal.payload.originalQty).toBe(5) // baris tetap menahan SALE_OUT aslinya
    expect(removal.payload.cogs).toBe(0)
  })

  it('menandai item baru dengan qty asli 0 agar tak muncul di mutasi jam jual', async () => {
    const { promise, recorded } = runEdit(
      {},
      {
        items: [
          {
            transactionItemId: 11,
            productId: 100,
            uomId: 1,
            qty: 5,
            unitPrice: 10_000,
            discountAmount: 0,
            priceTier: 'RETAIL',
          },
          {
            transactionItemId: null,
            productId: 200,
            uomId: 1,
            qty: 2,
            unitPrice: 15_000,
            discountAmount: 0,
            priceTier: 'RETAIL',
          },
        ],
        payments: [{ paymentMethodId: 1, amount: 80_000 }],
      },
    )
    await promise

    const inserted = recorded.inserts.find((i) => i.table === tables.transactionItems)
      ?.values as Record<string, unknown>
    expect(inserted.originalQty).toBe(0)
    expect(inserted.originalCogs).toBe(0)
    expect(inserted.productId).toBe(200)
  })

  it('memperlakukan ganti produk sebagai hapus baris lama + tambah baris baru', async () => {
    // Menimpa product_id di tempat akan memindahkan penjualan asli ke produk
    // yang salah, karena original_qty pada baris itu milik produk lama.
    const { promise, recorded } = runEdit(
      {},
      {
        items: [
          {
            transactionItemId: 11,
            productId: 200,
            uomId: 1,
            qty: 5,
            unitPrice: 10_000,
            discountAmount: 0,
            priceTier: 'RETAIL',
          },
        ],
        payments: [{ paymentMethodId: 1, amount: 50_000 }],
      },
    )
    await promise

    const removal = itemUpdates(recorded)[0]
    expect(removal.payload.isRemoved).toBe(true)
    expect(addStock).toHaveBeenCalledTimes(1) // stok produk lama kembali penuh
    expect(addStock.mock.calls[0][2]).toBe(100)

    const inserted = recorded.inserts.find((i) => i.table === tables.transactionItems)
      ?.values as Record<string, unknown>
    expect(inserted.productId).toBe(200)
    expect(inserted.originalQty).toBe(0)
  })
})

describe('koreksi transaksi — uang & riwayat', () => {
  it('menghitung ulang total, uang diterima, dan kembalian', async () => {
    const { promise, recorded } = runEdit({})
    await promise

    const header = recorded.updates.find((u) => u.table === tables.transactions)!
    expect(header.payload.totalAmount).toBe(20_000)
    expect(header.payload.payableAmount).toBe(20_000)
    expect(header.payload.paidAmount).toBe(50_000)
    expect(header.payload.changeAmount).toBe(30_000)
    expect(header.payload.revision).toBe(2)
  })

  it('mempertahankan diskon tingkat nota yang bukan berasal dari item', async () => {
    const { promise, recorded } = runEdit({
      trx: {
        id: 1,
        trxNumber: 'TRX-20260806-0001',
        branchId: 5,
        shiftId: 7,
        cashierId: 3,
        customerId: null,
        status: 'COMPLETED',
        revision: 1,
        totalAmount: 50_000,
        discountAmount: 5_000, // diskon nota, tidak ada di item mana pun
        payableAmount: 45_000,
        paidAmount: 45_000,
        changeAmount: 0,
        sourceIbtId: null,
        sourceOrderId: null,
      },
    })
    await promise

    const header = recorded.updates.find((u) => u.table === tables.transactions)!
    expect(header.payload.discountAmount).toBe(5_000)
    expect(header.payload.payableAmount).toBe(15_000) // 20.000 - 5.000
  })

  it('menolak koreksi bila uang yang tercatat kurang dari tagihan baru', async () => {
    const { promise } = runEdit(
      {},
      {
        items: [
          {
            transactionItemId: 11,
            productId: 100,
            uomId: 1,
            qty: 9,
            unitPrice: 10_000,
            discountAmount: 0,
            priceTier: 'RETAIL',
          },
        ],
        payments: [{ paymentMethodId: 1, amount: 50_000 }],
      },
    )

    await expect(promise).rejects.toThrow(TransactionEditError)
    await expect(promise).rejects.toMatchObject({ code: 'PAYMENT_INSUFFICIENT' })
  })

  it('mencatat riwayat revisi berikut alasan & penyetujunya', async () => {
    const { promise, recorded } = runEdit({})
    await promise

    const edit = recorded.inserts.find((i) => i.table === tables.transactionEdits)
      ?.values as Record<string, unknown>
    expect(edit.revision).toBe(2)
    expect(edit.reason).toBe('salah input qty')
    expect(edit.editedById).toBe(3)
    expect(edit.approvedById).toBe(9)
    expect(edit.beforeData).toMatchObject({ payableAmount: 50_000 })
    expect(edit.afterData).toMatchObject({ payableAmount: 20_000 })
  })

  it('mencatat audit log koreksi', async () => {
    const { promise, recorded } = runEdit({})
    await promise

    const audit = recorded.inserts.find((i) => i.table === tables.auditLogs)?.values as Record<
      string,
      unknown
    >
    expect(audit.action).toBe('EDIT_TRANSACTION')
    expect(audit.recordId).toBe('1')
  })
})

describe('koreksi transaksi — pagar pengaman', () => {
  it('menolak transaksi yang bukan COMPLETED', async () => {
    const { promise } = runEdit({ trx: { id: 1, status: 'VOIDED', revision: 1, branchId: 5 } })
    await expect(promise).rejects.toMatchObject({ code: 'TRX_NOT_COMPLETED' })
  })

  it('menolak koreksi setelah shift ditutup', async () => {
    // Uang shift sudah direkap & disetor — mengubah nominalnya bikin kas tak cocok.
    const { promise } = runEdit({ shift: { status: 'CLOSED' } })
    await expect(promise).rejects.toMatchObject({ code: 'SHIFT_CLOSED' })
  })

  it('menolak koreksi bila transaksi sudah punya retur aktif', async () => {
    const { promise } = runEdit({ returns: [{ id: 'ret-1' }] })
    await expect(promise).rejects.toMatchObject({ code: 'HAS_RETURN' })
  })

  it('menolak koreksi bila hutang pelanggannya sudah menerima pembayaran', async () => {
    const { promise } = runEdit({ debts: [{ id: 4, paidAmount: 25_000, status: 'PARTIAL' }] })
    await expect(promise).rejects.toMatchObject({ code: 'DEBT_HAS_PAYMENT' })
  })

  it('menolak koreksi bulk sale hasil konversi Internal PO', async () => {
    const { promise } = runEdit({
      trx: {
        id: 1,
        trxNumber: 'TRX-1',
        branchId: 5,
        shiftId: 7,
        status: 'COMPLETED',
        revision: 1,
        sourceIbtId: 42,
        sourceOrderId: null,
      },
    })
    await expect(promise).rejects.toMatchObject({ code: 'LINKED_SOURCE' })
  })

  it('menolak transaksi tanpa item tersisa', async () => {
    const { promise } = runEdit({}, { items: [] })
    await expect(promise).rejects.toMatchObject({ code: 'NO_ITEMS' })
  })

  it('menolak item yang bukan milik transaksi ini', async () => {
    const { promise } = runEdit(
      {},
      {
        items: [
          {
            transactionItemId: 999,
            productId: 100,
            uomId: 1,
            qty: 1,
            unitPrice: 10_000,
            discountAmount: 0,
            priceTier: 'RETAIL',
          },
        ],
      },
    )
    await expect(promise).rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' })
  })
})
