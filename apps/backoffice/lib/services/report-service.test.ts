import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlExpressions, queryResults } = vi.hoisted(() => ({
  sqlExpressions: [] as string[],
  queryResults: [] as unknown[][],
}))

vi.mock('@/lib/db', () => {
  function makeSelectChain() {
    const chain = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      groupBy: vi.fn(() => Promise.resolve(queryResults.shift() ?? [])),
      orderBy: vi.fn(() => Promise.resolve(queryResults.shift() ?? [])),
    }

    return chain
  }

  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const expression = strings.reduce((acc, part, index) => {
      const value = index < values.length ? String(values[index]) : ''
      return `${acc}${part}${value}`
    }, '')
    sqlExpressions.push(expression)
    return expression
  })

  return {
    db: {
      select: vi.fn(() => makeSelectChain()),
    },
    transactions: {
      id: 'transactions.id',
      branchId: 'transactions.branch_id',
      status: 'transactions.status',
      createdAt: 'transactions.created_at',
      payableAmount: 'transactions.payable_amount',
    },
    transactionItems: {
      transactionId: 'transaction_items.transaction_id',
      productId: 'transaction_items.product_id',
      uomId: 'transaction_items.uom_id',
      qty: 'transaction_items.qty',
      cogs: 'transaction_items.cogs',
    },
    branches: {
      id: 'branches.id',
      name: 'branches.name',
      isActive: 'branches.is_active',
    },
    products: {
      id: 'products.id',
      name: 'products.name',
      sku: 'products.sku',
      isActive: 'products.is_active',
      defaultCostPrice: 'products.default_cost_price',
    },
    productUomConversions: {
      productId: 'product_uom_conversions.product_id',
      uomId: 'product_uom_conversions.uom_id',
      ratio: 'product_uom_conversions.ratio',
    },
    productUomCosts: {
      productId: 'product_uom_costs.product_id',
      branchId: 'product_uom_costs.branch_id',
      uomId: 'product_uom_costs.uom_id',
      costPrice: 'product_uom_costs.cost_price',
    },
    productStockBatches: {
      productId: 'product_stock_batches.product_id',
      branchId: 'product_stock_batches.branch_id',
      uomId: 'product_stock_batches.uom_id',
      qtyRemaining: 'product_stock_batches.qty_remaining',
      costPrice: 'product_stock_batches.cost_price',
    },
    damagedGoods: {
      branchId: 'damaged_goods.branch_id',
      reportedAt: 'damaged_goods.reported_at',
      totalLossValue: 'damaged_goods.total_loss_value',
    },
    transactionPayments: {
      transactionId: 'transaction_payments.transaction_id',
      paymentMethodId: 'transaction_payments.payment_method_id',
      amount: 'transaction_payments.amount',
    },
    paymentMethods: {
      id: 'payment_methods.id',
      type: 'payment_methods.type',
    },
    debtPayments: {
      debtId: 'debt_payments.debt_id',
      branchId: 'debt_payments.branch_id',
      amount: 'debt_payments.amount',
      createdAt: 'debt_payments.created_at',
      voidedAt: 'debt_payments.voided_at',
    },
    customerDebts: {
      id: 'customer_debts.id',
      branchId: 'customer_debts.branch_id',
    },
    eq: vi.fn((left, right) => `eq(${left}, ${right})`),
    and: vi.fn((...args) => `and(${args.join(', ')})`),
    gt: vi.fn((left, right) => `gt(${left}, ${right})`),
    isNull: vi.fn((value) => `isNull(${value})`),
    sql,
  }
})

import { getProfitLossReport } from './report-service'

describe('getProfitLossReport COGS fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sqlExpressions.length = 0
    queryResults.length = 0
  })

  it('uses branch UOM cost before product default cost when item COGS is null', async () => {
    queryResults.push(
      [{ branchId: 1, revenue: '100000', transactionCount: 1 }],
      [{ branchId: 1, cogs: '30000' }],
      [{ id: 1, name: 'Cabang A' }],
      [{ branchId: 1, loss: '5000' }],
      [{ branchId: 1, amount: '40000' }],
      [{ branchId: 1, amount: '25000' }],
    )

    const result = await getProfitLossReport({
      startDate: '2026-06-01',
      endDate: '2026-06-11',
    })

    const cogsSql = sqlExpressions.find((expression) => expression.includes('SUM(COALESCE('))

    expect(cogsSql).toContain('transaction_items.cogs')
    expect(cogsSql).toContain('product_uom_costs.cost_price')
    expect(cogsSql).toContain('products.default_cost_price')
    expect(cogsSql).toContain('product_uom_conversions.ratio')
    expect(cogsSql).toContain('COALESCE(transaction_items.cogs, product_uom_costs.cost_price')
    expect(cogsSql?.indexOf('product_uom_costs.cost_price')).toBeLessThan(
      cogsSql?.indexOf('products.default_cost_price') ?? -1,
    )
    expect(result.items[0]).toMatchObject({
      branchId: 1,
      branchName: 'Cabang A',
      revenue: '100000',
      cogs: '30000',
      grossProfit: '70000',
      damagedLoss: '5000',
      netProfit: '65000',
      transactionCount: 1,
      debtSales: '40000',
      debtCollected: '25000',
    })
    expect(result.totalCogs).toBe('30000')
    expect(result.totalGrossProfit).toBe('70000')
    expect(result.totalDamagedLoss).toBe('5000')
    expect(result.totalNetProfit).toBe('65000')

    // Pelunasan piutang tidak boleh menambah pendapatan maupun laba — omzetnya sudah
    // diakui saat transaksi hutang dibuat.
    expect(result.totalRevenue).toBe('100000')
    expect(result.totalDebtSales).toBe('40000')
    expect(result.totalDebtCollected).toBe('25000')
  })

  it('menghitung pelunasan tanpa cabang ke dalam total', async () => {
    queryResults.push(
      [{ branchId: 1, revenue: '100000', transactionCount: 1 }],
      [{ branchId: 1, cogs: '30000' }],
      [{ id: 1, name: 'Cabang A' }],
      [],
      [],
      [
        { branchId: 1, amount: '25000' },
        { branchId: null, amount: '10000' },
      ],
    )

    const result = await getProfitLossReport({
      startDate: '2026-06-01',
      endDate: '2026-06-11',
    })

    expect(result.items[0].debtCollected).toBe('25000')
    expect(result.totalDebtCollected).toBe('35000')
    expect(result.totalRevenue).toBe('100000')
  })
})
