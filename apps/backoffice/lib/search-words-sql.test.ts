import { PgDialect } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { splitSearchWords } from './search-words'

// Penjaga bentuk SQL mentah yang dipakai Master Harga & ekspor harga
// (api/bo/master-data/prices, price-service): satu "AND p.name ILIKE" per kata.
const dialect = new PgDialect()

function whereSearch(search: string | null) {
  return dialect.sqlToQuery(
    sql`SELECT 1 FROM p WHERE true ${sql.join(
      splitSearchWords(search ?? '').map((word) => sql`AND p.name ILIKE ${'%' + word + '%'}`),
      sql` `,
    )}`,
  )
}

describe('pencarian per kata di SQL mentah', () => {
  it('satu syarat ILIKE per kata', () => {
    const q = whereSearch('Bolt  Ikan')
    expect(q.sql).toBe('SELECT 1 FROM p WHERE true AND p.name ILIKE $1 AND p.name ILIKE $2')
    expect(q.params).toEqual(['%bolt%', '%ikan%'])
  })

  it('pencarian kosong tidak menambah syarat', () => {
    expect(whereSearch(null).sql).toBe('SELECT 1 FROM p WHERE true ')
    expect(whereSearch('   ').params).toEqual([])
  })
})
