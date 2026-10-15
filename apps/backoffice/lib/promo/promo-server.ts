import type { AnyColumn } from 'drizzle-orm'
import { sql } from '@/lib/db'

// Bagian server mesin promo yang hanya dibaca saat menyusun struk/laporan — tidak menulis apa pun.

/**
 * Nama promo yang berlaku di satu baris nota (NULL bila baris tidak kena promo). Dipakai saat
 * memuat nota untuk CETAK ULANG struk supaya potongan baris berlabel nama promonya, bukan
 * "Diskon" biasa. Satu baris hanya bisa kena satu promo (aturan mesin promo), jadi `LIMIT 1`
 * sudah pasti baris yang benar.
 */
export function promoNameOfItemSql(transactionItemId: AnyColumn) {
  return sql<string | null>`(
    SELECT tid.promotion_name FROM petshop.transaction_item_discounts tid
    WHERE tid.transaction_item_id = ${transactionItemId} AND tid.kind = 'PROMO'
    LIMIT 1
  )`
}
