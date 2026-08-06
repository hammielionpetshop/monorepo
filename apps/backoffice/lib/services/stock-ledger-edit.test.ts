import { sql as realSql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { execute: vi.fn() }, sql: realSql }))

const { buildStockLedgerQuery, STOCK_LEDGER_MOVEMENT_TYPES } = await import('./stock-ledger')

function ledgerSQL(): string {
  return new PgDialect().sqlToQuery(buildStockLedgerQuery([])).sql
}

describe('buku besar mutasi stok — koreksi transaksi', () => {
  it('memakai qty saat nota terbit untuk SALE_OUT, bukan qty berjalan', () => {
    // Inti pencegahan dobel-hitung: transaksi yang dikoreksi mengubah ti.qty.
    // Kalau SALE_OUT ikut memakai ti.qty, mutasi jam jual berubah surut dan
    // selisihnya dihitung dua kali bersama baris EDIT_*.
    const text = ledgerSQL()
    expect(text).toContain('-COALESCE(ti.original_qty, ti.qty)   AS qty_change')
    expect(text).toContain('COALESCE(ti.original_cogs, ti.cogs)  AS cogs')
  })

  it('menyaring item yang baru ditambahkan lewat koreksi dari SALE_OUT', () => {
    // original_qty = 0 berarti item itu tidak ada saat nota terbit.
    expect(ledgerSQL()).toContain('AND COALESCE(ti.original_qty, ti.qty) > 0')
  })

  it('menerbitkan baris EDIT_IN saat qty turun dan EDIT_OUT saat qty naik', () => {
    const text = ledgerSQL()
    expect(text).toContain(
      "CASE WHEN ti.original_qty > ti.qty THEN 'EDIT_IN' ELSE 'EDIT_OUT' END",
    )
    expect(text).toContain('(ti.original_qty - ti.qty)               AS qty_change')
  })

  it('hanya menerbitkan baris koreksi untuk item yang benar-benar berubah', () => {
    const text = ledgerSQL()
    expect(text).toContain('AND ti.original_qty IS NOT NULL')
    expect(text).toContain('AND ti.original_qty <> ti.qty')
  })

  it('mencatat koreksi pada jam koreksi atas nama pelakunya', () => {
    const text = ledgerSQL()
    expect(text).toContain('COALESCE(tea.edited_at, t.updated_at)')
    expect(text).toContain('COALESCE(tea.actor_id, t.cashier_id)')
  })

  it('memakai DISTINCT ON untuk audit koreksi agar baris mutasi tidak tergandakan', () => {
    // Satu transaksi bisa dikoreksi berkali-kali; tanpa DISTINCT ON join akan
    // menggandakan tiap item sebanyak jumlah revisinya.
    expect(ledgerSQL()).toContain('SELECT DISTINCT ON (te.transaction_id)')
  })

  it('tidak mengembalikan stok dua kali saat transaksi yang dikoreksi lalu di-void', () => {
    // Item yang dihapus lewat koreksi ber-qty 0 dan stoknya sudah dikembalikan
    // saat koreksi. SALE_VOID harus melewatinya.
    const text = ledgerSQL()
    const voidBranch = text.slice(text.indexOf("'SALEVOID_'"))
    expect(voidBranch).toContain('AND ti.qty > 0')
  })

  it('mendaftarkan EDIT_IN & EDIT_OUT sebagai jenis mutasi yang dikenal', () => {
    expect(STOCK_LEDGER_MOVEMENT_TYPES).toContain('EDIT_IN')
    expect(STOCK_LEDGER_MOVEMENT_TYPES).toContain('EDIT_OUT')
  })
})
