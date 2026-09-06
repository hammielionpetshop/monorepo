import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { productSearchCondition } from './product-search'

const dialect = new PgDialect()

/** Pola ILIKE yang benar-benar dikirim ke Postgres sebagai bind parameter. */
function params(term: string): unknown[] {
  const condition = productSearchCondition(term)
  return condition ? dialect.sqlToQuery(condition).params : []
}

describe('productSearchCondition', () => {
  it('kata kunci kosong tidak menghasilkan filter apa pun', () => {
    expect(productSearchCondition('')).toBeUndefined()
    expect(productSearchCondition('   ')).toBeUndefined()
  })

  it('memecah kata kunci per spasi supaya urutan kata tidak menentukan', () => {
    const p = params('crystal tuna')
    expect(p).toContain('%crystal%')
    expect(p).toContain('%tuna%')
  })

  it('spasi berlebih tidak jadi potongan kosong yang mencocokkan apa saja', () => {
    expect(params('  bolt   salmon  ')).not.toContain('%%')
  })

  it('barcode tetap dicocokkan utuh, bukan per kata', () => {
    expect(params('bolt salmon')).toContain('%bolt salmon%')
  })

  it('satu kata tetap satu pola, perilakunya tidak berubah', () => {
    expect(new Set(params('bolt'))).toEqual(new Set(['%bolt%']))
  })
})
