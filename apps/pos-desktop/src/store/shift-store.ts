import { create } from 'zustand';
import { Shift } from '@petshop/shared';
import { apiClient } from '@/lib/api-client';

interface ShiftState {
  activeShift: Shift | null;
  activeCashierId: number | null;
  isShiftLoading: boolean;
  setActiveShift: (shift: Shift | null) => void;
  setActiveCashier: (cashierId: number | null) => void;
  setShiftLoading: (loading: boolean) => void;
  clearShift: () => void;
  checkActiveShift: () => Promise<void>;
}

export const useShiftStore = create<ShiftState>((set) => ({
  activeShift: null,
  activeCashierId: null,
  isShiftLoading: false,
  setActiveShift: (shift) => set({ activeShift: shift }),
  setActiveCashier: (cashierId) => set({ activeCashierId: cashierId }),
  setShiftLoading: (loading) => set({ isShiftLoading: loading }),
  clearShift: () => set({ activeShift: null, activeCashierId: null }),
  checkActiveShift: async () => {
    set({ isShiftLoading: true });
    try {
      const shift = await apiClient('/pos/shifts?branchId=1');
      set({ activeShift: shift ?? null });
    } catch {
      set({ activeShift: null });
    } finally {
      set({ isShiftLoading: false });
    }
  },
}));
