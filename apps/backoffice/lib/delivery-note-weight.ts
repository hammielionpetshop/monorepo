// Perhitungan tonase surat jalan — dipakai bersama oleh cetak ESC/P (qz-print.ts)
// dan fallback cetak browser (bulk-sale-delivery-note-print.tsx). Sengaja modul
// terpisah tanpa import balik ke komponen agar tidak ada circular import.

// Struktural & minimal: cocok dengan DeliveryNoteItem tanpa mengikatnya.
export type WeighableItem = {
  qty: number
  // Berat 1 unit UOM baris ini (gram). Diisi dari product_uom_conversions.weight_gram,
  // atau ratio * products.weight_gram bila konversi tidak punya berat sendiri.
  weightGram?: number | null
}

export type TonaseResult = {
  /** Total gram dari baris yang beratnya diketahui. */
  totalGram: number
  /** Jumlah baris yang tidak punya data berat sama sekali. */
  unknownCount: number
  /** True bila tidak ada satu pun baris dengan berat diketahui. */
  isEmpty: boolean
}

export function calcTonase(items: WeighableItem[]): TonaseResult {
  let totalGram = 0
  let unknownCount = 0
  let knownCount = 0

  for (const item of items) {
    const w = item.weightGram
    if (w == null || !Number.isFinite(w) || w <= 0) {
      unknownCount += 1
      continue
    }
    totalGram += item.qty * w
    knownCount += 1
  }

  return { totalGram: Math.round(totalGram), unknownCount, isEmpty: knownCount === 0 }
}

/**
 * Baris tonase siap cetak, atau `null` bila TIDAK ada data berat sama sekali.
 *
 * Sengaja mengembalikan null (baris dihilangkan) alih-alih mencetak "0 kg":
 * surat jalan dipakai untuk serah-terima barang, dan angka nol yang salah lebih
 * berbahaya daripada tidak ada angka. Bila sebagian item saja yang tidak punya
 * berat, angkanya tetap dicetak tapi diberi catatan jumlah item yang belum terdata
 * supaya penerima tahu tonase itu belum lengkap.
 */
export function formatTonaseLine(items: WeighableItem[]): string | null {
  const { totalGram, unknownCount, isEmpty } = calcTonase(items)
  if (isEmpty) return null

  const kg = (totalGram / 1000).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const suffix = unknownCount > 0 ? ` (${unknownCount} item tanpa data berat)` : ''
  return `TONASE: ${kg} kg${suffix}`
}

/**
 * Berat per 1 unit UOM yang dipilih, dalam gram.
 *
 * Prioritas `product_uom_conversions.weight_gram` (berat riil per UOM itu, mis.
 * 1 karung), baru fallback ke `ratio * products.weight_gram` (berat base UOM
 * dikali isi). Keduanya bisa null → baris dianggap tidak punya data berat.
 */
export function resolveUomWeightGram(
  uomWeightGram: number | null | undefined,
  baseWeightGram: number | null | undefined,
  conversionRate: number,
): number | null {
  if (uomWeightGram != null && Number.isFinite(uomWeightGram) && uomWeightGram > 0) {
    return uomWeightGram
  }
  if (baseWeightGram != null && Number.isFinite(baseWeightGram) && baseWeightGram > 0) {
    return baseWeightGram * (Number.isFinite(conversionRate) && conversionRate > 0 ? conversionRate : 1)
  }
  return null
}
