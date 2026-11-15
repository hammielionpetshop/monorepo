const SHIFT_CACHE_KEY = 'hammielion_cached_shift';

export interface CachedShift {
  id: number;
  branchId: number;
  openedAt: string;
  closedAt: string | null;
  assignedCashiers: number[];
  joinedCashierIds: number[];
}

export function cacheShift(shift: unknown): void {
  try {
    localStorage.setItem(SHIFT_CACHE_KEY, JSON.stringify(shift));
  } catch {
    // QuotaExceeded atau error localStorage lainnya — gagal diam-diam
  }
}

export function clearCachedShift(): void {
  localStorage.removeItem(SHIFT_CACHE_KEY);
}

export function getCachedShift(): CachedShift | null {
  const raw = localStorage.getItem(SHIFT_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Hanya restore shift yang masih terbuka (closedAt === null)
    if (
      typeof parsed.id === 'number' &&
      parsed.closedAt === null
    ) {
      return {
        id: parsed.id,
        branchId: typeof parsed.branchId === 'number' ? parsed.branchId : 1,
        openedAt: typeof parsed.openedAt === 'string' ? parsed.openedAt : '',
        closedAt: null,
        assignedCashiers: Array.isArray(parsed.assignedCashiers)
          ? parsed.assignedCashiers.filter((v): v is number => typeof v === 'number')
          : [],
        joinedCashierIds: Array.isArray(parsed.joinedCashierIds)
          ? parsed.joinedCashierIds.filter((v): v is number => typeof v === 'number')
          : [],
      };
    }

    // Shift sudah ditutup atau shape tidak valid — hapus cache
    localStorage.removeItem(SHIFT_CACHE_KEY);
    return null;
  } catch {
    // Cache corrupted — hapus agar tidak terus-menerus gagal
    localStorage.removeItem(SHIFT_CACHE_KEY);
    return null;
  }
}
