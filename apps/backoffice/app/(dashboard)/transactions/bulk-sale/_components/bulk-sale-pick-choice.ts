import {
  pickDefaultPriceOption,
  pickInternalDefaultPriceOption,
  pickInternalTierPrice,
  pricesForUom,
} from "./bulk-sale-pricing";
import type { BulkSalePriceOption, BulkSaleProduct, BulkSaleUomOption } from "./types";

/** Isian ringkas di jendela pilih produk: qty, satuan, dan tier sebelum masuk daftar. */
export type BulkSalePickChoice = {
  uomId: number;
  priceTier: string;
  qty: number;
};

export function defaultPickChoice(product: BulkSaleProduct, internal: boolean): BulkSalePickChoice | null {
  const picked = internal ? pickInternalDefaultPriceOption(product) : pickDefaultPriceOption(product);
  if (!picked) return null;
  return { uomId: picked.uom.uomId, priceTier: picked.price.priceTier, qty: 1 };
}

/** Satuan yang bisa dipilih = yang sudah berharga di cabang ini. */
export function pricedUoms(product: BulkSaleProduct): BulkSaleUomOption[] {
  return product.availableUoms.filter((uom) => pricesForUom(product.prices, uom.uomId).length > 0);
}

/** Ganti satuan: tier lama dipertahankan bila satuan baru punya harganya, selain itu tier bawaan. */
export function changeChoiceUom(
  product: BulkSaleProduct,
  choice: BulkSalePickChoice,
  uomId: number,
  internal: boolean,
): BulkSalePickChoice {
  const prices = pricesForUom(product.prices, uomId);
  if (prices.length === 0) return choice;
  const keep = prices.find((price) => price.priceTier === choice.priceTier);
  const fallback = internal ? pickInternalTierPrice(product.prices, uomId) : prices[0];
  return { ...choice, uomId, priceTier: (keep ?? fallback ?? prices[0]).priceTier };
}

export function resolvePickChoice(
  product: BulkSaleProduct,
  choice: BulkSalePickChoice,
): { uom: BulkSaleUomOption; price: BulkSalePriceOption } | null {
  const uom = product.availableUoms.find((option) => option.uomId === choice.uomId);
  const price = pricesForUom(product.prices, choice.uomId).find((option) => option.priceTier === choice.priceTier);
  return uom && price ? { uom, price } : null;
}

/** Qty dari kotak isian: bilangan bulat ≥ 1, selain itu null (ditolak). */
export function parsePickQty(value: string): number | null {
  const qty = Number(value.trim());
  return Number.isInteger(qty) && qty >= 1 ? qty : null;
}
