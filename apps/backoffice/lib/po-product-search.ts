import { splitSearchWords } from './search-words'

/**
 * Nama produk di sebuah PO yang cocok dengan pencarian. Setiap kata harus ada di SATU nama
 * produk yang sama (urutan bebas): "amigo tuna" cocok dengan "AMIGO TUNA 85GR", tetapi PO
 * yang hanya berisi "AMIGO SALMON" dan "TUNA KALENG" tidak ikut muncul.
 * Query kosong mengembalikan `null` (artinya: tidak sedang mencari).
 */
export function matchingProductNames(query: string, productNames: string[]): string[] | null {
  const words = splitSearchWords(query)
  if (words.length === 0) return null
  return productNames.filter((name) => {
    const haystack = name.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

/** Ringkasan "cocok: A, B +3 lainnya" untuk ditampilkan di baris PO. */
export function summarizeMatches(names: string[], max = 2): string {
  const shown = names.slice(0, max).join(', ')
  const rest = names.length - max
  return rest > 0 ? `${shown} +${rest} lainnya` : shown
}
