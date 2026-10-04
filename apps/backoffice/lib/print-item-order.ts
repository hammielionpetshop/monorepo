// Urutan item di semua cetakan transaksi (struk, nota, surat jalan, PNG): nama produk A–Z.
// Sort JS stabil, jadi produk bernama sama (beda satuan/tier) tetap mengikuti urutan input.

const collator = new Intl.Collator('id', { sensitivity: 'base', numeric: true })

export function sortItemsForPrint<T extends { productName: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => collator.compare(a.productName.trim(), b.productName.trim()))
}
