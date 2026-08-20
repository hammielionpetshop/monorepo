import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tables, addStock } = vi.hoisted(() => ({
  tables: {
    transactions: {},
    transactionItems: {},
    productStocks: {},
    products: {},
    productUomConversions: {},
    customerDebts: {},
    auditLogs: {},
    shifts: {},
    interBranchTransfers: {},
  },
  addStock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { transaction: vi.fn() },
  ...tables,
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
  inArray: vi.fn((left, values) => ({ op: 'inArray', left, values })),
}))

vi.mock('./stock-service', () => ({
  StockService: { addStock },
}))

const { performVoidWithinTx, VoidError } = await import('./void-service')

type UpdateCall = { table: unknown; payload: Record<string, unknown> }
type InsertCall = { table: unknown; payload: Record<string, unknown> }

function chain(result: unknown[]) {
  const obj: Record<string, unknown> = {
    where: () => obj,
    limit: () => Promise.resolve(result),
    for: () => Promise.resolve(result),
    then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return obj
}

function makeTx(opts: {
  currentStatus?: string
  linkedIbtRows?: unknown[]
  debtRows?: unknown[]
  items?: unknown[]
  productRows?: unknown[]
  conversionRows?: unknown[]
}) {
  const updates: UpdateCall[] = []
  const inserts: InsertCall[] = []

  const resultFor = (table: unknown): unknown[] => {
    if (table === tables.transactions) return [{ status: opts.currentStatus ?? 'COMPLETED' }]
    if (table === tables.interBranchTransfers) return opts.linkedIbtRows ?? []
    if (table === tables.customerDebts) return opts.debtRows ?? []
    if (table === tables.transactionItems)
      return opts.items ?? [{ productId: 1, uomId: 1, qty: 2, cogs: 1000 }]
    if (table === tables.products) return opts.productRows ?? [{ id: 1, baseUomId: 1 }]
    if (table === tables.productUomConversions) return opts.conversionRows ?? []
    return []
  }

  const tx = {
    select: () => ({ from: (table: unknown) => chain(resultFor(table)) }),
    update: (table: unknown) => ({
      set: (payload: Record<string, unknown>) => ({
        where: () => {
          updates.push({ table, payload })
          return Promise.resolve([])
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (payload: Record<string, unknown>) => {
        inserts.push({ table, payload })
        return Promise.resolve([])
      },
    }),
  }

  return { tx, updates, inserts }
}

const baseParams = {
  txId: 100,
  branchId: 2,
  trxNumber: 'TRX-TEST-1',
  actorUserId: 7,
}

beforeEach(() => {
  vi.clearAllMocks()
  addStock.mockResolvedValue(undefined)
})

describe('performVoidWithinTx — reset IBT tertaut (item 1a)', () => {
  it('transaksi biasa (tidak tertaut IBT manapun): tidak menyentuh interBranchTransfers sama sekali', async () => {
    const { tx, updates, inserts } = makeTx({ linkedIbtRows: [] })

    await performVoidWithinTx(tx as never, baseParams)

    expect(updates.some((u) => u.table === tables.interBranchTransfers)).toBe(false)

    const trxUpdate = updates.find((u) => u.table === tables.transactions)
    expect(trxUpdate?.payload).toMatchObject({ status: 'VOIDED' })

    const auditInsert = inserts.find((i) => i.table === tables.auditLogs)
    const newData = JSON.parse(auditInsert!.payload.newData as string)
    expect(newData.ibtReset).toBeUndefined()
  })

  it('nota bulk sale hasil pemenuhan IBT berstatus APPROVED: reset ke PENDING_APPROVAL', async () => {
    const { tx, updates, inserts } = makeTx({
      linkedIbtRows: [{ id: 55, ibtNumber: 'IBT-0001', status: 'APPROVED' }],
    })

    await performVoidWithinTx(tx as never, baseParams)

    const ibtUpdate = updates.find((u) => u.table === tables.interBranchTransfers)
    expect(ibtUpdate?.payload).toMatchObject({
      convertedTransactionId: null,
      status: 'PENDING_APPROVAL',
      approvedById: null,
    })

    const trxUpdate = updates.find((u) => u.table === tables.transactions)
    expect(trxUpdate?.payload).toMatchObject({ status: 'VOIDED' })

    const auditInsert = inserts.find((i) => i.table === tables.auditLogs)
    const newData = JSON.parse(auditInsert!.payload.newData as string)
    expect(newData.ibtReset).toEqual({ id: 55, ibtNumber: 'IBT-0001' })
  })

  it('IBT tertaut sudah lanjut diproses (mis. IN_TRANSIT): void diblokir, tidak ada mutasi apa pun', async () => {
    const { tx, updates, inserts } = makeTx({
      linkedIbtRows: [{ id: 55, ibtNumber: 'IBT-0002', status: 'IN_TRANSIT' }],
    })

    await expect(performVoidWithinTx(tx as never, baseParams)).rejects.toMatchObject({
      code: 'IBT_ALREADY_PROGRESSED',
    })
    await expect(performVoidWithinTx(tx as never, baseParams)).rejects.toBeInstanceOf(VoidError)

    expect(updates).toHaveLength(0)
    expect(inserts).toHaveLength(0)
    expect(addStock).not.toHaveBeenCalled()
  })

  it.each(['PREPARING', 'FULLY_RECEIVED', 'PARTIALLY_RECEIVED'])(
    'IBT tertaut berstatus %s: juga diblokir (bukan cuma IN_TRANSIT)',
    async (status) => {
      const { tx } = makeTx({ linkedIbtRows: [{ id: 55, ibtNumber: 'IBT-0003', status }] })

      await expect(performVoidWithinTx(tx as never, baseParams)).rejects.toMatchObject({
        code: 'IBT_ALREADY_PROGRESSED',
      })
    },
  )
})
