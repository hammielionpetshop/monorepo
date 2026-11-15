'use client';

/**
 * Kirim mutasi JSON dengan token CSRF (pola L1d, sama dengan modul akses). Disalin, bukan diimpor dari
 * `@/modules/access`, karena pintu modul itu memuat kode server yang tidak boleh masuk ke browser.
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
