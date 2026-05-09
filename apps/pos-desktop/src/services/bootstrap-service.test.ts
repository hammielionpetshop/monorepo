import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapService } from './bootstrap-service';
import { getDb } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  getDb: vi.fn()
}));

describe('BootstrapService', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      transaction: vi.fn((_mode: any, _tables: any, cb: any) => cb()),
      products: { bulkPut: vi.fn(), clear: vi.fn(), toArray: vi.fn() },
      categories: { bulkPut: vi.fn(), clear: vi.fn(), toArray: vi.fn() },
      productUoms: { bulkPut: vi.fn(), clear: vi.fn(), toArray: vi.fn() },
      productPrices: { bulkPut: vi.fn(), clear: vi.fn(), toArray: vi.fn() },
      customers: { bulkPut: vi.fn(), clear: vi.fn(), toArray: vi.fn() },
      paymentMethods: { bulkPut: vi.fn(), clear: vi.fn(), toArray: vi.fn() },
      taxSettings: { bulkPut: vi.fn(), clear: vi.fn(), toArray: vi.fn() },
      suppliers: { bulkPut: vi.fn(), clear: vi.fn(), toArray: vi.fn() },
    };
    (getDb as any).mockResolvedValue(mockDb);
  });

  it('should populate database with master data', async () => {
    const mockData = {
      products: [{ id: 1, name: 'Product 1' }],
      prices: [{ id: 1, price: 10000 }],
      conversions: [{ id: 1, conversionValue: 10 }]
    };

    await bootstrapService.populate(mockData);

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.products.bulkPut).toHaveBeenCalledWith(mockData.products);
    expect(mockDb.productPrices.bulkPut).toHaveBeenCalled();
    expect(mockDb.productUoms.bulkPut).toHaveBeenCalled();
  });

  it('should format big.js values before storing', async () => {
    const mockData = {
      prices: [{ id: 1, price: 10000.5 }]
    };

    await bootstrapService.populate(mockData);

    const bulkPutCall = mockDb.productPrices.bulkPut.mock.calls[0][0];
    expect(bulkPutCall[0].price).toBe('10000.5');
  });

  it('should load data from local storage', async () => {
    mockDb.products.toArray.mockResolvedValue([{ id: 1, name: 'Local Product' }]);
    mockDb.categories.toArray.mockResolvedValue([]);
    mockDb.productPrices.toArray.mockResolvedValue([]);
    mockDb.productUoms.toArray.mockResolvedValue([]);
    mockDb.customers.toArray.mockResolvedValue([]);
    mockDb.paymentMethods.toArray.mockResolvedValue([]);
    mockDb.taxSettings.toArray.mockResolvedValue([]);
    mockDb.suppliers.toArray.mockResolvedValue([]);

    const result = await bootstrapService.loadFromLocal();

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Local Product');
    expect(result.categories).toEqual([]);
  });

  it('should clear all master data', async () => {
    await bootstrapService.clear();

    expect(mockDb.products.clear).toHaveBeenCalled();
    expect(mockDb.productPrices.clear).toHaveBeenCalled();
    expect(mockDb.customers.clear).toHaveBeenCalled();
  });
});
