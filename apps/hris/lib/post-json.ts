/**
 * Kirim mutasi dengan token CSRF (pola L1d) dari browser. Dipakai modul baru sejak L2f-1; modul lama masih
 * memakai salinannya sendiri (`modules/*\/ui/api.ts`). `body` FormData dikirim apa adanya (unggah berkas).
 */
export async function postJson(path: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    const csrf = await (await fetch('/api/auth/csrf', { cache: 'no-store' })).json();
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await fetch(path, {
      method: 'POST',
      headers: isForm ? { 'x-csrf-token': csrf.token } : { 'Content-Type': 'application/json', 'x-csrf-token': csrf.token },
      body: isForm ? body : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? 'Permintaan gagal.' };
  } catch {
    return { ok: false, error: 'Terjadi kesalahan jaringan, silakan coba lagi.' };
  }
}
