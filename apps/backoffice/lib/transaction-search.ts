import { transactions, transactionItems, products, sql } from '@/lib/db'
import type { SQL } from 'drizzle-orm'

/**
 * Kondisi "nota ini memuat produk bernama X", untuk dipakai di WHERE query transaksi.
 *
 * Nama dicocokkan ke snapshot pada item DAN ke master produk: snapshot menang untuk
 * produk yang sudah dihapus atau berganti nama, master menang untuk item lama yang
 * snapshot-nya kosong. Item yang dibuang lewat koreksi nota tidak dihitung — barisnya
 * sengaja dipertahankan demi mutasi stok, tapi notanya tidak lagi memuat produk itu.
 *
 * Dipakai bersama oleh Riwayat Transaksi back office dan riwayat POS supaya kedua
 * layar menjawab kata kunci yang sama dengan daftar nota yang sama.
 */
export function transactionHasProduct(term: string): SQL<unknown> {
  const like = `%${term}%`
  return sql`EXISTS (
    SELECT 1 FROM ${transactionItems}
    LEFT JOIN ${products} ON ${products.id} = ${transactionItems.productId}
    WHERE ${transactionItems.transactionId} = ${transactions.id}
      AND ${transactionItems.isRemoved} = false
      AND (${transactionItems.productName} ILIKE ${like} OR ${products.name} ILIKE ${like})
  )`
}
