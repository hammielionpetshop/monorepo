import { readSessionToken } from '@/lib/auth';
import type { KasirAccessInput } from '../rules/accounts';

export type KasirAccessView = {
  userId: number;
  username: string | null;
  staffNumber: string | null;
  roleName: string;
  branchId: number;
  branchName: string;
  assignedBranches: { id: number; name: string }[];
  isActive: boolean;
};

export type KasirOptions = { roles: string[]; branches: { id: number; name: string }[] };

type Called<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Pintu internal backoffice (spec L2d §4) lewat jaringan internal. Kunci layanan membuktikan pemanggilnya
 * HRIS; token sesi pelaku dikirim supaya backoffice memeriksa sendiri bahwa pelakunya Owner/GM.
 */
async function callBackoffice<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Called<T>> {
  const base = process.env.BACKOFFICE_INTERNAL_URL;
  const key = process.env.HRIS_INTERNAL_KEY;
  if (!base || !key) {
    return { ok: false, error: 'Akses kasir belum dikonfigurasi di server HRIS (BACKOFFICE_INTERNAL_URL, HRIS_INTERNAL_KEY).' };
  }
  const token = await readSessionToken();
  if (!token) return { ok: false, error: 'Sesi tidak valid, silakan login kembali.' };
  try {
    const res = await fetch(new URL(path, base), {
      method,
      headers: { 'content-type': 'application/json', 'x-internal-key': key, 'x-actor-session': token },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 && path.startsWith('/api/internal')) {
      const text = await res.text();
      if (!text) return { ok: false, error: 'Pintu akses kasir tidak tersedia (backoffice belum mode akun pusat atau kunci layanan tidak cocok).' };
      return { ok: false, error: safeError(text) };
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.error ?? `Backoffice menolak permintaan (${res.status}).` };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Backoffice tidak dapat dihubungi. Coba lagi sebentar lagi.' };
  }
}

function safeError(text: string): string {
  try {
    return JSON.parse(text).error ?? 'Data tidak ditemukan di backoffice.';
  } catch {
    return 'Data tidak ditemukan di backoffice.';
  }
}

export async function fetchKasirAccess(accountIds: number[]) {
  const ids = accountIds.join(',');
  return callBackoffice<{ access: Record<string, KasirAccessView>; roles: string[]; branches: KasirOptions['branches'] }>(
    'GET', `/api/internal/hris/backoffice-access?accountIds=${ids}`,
  );
}

export async function saveKasirAccess(input: KasirAccessInput & {
  accountId: number; employeeName: string; employeeCode: string; active: boolean;
}) {
  return callBackoffice<{ userId: number | null; created: boolean }>('POST', '/api/internal/hris/backoffice-access', input);
}
