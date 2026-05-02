import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncService } from './sync-service';
import { getDb } from '@/lib/db';
import { useNetworkStore } from '@/store/network-store';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}));

const mockSetSyncing = vi.fn();
const mockSetPendingCount = vi.fn();
const mockSetLastSyncAt = vi.fn();

// Mock network store
vi.mock('@/store/network-store', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      setSyncing: mockSetSyncing,
      setPendingCount: mockSetPendingCount,
      setLastSyncAt: mockSetLastSyncAt,
    })),
  },
}));

// Mock shift store
vi.mock('@/store/shift-store', () => ({
  useShiftStore: {
    getState: vi.fn(() => ({
      activeShift: { branchId: 1 },
    })),
  },
}));

describe('syncService', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockDb = {
      pendingOperations: {
        toArray: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        where: vi.fn().mockReturnThis(),
        anyOf: vi.fn().mockReturnThis(),
        delete: vi.fn().mockResolvedValue(undefined),
        equals: vi.fn().mockReturnThis(),
        modify: vi.fn().mockResolvedValue(undefined),
        below: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
      },
    };
    (getDb as any).mockResolvedValue(mockDb);

    // Mock fetch for checkConnectivity
    global.fetch = vi.fn().mockResolvedValue({ 
      ok: true,
      json: () => Promise.resolve({ status: 'healthy' })
    });
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  describe('checkConnectivity', () => {
    it('should return true if /api/health is ok', async () => {
      const result = await syncService.checkConnectivity();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/health', expect.any(Object));
    });

    it('should return false if /api/health fails', async () => {
      (fetch as any).mockResolvedValue({ ok: false });
      const result = await syncService.checkConnectivity();
      expect(result).toBe(false);
    });

    it('should return false if fetch throws', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));
      const result = await syncService.checkConnectivity();
      expect(result).toBe(false);
    });
  });

  describe('heartbeat', () => {
    it('should call heartbeat endpoint with branchId and deviceId', async () => {
      await syncService.heartbeat(1);
      expect(apiClient).toHaveBeenCalledWith('/pos/heartbeat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"branchId":1'),
      }));
    });

    it('should not throw if heartbeat fails', async () => {
      (apiClient as any).mockRejectedValue(new Error('API Error'));
      await expect(syncService.heartbeat(1)).resolves.not.toThrow();
    });
  });

  describe('flush', () => {
    it('should return early if no pending operations', async () => {
      await syncService.flush();
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('should sync all pending operations successfully', async () => {
      const pending = [
        { id: '1', payload: { data: 'test1' }, retryCount: 0 },
        { id: '2', payload: { data: 'test2' }, retryCount: 0 },
      ];
      mockDb.pendingOperations.toArray.mockResolvedValue(pending);
      mockDb.pendingOperations.count.mockResolvedValue(0);

      (apiClient as any).mockResolvedValue({
        synced: ['1', '2'],
        failed: [],
      });

      await syncService.flush();

      expect(apiClient).toHaveBeenCalledWith('/pos/sync/batch', expect.objectContaining({
        method: 'POST',
      }));
      expect(mockDb.pendingOperations.where).toHaveBeenCalledWith('id');
      expect(mockDb.pendingOperations.anyOf).toHaveBeenCalledWith(['1', '2']);
      expect(mockDb.pendingOperations.delete).toHaveBeenCalled();
      
      expect(mockSetPendingCount).toHaveBeenCalledWith(0);
      expect(mockSetLastSyncAt).toHaveBeenCalled();
    });

    it('should handle partial failures', async () => {
      const pending = [
        { id: '1', payload: { data: 'test1' }, retryCount: 0 },
        { id: '2', payload: { data: 'test2' }, retryCount: 0 },
      ];
      mockDb.pendingOperations.toArray.mockResolvedValue(pending);
      mockDb.pendingOperations.count.mockResolvedValue(1);

      (apiClient as any).mockResolvedValue({
        synced: ['1'],
        failed: [{ id: '2', reason: 'Error message' }],
      });

      await syncService.flush();

      // Check delete for synced
      expect(mockDb.pendingOperations.anyOf).toHaveBeenCalledWith(['1']);
      expect(mockDb.pendingOperations.delete).toHaveBeenCalled();

      // Check update for failed
      expect(mockDb.pendingOperations.equals).toHaveBeenCalledWith('2');
      expect(mockDb.pendingOperations.modify).toHaveBeenCalledWith({
        retryCount: 1,
        lastError: 'Error message',
      });

      expect(mockSetPendingCount).toHaveBeenCalledWith(1);
    });

    it('should return if not connected', async () => {
      mockDb.pendingOperations.toArray.mockResolvedValue([{ id: '1' }]);
      (fetch as any).mockResolvedValue({ ok: false });

      await syncService.flush();

      expect(apiClient).not.toHaveBeenCalled();
    });
  });
});
