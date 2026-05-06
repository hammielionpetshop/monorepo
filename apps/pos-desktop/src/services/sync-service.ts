import { getDb } from '@/lib/db';
import { useNetworkStore } from '@/store/network-store';
import { useShiftStore } from '@/store/shift-store';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';

const RETRY_DELAYS = [60_000, 120_000, 300_000, 900_000]; // 1m, 2m, 5m, 15m
const MAX_RETRIES = 10;

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let onlineListener: (() => void) | null = null;

/**
 * Mengambil branchId aktif dengan fallback ke data user login.
 * Fallback diperlukan agar heartbeat tetap terkirim saat reconnect
 * meskipun shift store belum di-hydrate (AC1).
 */
function getActiveBranchId(): number | null {
  return (
    useShiftStore.getState().activeShift?.branchId ??
    useAuthStore.getState().user?.branchId ??
    null
  );
}

function getDeviceId(): string {
  let id = localStorage.getItem('hml_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('hml_device_id', id);
  }
  return id;
}

export const syncService = {
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === 'healthy';
    } catch {
      return false;
    }
  },

  async heartbeat(branchId: number): Promise<void> {
    try {
      await apiClient('/pos/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          deviceId: getDeviceId(),
        }),
      });
    } catch (err) {
      console.warn('[Sync] Heartbeat failed:', err);
      // fire-and-forget — jangan blokir operasi lain
    }
  },

  async flush(): Promise<void> {
    const { isSyncing, setSyncing, setPendingCount, setLastSyncAt } = useNetworkStore.getState();

    // Fix: Prevent parallel sync executions
    if (isSyncing) return;

    let pending = [];
    try {
      const db = await getDb();
      const allPending = await db.pendingOperations.toArray();
      pending = allPending.filter(op => op.retryCount < MAX_RETRIES);
    } catch (dbError) {
      console.error('[Sync] Database access error:', dbError);
      scheduleRetry();
      return;
    }

    if (pending.length === 0) {
      setPendingCount(0);
      retryAttempt = 0; 
      return;
    }

    const isConnected = await syncService.checkConnectivity();
    if (!isConnected) {
      scheduleRetry();
      return;
    }

    setSyncing(true);
    try {
      const result = await apiClient('/pos/sync/batch', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: getDeviceId(),
          transactions: pending.map((op) => ({ id: op.id, payload: op.payload })),
        }),
      });

      const db = await getDb();
      // Hapus yang berhasil
      if (result.synced?.length > 0) {
        await db.pendingOperations.where('id').anyOf(result.synced).delete();
      }

      // Update yang gagal — increment retryCount dan catat lastError
      for (const failed of result.failed ?? []) {
        const op = pending.find((p) => p.id === failed.id);
        if (op) {
          await db.pendingOperations.where('id').equals(op.id).modify({
            retryCount: op.retryCount + 1,
            lastError: failed.reason,
          });
        }
      }

      const remainingCount = await db.pendingOperations.count();
      setPendingCount(remainingCount);
      setLastSyncAt(Date.now());
      retryAttempt = 0; // reset pada sukses parsial atau penuh
    } catch (error) {
      scheduleRetry();
      throw new Error('Gagal melakukan sinkronisasi antrean.', { cause: error });
    } finally {
      setSyncing(false); // WAJIB: tidak pernah stuck
    }
  },

  startAutoSync(): void {
    if (onlineListener) return; // guard: tidak register dua kali

    onlineListener = () => {
      retryAttempt = 0;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      
      const branchId = getActiveBranchId();
      if (branchId != null) {
        syncService.heartbeat(branchId).catch((err) => console.error('[Sync] Heartbeat failed:', err));
      }
      
      syncService.flush().catch((err) => console.error('[Sync] Auto-sync trigger failed:', err));
    };

    window.addEventListener('online', onlineListener);

    // Cek segera saat startup jika sudah online
    if (navigator.onLine) {
      const branchId = getActiveBranchId();
      if (branchId != null) {
        syncService.heartbeat(branchId).catch((err) => console.error('[Sync] Heartbeat failed:', err));
      }
      syncService.flush().catch((err) => console.error('[Sync] Startup sync failed:', err));
    }
  },

  stopAutoSync(): void {
    if (onlineListener) {
      window.removeEventListener('online', onlineListener);
      onlineListener = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryAttempt = 0;
  },
};

function scheduleRetry(): void {
  const delay = RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)];
  retryAttempt++;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    syncService.flush().catch((err) => console.error('[Sync] Retry sync failed:', err));
  }, delay);
}
