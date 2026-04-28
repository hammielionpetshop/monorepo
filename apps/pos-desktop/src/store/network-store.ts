import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  setOnline: (v: boolean) => void;
  setSyncing: (v: boolean) => void;
  setPendingCount: (n: number) => void;
  setLastSyncAt: (n: number) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (n) => set({ pendingCount: n }),
  setLastSyncAt: (n) => set({ lastSyncAt: n }),
}));
