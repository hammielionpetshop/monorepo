// Mesin berat produk — SATU-SATUNYA tempat aturan "berapa gram 1 satuan produk".
// Dipakai tonase surat jalan (cetak baru & cetak ulang) dan tampilan Master Data
// Produk, supaya angka di layar dan angka di kertas tidak pernah berbeda.
//
// Aturannya (keputusan owner 2026-10-12):
//   1. Sumber berat cuma satu: berat 1 SATUAN TERKECIL di data produk.
//   2. Berat satuan besar (dus, sak, ...) SELALU dihitung: isi × berat satuan terkecil.
//      Kolom lama product_uom_conversions.weight_gram tidak lagi dibaca — dulu angka
//      itu diisi manual dan sering tidak cocok dengan isinya (tonase salah).
//   3. Satuan terkecil yang memang satuan berat (GRAM, KG) beratnya sudah pasti,
//      apa pun yang tertulis di data produk.
//
// Modul ini murni (tanpa DB, tanpa React) — aman diimpor server maupun client.

const FIXED_UNIT_GRAMS: Record<string, number> = {
  G: 1,
  GR: 1,
  GRAM: 1,
  KG: 1000,
}

/** Gram per 1 satuan bila satuannya sendiri satuan berat (GRAM/KG), selain itu null. */
export function fixedUnitWeightGram(uomCode: string | null | undefined): number | null {
  if (!uomCode) return null
  return FIXED_UNIT_GRAMS[uomCode.trim().toUpperCase()] ?? null
}

/**
 * Berat 1 satuan terkecil (gram), atau null bila belum terdata.
 * 0 dan nilai negatif diperlakukan sama dengan kosong.
 */
export function baseUnitWeightGram(
  baseUomCode: string | null | undefined,
  weightGram: number | string | null | undefined,
): number | null {
  const fixed = fixedUnitWeightGram(baseUomCode)
  if (fixed != null) return fixed
  if (weightGram == null || weightGram === '') return null
  const w = Number(weightGram)
  return Number.isFinite(w) && w > 0 ? w : null
}

/**
 * Berat 1 unit satuan yang dipilih (gram) = isi × berat satuan terkecil.
 * Satuan terkecil sendiri memakai `conversionRate` 1. Null = produk belum punya
 * data berat, baris itu tidak ikut dihitung tonase.
 */
export function resolveUomWeightGram(
  baseUomCode: string | null | undefined,
  baseWeightGram: number | string | null | undefined,
  conversionRate: number | null | undefined,
): number | null {
  const base = baseUnitWeightGram(baseUomCode, baseWeightGram)
  if (base == null) return null
  const rate = Number(conversionRate)
  return base * (Number.isFinite(rate) && rate > 0 ? rate : 1)
}

/** Tampilan berat untuk layar: "80 g", "1,2 kg", "20 kg". */
export function formatWeightGram(gram: number): string {
  if (gram >= 1000) {
    return `${(gram / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`
  }
  return `${gram.toLocaleString('id-ID', { maximumFractionDigits: 2 })} g`
}
