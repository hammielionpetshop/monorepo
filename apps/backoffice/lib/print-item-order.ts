// Urutan item di nota & surat jalan: nama produk A–Z, supaya mudah dicek saat muat/terima barang.
// Struk kasir sengaja TIDAK memakai ini — tetap urutan input agar cocok dengan yang dipindai kasir.
// Sort JS stabil, jadi produk bernama sama (beda satuan/tier) tetap mengikuti urutan input.

const collator = new Intl.Collator('id', { sensitivity: 'base', numeric: true })

export function sortItemsForPrint<T extends { productName: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => collator.compare(a.productName.trim(), b.productName.trim()))
}
