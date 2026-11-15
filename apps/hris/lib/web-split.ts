/**
 * Web Logistik di alamat sendiri, dijalankan aplikasi HRIS yang sama (spec F2-7b §3). Alamat permintaan menentukan
 * isi: `logistik.*` hanya Logistik + Trip Saya, `hris.*` tanpa keduanya. Tanpa `LOGISTICS_PUBLIC_URL` tidak ada
 * pemisahan (HRIS tetap memuat Logistik seperti sebelumnya).
 */
export type HrisWeb = 'hris' | 'logistik';

export type WebOrigins = { hris: string | null; logistics: string | null };

function cleanOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function webOriginsFromEnv(env: Record<string, string | undefined> = process.env): WebOrigins {
  return { hris: cleanOrigin(env.HRIS_PUBLIC_URL), logistics: cleanOrigin(env.LOGISTICS_PUBLIC_URL) };
}

/** Web yang sedang dibuka menurut header Host (Caddy meneruskan Host asli). */
export function webForHost(host: string | null | undefined, origins: WebOrigins): HrisWeb {
  if (!origins.logistics || !host) return 'hris';
  return new URL(origins.logistics).host === host.toLowerCase() ? 'logistik' : 'hris';
}

function under(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Layar milik web Logistik (spec F2-7b §4). */
export function isLogisticsPath(path: string): boolean {
  return under(path, '/logistics') || under(path, '/my-trips');
}

/** Layar yang ada di kedua web: Beranda (isinya berbeda), Pemberitahuan, Profil. */
export function isSharedPath(path: string): boolean {
  return path === '/' || under(path, '/notifications') || under(path, '/profile');
}

/**
 * Alamat tujuan bila layar dibuka di web yang salah: `/logistics/...` dan `/my-trips` di HRIS → Logistik, layar HRIS di
 * Logistik → HRIS. Null = tetap di sini (termasuk bila pemisahan belum diatur).
 */
export function redirectTarget(web: HrisWeb, path: string, search: string, origins: WebOrigins): string | null {
  if (!origins.logistics) return null;
  if (web === 'hris' && isLogisticsPath(path)) return `${origins.logistics}${path}${search}`;
  if (web === 'logistik' && !isLogisticsPath(path) && !isSharedPath(path) && origins.hris) return `${origins.hris}${path}${search}`;
  return null;
}
