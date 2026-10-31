/**
 * Nama cookie sesi pusat. Berkas terpisah tanpa impor berat karena `middleware.ts` (Edge)
 * ikut memakainya; rumusnya harus sama dengan `sessionCookieOptions` di @petshop/auth.
 */
export function centralCookieName(): string | null {
  const environment = process.env.AUTH_COOKIE_ENV;
  return environment ? `hml_${environment}_session` : null;
}

export function isCentralMode(): boolean {
  return process.env.BO_AUTH_MODE === 'central';
}
