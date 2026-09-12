import type { BulkSalePriceOption, BulkSaleProduct, BulkSaleUomOption } from "./types";

// Harga 0 diperlakukan sama dengan harga yang belum ada: bukan "gratis", melainkan
// baris harga yang belum diisi. Ada produk yang hanya satuan besarnya punya harga,
// jadi baris baru harus jatuh ke satuan itu — bukan ditolak atau memakai harga 0.
export function pricesForUom(prices: BulkSalePriceOption[], uomId: number) {
  return prices.filter((price) => price.uomId === uomId && price.price > 0);
}

export function hasUsablePrice(prices: BulkSalePriceOption[], uomId: number) {
  return pricesForUom(prices, uomId).length > 0;
}

// Urutan pencarian satuan: satuan dasar dulu, lalu satuan lain dari yang terkecil.
// Kalau satuan dasarnya belum berharga, yang dipakai satuan berharga terdekat di
// atasnya — bukan satuan terbesar yang kebetulan lebih dulu terbaca dari DB.
export function orderedUomCandidates(product: BulkSaleProduct): BulkSaleUomOption[] {
  const base = product.availableUoms.filter((uom) => uom.uomId === product.baseUomId);
  const others = product.availableUoms
    .filter((uom) => uom.uomId !== product.baseUomId)
    .sort((a, b) => a.conversionRate - b.conversionRate);
  return [...base, ...others];
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
