import type { AnyColumn } from 'drizzle-orm'
import { sql } from '@/lib/db'

// Bagian server mesin diskon manual yang hanya DIBACA saat menyusun struk/laporan — tidak menulis
// apa pun. Aturannya tetap di `lib/manual-discount.ts`.

/**
 * Persentase diskon manual mode PERSEN di satu baris nota (NULL bila baris tidak didiskon persen).
 * Dipakai saat memuat nota untuk CETAK ULANG struk supaya potongan baris berlabel "Diskon 10%",
 * bukan "Diskon" biasa. Satu baris hanya punya satu catatan diskon manual, jadi `LIMIT 1` pasti
 * baris yang benar.
 */
export function manualDiscountPercentOfItemSql(transactionItemId: AnyColumn) {
  return sql<number | null>`(
    SELECT tid.percent FROM petshop.transaction_item_discounts tid
    WHERE tid.transaction_item_id = ${transactionItemId} AND tid.kind = 'MANUAL' AND tid.percent IS NOT NULL
    LIMIT 1
  )`
}
