// Pencarian per kata: "bolt ikan" cocok dengan "BOLT DRY IKAN 800GR" — setiap kata harus
// ada, urutan dan kata di antaranya bebas. Sama dengan aturan pencarian produk di Bulk Sale
// (api/bo/bulk-sale-products), supaya layar daftar yang menyaring di browser tidak menuntut
// user mengetik nama lengkap secara berurutan.

export function splitSearchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/** True bila SETIAP kata di `query` ada di salah satu `fields`. Query kosong = cocok semua. */
export function matchesSearchWords(query: string, fields: Array<string | null | undefined>): boolean {
  const words = splitSearchWords(query)
  if (words.length === 0) return true
  const haystacks = fields.map((field) => (field ?? '').toLowerCase())
  return words.every((word) => haystacks.some((haystack) => haystack.includes(word)))
}
