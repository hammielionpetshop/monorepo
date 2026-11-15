import { describe, it, expect } from 'vitest';
import { getPrice, getAllTierPrices, validateOwnerOverride, getPriceKey } from './pricing';

describe('Pricing Utils', () => {
  const priceMap = new Map<string, number>([
    [getPriceKey(1, 1, 1, 'RETAIL'), 10000],
    [getPriceKey(1, 1, 1, 'GROSIR'), 9500],
    [getPriceKey(1, 1, 1, 'PROMO'), 8000],
  ]);

  it('getPrice: should return correct price from map', () => {
    const result = getPrice(priceMap, { productId: 1, branchId: 1, uomId: 1, tier: 'RETAIL' });
    expect(result.price).toBe(10000);
    expect(result.isPromoApplied).toBe(false);
  });

  it('getPrice: should return 0 if price not found', () => {
    const result = getPrice(priceMap, { productId: 1, branchId: 1, uomId: 1, tier: 'MEMBER' });
    expect(result.price).toBe(0);
  });

  it('getAllTierPrices: should return record of all tiers', () => {
    const result = getAllTierPrices(priceMap, 1, 1, 1);
    expect(result.RETAIL).toBe(10000);
    expect(result.GROSIR).toBe(9500);
    expect(result.PROMO).toBe(8000);
    expect(result.MEMBER).toBeNull();
  });

  describe('validateOwnerOverride', () => {
    it('should approve normal override', () => {
      const result = validateOwnerOverride({
        productId: 1,
        uomId: 1,
        overridePrice: 8000,
        retailPrice: 10000
      });
      expect(result.approved).toBe(true);
      expect(result.requiresWarning).toBe(false);
    });

    it('should require warning if price is < 50% retail', () => {
      const result = validateOwnerOverride({
        productId: 1,
        uomId: 1,
        overridePrice: 4000,
        retailPrice: 10000
      });
      expect(result.approved).toBe(true);
      expect(result.requiresWarning).toBe(true);
    });

    it('should reject Rp 0', () => {
      const result = validateOwnerOverride({
        productId: 1,
        uomId: 1,
        overridePrice: 0,
        retailPrice: 10000
      });
      expect(result.approved).toBe(false);
      expect(result.error).toContain('tidak boleh Rp 0');
    });
  });
});
