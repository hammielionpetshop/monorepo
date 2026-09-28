import { transactions, transactionItems, products, customers, sql } from '@petshop/db'
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

/**
 * Kondisi "nota ini milik customer bernama X", untuk dipakai di WHERE query transaksi.
 *
 * Cocok sebagian & tidak peduli huruf besar/kecil, dipakai saat kasir/admin mengetik
 * nama tanpa memilih customer tertentu dari daftar. Nota tanpa customer (penjualan
 * umum) tidak pernah cocok karena customer_id-nya kosong. Ditulis sebagai EXISTS,
 * bukan join, supaya query hitung total dan query daftar memakai kondisi yang sama.
 */
export function transactionHasCustomer(term: string): SQL<unknown> {
  return sql`EXISTS (
    SELECT 1 FROM ${customers}
    WHERE ${customers.id} = ${transactions.customerId}
      AND ${customers.name} ILIKE ${`%${term}%`}
  )`
}

/** Jarak maksimum dua nota kembar agar dianggap terindikasi double input. */
export const DOUBLE_INPUT_WINDOW_SECONDS = 60

// Sidik jari isi nota: produk + satuan + qty, urut, tanpa item yang dibuang lewat koreksi.
// Produk yang sudah dihapus jatuh ke snapshot nama supaya nota lama tetap bisa dibandingkan.
function itemSignature(transactionId: SQL<unknown>): SQL<unknown> {
  return sql`(
    SELECT string_agg(
      COALESCE(ti.product_id::text, ti.product_name) || ':' || ti.uom_id || ':' || ti.qty,
      ',' ORDER BY COALESCE(ti.product_id::text, ti.product_name), ti.uom_id, ti.qty
    )
    FROM ${transactionItems} ti
    WHERE ti.transaction_id = ${transactionId} AND ti.is_removed = false
  )`
}

/**
 * Syarat pasangan nota `twin` (alias) dengan nota utama sebagai kembaran double input:
 * kasir, cabang, customer, total, dan isi sama persis, berjarak ≤ 60 detik, dan
 * keduanya belum di-void. Pola ini yang muncul saat kasir menekan Bayar lagi karena
 * respons pertama hilang di koneksi lambat.
 */
function doubleInputTwinCondition(): SQL<unknown> {
  const window = sql.raw(`interval '${DOUBLE_INPUT_WINDOW_SECONDS} seconds'`)
  return sql`twin.id <> ${transactions.id}
    AND twin.status <> 'VOIDED'
    AND ${transactions.status} <> 'VOIDED'
    AND twin.branch_id = ${transactions.branchId}
    AND twin.cashier_id = ${transactions.cashierId}
    AND twin.customer_id IS NOT DISTINCT FROM ${transactions.customerId}
    AND twin.payable_amount = ${transactions.payableAmount}
    AND twin.created_at BETWEEN ${transactions.createdAt} - ${window} AND ${transactions.createdAt} + ${window}
    AND ${itemSignature(sql`twin.id`)} = ${itemSignature(sql`${transactions.id}`)}`
}

/** Kondisi WHERE "nota ini terindikasi double input" — kedua sisi pasangan ikut tampil. */
export function transactionSuspectedDouble(): SQL<unknown> {
  return sql`EXISTS (
    SELECT 1 FROM ${transactions} AS twin
    WHERE ${doubleInputTwinCondition()}
  )`
}

/** Query pasangan (id nota → no. nota kembarannya) untuk sekumpulan nota. */
export function doubleInputTwinsQuery(transactionIds: number[]): SQL<unknown> {
  return sql`
    SELECT ${transactions.id} AS id, twin.trx_number AS twin_trx_number
    FROM ${transactions}
    JOIN ${transactions} AS twin ON ${doubleInputTwinCondition()}
    WHERE ${transactions.id} = ANY(ARRAY[${sql.join(transactionIds.map(id => sql`${id}`), sql`, `)}]::int[])
    ORDER BY twin.created_at
  `
}
