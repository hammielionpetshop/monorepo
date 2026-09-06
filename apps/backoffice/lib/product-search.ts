import { products, and, or, ilike } from '@petshop/db'
import type { SQL } from 'drizzle-orm'

// Kasir mengetik dari ingatan, bukan menyalin. Delapan potongan sudah jauh lebih
// panjang dari nama produk terpanjang; sisanya diabaikan supaya satu ketikan
// nyasar tidak berubah jadi query dengan puluhan ILIKE.
const MAX_TOKENS = 8

/**
 * Kondisi pencarian produk untuk kotak cari POS.
 *
 * Kata kunci dipecah per spasi dan SEMUA potongan harus cocok, jadi urutan kata
 * tidak lagi menentukan: "crystal tuna" menemukan "CRYSTAL PC TUNA MACKAREL",
 * yang tidak akan ketemu kalau kata kunci dicocokkan sebagai satu blok utuh.
 * Tiap potongan boleh cocok di nama atau SKU.
 *
 * Barcode sengaja tetap dicocokkan utuh: hasil pindai adalah satu string, dan
 * memecahnya per spasi hanya melebarkan hasil tanpa menolong siapa pun.
 *
 * Ini memperbaiki urutan kata, bukan salah ketik — "blot" tetap tidak menemukan
 * "bolt".
 */
export function productSearchCondition(search: string): SQL<unknown> | undefined {
  const term = search.trim()
  const tokens = term.split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS)
  if (tokens.length === 0) return undefined

  const allTokensMatch = and(
    ...tokens.map((token) =>
      or(ilike(products.name, `%${token}%`), ilike(products.sku, `%${token}%`)),
    ),
  )

  return or(allTokensMatch, ilike(products.barcode, `%${term}%`))
}
