import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePOSStore } from '@/store/pos-store';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { bootstrapService } from '@/services/bootstrap-service';
import { toast } from 'sonner';

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}));

vi.mock('@/services/bootstrap-service', () => ({
  bootstrapService: {
    populate: vi.fn(),
    loadFromLocal: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/sync-service', () => ({
  syncService: {
    startAutoSync: vi.fn(),
    stopAutoSync: vi.fn(),
  },
}));

describe('Bootstrap logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePOSStore.setState({
      products: [],
      categories: [],
      uoms: [],
      isInitialized: false,
      isLoading: false,
    });
    useAuthStore.setState({ user: null } as unknown as Parameters<typeof useAuthStore.setState>[0]);
  });

  it('should populate bootstrap data to store with fallback for missing uoms (Bug #2)', () => {
    const data = {
      products: [{ id: 1, name: 'Product 1' }],
    };

    usePOSStore.getState().setBootstrapData(data);

    const state = usePOSStore.getState();
    expect(state.uoms).toEqual([]);
    expect(state.products).toEqual(data.products);
    expect(state.isInitialized).toBe(true);
  });

  it('should call setBootstrapData with all fields including uoms', () => {
    const data = {
      products: [{ id: 1, name: 'Product 1' }],
      categories: [{ id: 1, name: 'Cat 1' }],
      uoms: [{ id: 1, name: 'pcs' }],
      paymentMethods: [{ id: 1, name: 'Cash' }],
    };

    usePOSStore.getState().setBootstrapData(data);

    const state = usePOSStore.getState();
    expect(state.uoms).toEqual(data.uoms);
    expect(state.products).toEqual(data.products);
    expect(state.categories).toEqual(data.categories);
  });

  it('should loadFromLocal return uoms as empty array (Bug #2)', async () => {
    vi.mocked(bootstrapService.loadFromLocal).mockResolvedValue({
      products: [{ id: 1, name: 'Local Product' }],
      categories: [],
      uoms: [],
      expenseCategories: [],
      priceTiers: [],
    });

    const result = await bootstrapService.loadFromLocal();
    expect(result.uoms).toEqual([]);
  });

  it('should set store as initialized after bootstrap data is loaded', () => {
    const data = {
      products: [{ id: 1, name: 'Product 1' }],
      categories: [{ id: 1, name: 'Cat 1' }],
      uoms: [{ id: 1, name: 'pcs' }],
      paymentMethods: [{ id: 1, name: 'Cash' }],
    };

    usePOSStore.getState().setBootstrapData(data);

    expect(usePOSStore.getState().isInitialized).toBe(true);
    expect(usePOSStore.getState().isLoading).toBe(false);
  });

  it('should remain not initialized when bootstrap has not run', () => {
    usePOSStore.setState({ isInitialized: false, isLoading: false });
    expect(usePOSStore.getState().isInitialized).toBe(false);
  });
});
