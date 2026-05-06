import { describe, it, expect } from 'vitest';
import { usePOSStore } from './pos-store';

describe('usePOSStore', () => {
  it('should initialize with default empty values', () => {
    const state = usePOSStore.getState();
    expect(state.products).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.conversions).toEqual([]);
    expect(state.prices).toEqual([]);
    expect(state.customers).toEqual([]);
    expect(state.uoms).toEqual([]);
    expect(state.paymentMethods).toEqual([]);
    expect(state.expenseCategories).toEqual([]);
    expect(state.priceTiers).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(false);
  });

  it('should set bootstrap data with all fields', () => {
    const mockData = {
      products: [{ id: 1, name: 'Product 1' }],
      categories: [{ id: 1, name: 'Category 1' }],
      uoms: [{ id: 1, name: 'pcs' }],
      paymentMethods: [{ id: 1, name: 'Cash' }],
    };

    usePOSStore.getState().setBootstrapData(mockData);

    const state = usePOSStore.getState();
    expect(state.products).toEqual(mockData.products);
    expect(state.categories).toEqual(mockData.categories);
    expect(state.uoms).toEqual(mockData.uoms);
    expect(state.paymentMethods).toEqual(mockData.paymentMethods);
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('should handle uoms as undefined and default to empty array (Bug #2)', () => {
    const mockData = {
      products: [{ id: 1, name: 'Product 1' }],
    };

    usePOSStore.getState().setBootstrapData(mockData);

    const state = usePOSStore.getState();
    expect(state.uoms).toEqual([]);
    expect(state.products).toEqual(mockData.products);
  });

  it('should handle all missing fields gracefully', () => {
    usePOSStore.getState().setBootstrapData({});

    const state = usePOSStore.getState();
    expect(state.products).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.conversions).toEqual([]);
    expect(state.prices).toEqual([]);
    expect(state.customers).toEqual([]);
    expect(state.uoms).toEqual([]);
    expect(state.paymentMethods).toEqual([]);
    expect(state.expenseCategories).toEqual([]);
    expect(state.priceTiers).toEqual([]);
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('should manage loading state', () => {
    usePOSStore.getState().setLoading(true);
    expect(usePOSStore.getState().isLoading).toBe(true);

    usePOSStore.getState().setLoading(false);
    expect(usePOSStore.getState().isLoading).toBe(false);
  });

  it('should manage pending action', () => {
    const action = { type: 'PRICE_OVERRIDE' as const, productId: 1, uomId: 1 };
    usePOSStore.getState().setPendingAction(action);
    expect(usePOSStore.getState().pendingAction).toEqual(action);

    usePOSStore.getState().setPendingAction(null);
    expect(usePOSStore.getState().pendingAction).toBeNull();
  });

  it('should manage override item', () => {
    const item = { productId: 1, uomId: 1 };
    usePOSStore.getState().setOverrideItem(item);
    expect(usePOSStore.getState().activeOverrideItem).toEqual(item);

    usePOSStore.getState().setOverrideItem(null);
    expect(usePOSStore.getState().activeOverrideItem).toBeNull();
  });

  it('should manage pin challenge dialog', () => {
    usePOSStore.getState().setShowPinChallenge(true);
    expect(usePOSStore.getState().showPinChallenge).toBe(true);

    usePOSStore.getState().setShowPinChallenge(false);
    expect(usePOSStore.getState().showPinChallenge).toBe(false);
  });

  it('should manage override dialog', () => {
    usePOSStore.getState().setShowOverrideDialog(true);
    expect(usePOSStore.getState().showOverrideDialog).toBe(true);

    usePOSStore.getState().setShowOverrideDialog(false);
    expect(usePOSStore.getState().showOverrideDialog).toBe(false);
  });

  it('should manage open bills drawer', () => {
    usePOSStore.getState().setShowOpenBillsDrawer(true);
    expect(usePOSStore.getState().showOpenBillsDrawer).toBe(true);

    usePOSStore.getState().setShowOpenBillsDrawer(false);
    expect(usePOSStore.getState().showOpenBillsDrawer).toBe(false);
  });
});
