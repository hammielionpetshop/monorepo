/**
 * Klien WAHA (gateway WhatsApp) untuk backoffice.
 *
 * WAHA sengaja tidak dapat dijangkau dari internet — ia hanya hidup di jaringan
 * internal server. Semua panggilan karena itu harus lewat sisi server; kunci API-nya
 * tidak boleh pernah sampai ke browser, karena kunci itu memberi akses penuh ke
 * WhatsApp toko (membaca seluruh percakapan, mengirim atas nama toko).
 */

export type WahaStatus =
  | 'STOPPED'
  | 'STARTING'
  | 'SCAN_QR_CODE'
  | 'WORKING'
  | 'FAILED'
  | 'UNKNOWN';

export interface WahaSession {
  status: WahaStatus;
  /** Nomor & nama akun yang tertaut, null bila belum tertaut. */
  me: { id?: string; pushName?: string } | null;
}

function baseUrl(): string {
  const url = process.env.WAHA_BASE_URL;
  if (!url) throw new Error('WAHA_BASE_URL belum dikonfigurasi');
  return url.replace(/\/$/, '');
}

export function sessionName(): string {
  return process.env.WAHA_SESSION || 'default';
}

function headers(): Record<string, string> {
  const key = process.env.WAHA_API_KEY;
  return {
    'Content-Type': 'application/json',
    ...(key ? { 'X-Api-Key': key } : {}),
  };
}

/** Batas waktu supaya halaman tidak menggantung saat WAHA tidak merespons. */
async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string>) },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
}

export async function getSession(): Promise<WahaSession> {
  const res = await call(`/api/sessions/${sessionName()}`);

  // 404 = sesi belum pernah dibuat. Itu keadaan wajar pada pemasangan baru,
  // bukan kegagalan — perlakukan sebagai STOPPED supaya UI menawarkan "Mulai".
  if (res.status === 404) return { status: 'STOPPED', me: null };
  if (!res.ok) throw new Error(`WAHA menjawab ${res.status}`);

  const data = await res.json();
  return { status: (data?.status as WahaStatus) ?? 'UNKNOWN', me: data?.me ?? null };
}

/** Ambil QR sebagai PNG mentah untuk diteruskan ke browser. */
export async function getQrPng(): Promise<ArrayBuffer> {
  const res = await call(`/api/${sessionName()}/auth/qr?format=image`, {
    headers: { Accept: 'image/png' },
  });
  if (!res.ok) throw new Error(`QR tidak tersedia (WAHA menjawab ${res.status})`);
  return res.arrayBuffer();
}

/** Buat sesi bila belum ada, lalu jalankan. Aman dipanggil berulang. */
export async function startSession(): Promise<void> {
  const name = sessionName();
  const existing = await call(`/api/sessions/${name}`);

  if (existing.status === 404) {
    const created = await call('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, start: true }),
    });
    if (!created.ok) throw new Error(`Gagal membuat sesi (WAHA menjawab ${created.status})`);
    return;
  }

  const started = await call(`/api/sessions/${name}/start`, { method: 'POST', body: '{}' });
  if (!started.ok) throw new Error(`Gagal memulai sesi (WAHA menjawab ${started.status})`);
}

/**
 * Putuskan tautan WhatsApp. Setelah ini WAHA meminta QR baru, dan OTP tidak akan
 * terkirim sampai ada perangkat yang ditautkan lagi.
 */
export async function logoutSession(): Promise<void> {
  const res = await call(`/api/sessions/${sessionName()}/logout`, { method: 'POST', body: '{}' });
  if (!res.ok) throw new Error(`Gagal memutus tautan (WAHA menjawab ${res.status})`);
}

/** Nyalakan ulang sesi tanpa memutus tautan — untuk memulihkan sesi yang macet. */
export async function restartSession(): Promise<void> {
  const res = await call(`/api/sessions/${sessionName()}/restart`, { method: 'POST', body: '{}' });
  if (!res.ok) throw new Error(`Gagal menyalakan ulang sesi (WAHA menjawab ${res.status})`);
}
