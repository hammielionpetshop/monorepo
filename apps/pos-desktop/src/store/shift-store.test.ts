import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Shift } from '@petshop/shared';
import { useShiftStore } from './shift-store';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}));

const MOCK_SHIFT: Shift = {
  id: 1,
  branchId: 1,
  openedAt: '2026-05-01T08:00:00Z',
  closedAt: null,
  assignedCashiers: [1, 2],
  joinedCashierIds: [1],
} as unknown as Shift;

describe('useShiftStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useShiftStore.setState({
      activeShift: null,
      activeCashierId: null,
      isShiftLoading: false,
    });
  });

  it('should initialize with default values', () => {
    const state = useShiftStore.getState();
    expect(state.activeShift).toBeNull();
    expect(state.activeCashierId).toBeNull();
    expect(state.isShiftLoading).toBe(false);
  });

  it('should set active shift', () => {
    useShiftStore.getState().setActiveShift(MOCK_SHIFT);
    expect(useShiftStore.getState().activeShift).toEqual(MOCK_SHIFT);
  });

  it('should set active cashier', () => {
    useShiftStore.getState().setActiveCashier(1);
    expect(useShiftStore.getState().activeCashierId).toBe(1);
  });

  it('should set shift loading', () => {
    useShiftStore.getState().setShiftLoading(true);
    expect(useShiftStore.getState().isShiftLoading).toBe(true);
  });

  it('should clear shift state', () => {
    useShiftStore.setState({
      activeShift: MOCK_SHIFT,
      activeCashierId: 1,
    });
    useShiftStore.getState().clearShift();
    expect(useShiftStore.getState().activeShift).toBeNull();
    expect(useShiftStore.getState().activeCashierId).toBeNull();
  });

  describe('checkActiveShift', () => {
    it('should cache shift to localStorage on success (Bug #1)', async () => {
      vi.mocked(apiClient).mockResolvedValue(MOCK_SHIFT);

      await useShiftStore.getState().checkActiveShift();

      const cached = localStorage.getItem('hammielion_cached_shift');
      expect(cached).toBe(JSON.stringify(MOCK_SHIFT));
      expect(useShiftStore.getState().activeShift).toEqual(MOCK_SHIFT);
      expect(useShiftStore.getState().isShiftLoading).toBe(false);
    });

    it('should remove cached shift when no active shift from server', async () => {
      localStorage.setItem('hammielion_cached_shift', JSON.stringify(MOCK_SHIFT));
      vi.mocked(apiClient).mockResolvedValue(null);

      await useShiftStore.getState().checkActiveShift();

      expect(localStorage.getItem('hammielion_cached_shift')).toBeNull();
      expect(useShiftStore.getState().activeShift).toBeNull();
    });

    it('should restore shift from localStorage on network failure (Bug #1)', async () => {
      localStorage.setItem('hammielion_cached_shift', JSON.stringify(MOCK_SHIFT));
      vi.mocked(apiClient).mockRejectedValue(new Error('Network error'));

      await useShiftStore.getState().checkActiveShift();

      expect(useShiftStore.getState().activeShift).toEqual(MOCK_SHIFT);
      expect(useShiftStore.getState().isShiftLoading).toBe(false);
    });

    it('should set null shift when no cache available on failure', async () => {
      vi.mocked(apiClient).mockRejectedValue(new Error('Network error'));

      await useShiftStore.getState().checkActiveShift();

      expect(useShiftStore.getState().activeShift).toBeNull();
      expect(useShiftStore.getState().isShiftLoading).toBe(false);
    });

    it('should handle corrupted cache gracefully', async () => {
      localStorage.setItem('hammielion_cached_shift', '{invalid json}}');
      vi.mocked(apiClient).mockRejectedValue(new Error('Network error'));

      await useShiftStore.getState().checkActiveShift();

      expect(useShiftStore.getState().activeShift).toBeNull();
      expect(useShiftStore.getState().isShiftLoading).toBe(false);
    });

    it('should set loading state during check', async () => {
      let resolvePromise: ((value: unknown) => void) | undefined;
      vi.mocked(apiClient).mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      const promise = useShiftStore.getState().checkActiveShift();
      expect(useShiftStore.getState().isShiftLoading).toBe(true);

      resolvePromise?.(MOCK_SHIFT);
      await promise;
      expect(useShiftStore.getState().isShiftLoading).toBe(false);
    });

    it('should not restore closed shift from cache', async () => {
      const closedShift = { ...MOCK_SHIFT, closedAt: '2026-05-01T16:00:00Z' };
      localStorage.setItem('hammielion_cached_shift', JSON.stringify(closedShift));
      vi.mocked(apiClient).mockRejectedValue(new Error('Network error'));

      await useShiftStore.getState().checkActiveShift();

      expect(useShiftStore.getState().activeShift).toBeNull();
      expect(localStorage.getItem('hammielion_cached_shift')).toBeNull();
    });

    it('should evict corrupted cache from localStorage', async () => {
      localStorage.setItem('hammielion_cached_shift', '{invalid json}}');
      vi.mocked(apiClient).mockRejectedValue(new Error('Network error'));

      await useShiftStore.getState().checkActiveShift();

      expect(useShiftStore.getState().activeShift).toBeNull();
      expect(localStorage.getItem('hammielion_cached_shift')).toBeNull();
    });
  });
});
