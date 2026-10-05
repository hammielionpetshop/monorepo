import type { BulkSalePriceOption, BulkSaleProduct, BulkSaleUomOption } from "./types";

// Urutan tier dikunci, bukan ikut urutan baris di DB (yang berbeda antar produk) —
// supaya harga antar produk sejajar dan mudah dibandingkan. Tier lain menyusul abjad.
const TIER_ORDER = ["RETAIL", "RESELLER", "GROSIR"];

export function compareTier(a: string, b: string) {
  const rankA = TIER_ORDER.indexOf(a);
  const rankB = TIER_ORDER.indexOf(b);
  if (rankA !== rankB) return (rankA === -1 ? TIER_ORDER.length : rankA) - (rankB === -1 ? TIER_ORDER.length : rankB);
  return a.localeCompare(b);
}

// Harga 0 diperlakukan sama dengan harga yang belum ada: bukan "gratis", melainkan
// baris harga yang belum diisi. Ada produk yang hanya satuan besarnya punya harga,
// jadi baris baru harus jatuh ke satuan itu — bukan ditolak atau memakai harga 0.
export function pricesForUom(prices: BulkSalePriceOption[], uomId: number) {
  return prices
    .filter((price) => price.uomId === uomId && price.price > 0)
    .sort((a, b) => compareTier(a.priceTier, b.priceTier));
}

export function hasUsablePrice(prices: BulkSalePriceOption[], uomId: number) {
  return pricesForUom(prices, uomId).length > 0;
}

// Bulk Sale = jual partai, jadi satuan bawaan baris baru adalah satuan TERBESAR yang
// sudah berharga (DUS/BOX/SAK), bukan PCS. Satuan dasar baru dipakai kalau memang
// cuma satuan itu yang berharga. Rasio yang sama diurutkan stabil (urutan dari DB).
export function orderedUomCandidates(product: BulkSaleProduct): BulkSaleUomOption[] {
  const base = product.availableUoms.filter((uom) => uom.uomId === product.baseUomId);
  const others = product.availableUoms
    .filter((uom) => uom.uomId !== product.baseUomId)
    .sort((a, b) => b.conversionRate - a.conversionRate);
  return [...others, ...base];
}

// Prefill dari Internal PO: customer tujuan (toko cabang) biasanya sudah punya tier
// tetap (mis. GROSIR), bukan RETAIL. Tanpa ini baris ikut harga pertama yang kebetulan
// lebih dulu terbaca dari DB — bisa salah tier walau harga tier yang benar tersedia.
export function pickTierPrice(
  prices: BulkSalePriceOption[],
  uomId: number,
  preferredTier?: string | null
): BulkSalePriceOption | null {
  const options = pricesForUom(prices, uomId);
  if (preferredTier) {
    const preferred = options.find((option) => option.priceTier === preferredTier);
    if (preferred) return preferred;
  }
  return options[0] ?? null;
}

export type PickedBulkSalePrice = {
  price: BulkSalePriceOption;
  uom: BulkSaleUomOption;
};

// Satuan sengaja dibatasi pada availableUoms: satuan tanpa konversi (selain satuan
// dasar) ditolak server lewat INVALID_UOM, jadi tidak ada gunanya dipilih di layar.
export function pickDefaultPriceOption(product: BulkSaleProduct): PickedBulkSalePrice | null {
  for (const uom of orderedUomCandidates(product)) {
    const price = pricesForUom(product.prices, uom.uomId)[0];
    if (price) return { price, uom };
  }
  return null;
}

// PO Internal = jual ke cabang sendiri, jadi harga bawaannya selalu yang termurah:
// GROSIR, turun ke RESELLER, RETAIL hanya bila dua lainnya belum diisi (kanban #43).
// Tier per baris tetap bisa diganti manual — ini cuma bawaan, bukan kunci.
const INTERNAL_TIER_PREFERENCE = ["GROSIR", "RESELLER", "RETAIL"];

export function pickInternalTierPrice(
  prices: BulkSalePriceOption[],
  uomId: number
): BulkSalePriceOption | null {
  const options = pricesForUom(prices, uomId);
  for (const tier of INTERNAL_TIER_PREFERENCE) {
    const match = options.find((option) => option.priceTier === tier);
    if (match) return match;
  }
  return options[0] ?? null;
}

export function pickInternalDefaultPriceOption(product: BulkSaleProduct): PickedBulkSalePrice | null {
  for (const uom of orderedUomCandidates(product)) {
    const price = pickInternalTierPrice(product.prices, uom.uomId);
    if (price) return { price, uom };
  }
  return null;
}

// Peringatan baris PO Internal yang memakai RETAIL: entah karena GROSIR/RESELLER belum
// diisi di master, entah karena diganti manual padahal ada yang lebih murah.
export function internalRetailWarning(
  prices: BulkSalePriceOption[],
  uomId: number,
  priceTier: string
): string | null {
  if (priceTier !== "RETAIL") return null;
  const cheaper = pickInternalTierPrice(prices, uomId);
  if (cheaper && cheaper.priceTier !== "RETAIL") return `ada ${cheaper.priceTier} lebih murah`;
  return "GROSIR/RESELLER kosong";
}
