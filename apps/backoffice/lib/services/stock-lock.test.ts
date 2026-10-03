import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { Tx } from '../stock-adjustment'

vi.mock('../db', async () => ({ sql: (await import('drizzle-orm')).sql }))
import { lockProductStocks, lockStockPairs } from './stock-lock'

describe('urutan advisory lock stok', () => {
  it('mengurutkan produk unik sebelum menunggu lock berikutnya', async () => {
    const params: unknown[][] = []
    const tx = { execute: async (query: any) => { params.push(new PgDialect().sqlToQuery(query).params) } } as unknown as Tx
    await lockProductStocks(tx, 2, [10, 3, 10, 1])
    expect(params).toEqual([[2, 1], [2, 3], [2, 10]])
  })
  it('mengurutkan cabang lalu produk untuk mutasi lintas cabang', async () => {
    const params: unknown[][] = []
    const tx = { execute: async (query: any) => { params.push(new PgDialect().sqlToQuery(query).params) } } as unknown as Tx
    await lockStockPairs(tx, [{ branchId: 3, productId: 1 }, { branchId: 1, productId: 8 }, { branchId: 1, productId: 2 }, { branchId: 3, productId: 1 }])
    expect(params).toEqual([[1, 2], [1, 8], [3, 1]])
  })
})
