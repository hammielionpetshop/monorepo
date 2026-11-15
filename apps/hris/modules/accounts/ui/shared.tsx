'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { ACCOUNT_STATE_LABELS, accountState } from '../rules/accounts';

/**
 * Kirim mutasi JSON dengan token CSRF. Disalin dari pola modul karyawan, karena pintu modul lain memuat
 * kode server yang tidak boleh masuk ke browser.
 */
export async function postJson(path: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    const csrf = await (await fetch('/api/auth/csrf', { cache: 'no-store' })).json();
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? 'Permintaan gagal.' };
  } catch {
    return { ok: false, error: 'Terjadi kesalahan jaringan, silakan coba lagi.' };
  }
}

/** Simpan → pesan berhasil → muat ulang data server. Galat ditampilkan di layar pemanggil. */
export function useMutation(path: string) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(body: unknown, success: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await postJson(path, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return false;
    }
    toast(success, 'ok');
    router.refresh();
    return true;
  }
  return { busy, error, setError, send };
}

// Tombol ditahan: satu komponen bersama, jedanya dari pengaturan (spec L2e §3.3).
export { HoldButton } from '@/components/ui/hold-button';

const dateTime = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Tanggal + jam WIB, mis. "1 Nov 2026 14.05". */
export function DateTime({ value }: { value: string | null }) {
  return <>{value ? dateTime.format(new Date(value)) : '—'}</>;
}

export function AccountStateBadge({ account }: { account: { isActive: boolean; mustChangePassword: boolean; lockedUntil: string | null } }) {
  const state = accountState(account, new Date());
  const tone = state === 'ACTIVE' ? 'ok' : state === 'DISABLED' ? 'danger' : 'warn';
  return <Badge tone={tone}>{ACCOUNT_STATE_LABELS[state]}</Badge>;
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right">{children ?? '—'}</dd>
    </div>
  );
}
