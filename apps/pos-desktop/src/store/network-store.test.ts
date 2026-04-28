import { describe, it, expect } from 'vitest';
import { useNetworkStore } from './network-store';

describe('useNetworkStore', () => {
  it('should initialize with navigator.onLine', () => {
    const state = useNetworkStore.getState();
    expect(state.isOnline).toBe(navigator.onLine);
    expect(state.isSyncing).toBe(false);
    expect(state.pendingCount).toBe(0);
    expect(state.lastSyncAt).toBe(null);
  });

  it('should update online status', () => {
    useNetworkStore.getState().setOnline(false);
    expect(useNetworkStore.getState().isOnline).toBe(false);
    
    useNetworkStore.getState().setOnline(true);
    expect(useNetworkStore.getState().isOnline).toBe(true);
  });

  it('should update syncing status', () => {
    useNetworkStore.getState().setSyncing(true);
    expect(useNetworkStore.getState().isSyncing).toBe(true);
    
    useNetworkStore.getState().setSyncing(false);
    expect(useNetworkStore.getState().isSyncing).toBe(false);
  });

  it('should update pending count', () => {
    useNetworkStore.getState().setPendingCount(5);
    expect(useNetworkStore.getState().pendingCount).toBe(5);
  });
});
