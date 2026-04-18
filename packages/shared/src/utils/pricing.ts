/**
 * Pricing Logic for 6-tier pricing system.
 * Supports per-product, per-branch, and per-UOM pricing.
 */

export type PriceTier = 'RETAIL' | 'GROSIR' | 'MEMBER' | 'DISTRIBUTOR' | 'RESELLER' | 'PROMO';

export interface PriceLookup {
  productId: number;
  branchId: number;
  uomId: number;
  tier: PriceTier;
}

export interface PriceResult {
  price: number;
  tier: PriceTier;
  isPromoApplied: boolean;
  originalPrice?: number;
}

/**
 * Generates a unique key for the price map.
 */
export function getPriceKey(productId: number, branchId: number, uomId: number, tier: string): string {
  return `${productId}:${branchId}:${uomId}:${tier}`;
}

/**
 * Look up a specific price from a mapping.
 * 
 * @param priceMap Map of generated keys to prices
 * @param lookup Parameters for pricing lookup
 */
export function getPrice(priceMap: Map<string, number>, lookup: PriceLookup): PriceResult {
  const key = getPriceKey(lookup.productId, lookup.branchId, lookup.uomId, lookup.tier);
  const price = priceMap.get(key) || 0;

  return {
    price,
    tier: lookup.tier,
    isPromoApplied: lookup.tier === 'PROMO',
  };
}

/**
 * Get all available tier prices for a specific product context.
 */
export function getAllTierPrices(
  priceMap: Map<string, number>,
  productId: number,
  branchId: number,
  uomId: number
): Record<PriceTier, number | null> {
  const tiers: PriceTier[] = ['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO'];
  const result = {} as Record<PriceTier, number | null>;

  for (const tier of tiers) {
    const key = getPriceKey(productId, branchId, uomId, tier);
    result[tier] = priceMap.get(key) ?? null;
  }

  return result;
}

/**
 * Owner Price Override Validation
 */
export interface OwnerOverrideRequest {
  productId: number;
  uomId: number;
  overridePrice: number;
  retailPrice: number; // For comparison
}

export interface OwnerOverrideResult {
  approved: boolean;
  requiresWarning: boolean; // true if override < 50% retail
  price: number;
  error?: string;
}

/**
 * Validates manual price override by an owner.
 */
export function validateOwnerOverride(request: OwnerOverrideRequest): OwnerOverrideResult {
  if (request.overridePrice <= 0) {
    return {
      approved: false,
      requiresWarning: false,
      price: 0,
      error: "Harga override tidak boleh Rp 0 atau negatif.",
    };
  }

  const requiresWarning = request.overridePrice < (request.retailPrice * 0.5);

  return {
    approved: true,
    requiresWarning,
    price: request.overridePrice,
  };
}
