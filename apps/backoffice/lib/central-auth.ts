import { cookies } from 'next/headers';
import postgres from 'postgres';
import {
  assertTrustedMutation,
  issueCsrfToken,
  sessionCookieOptions,
  type BackofficePolicy,
} from '@petshop/auth';

/** Umur akses backoffice pada mode central: 30 hari (keputusan owner 2026-10-31). */
export const BACKOFFICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthMode = 'legacy' | 'central';

export function getAuthMode(): AuthMode {
  const mode = process.env.BO_AUTH_MODE ?? 'legacy';
  if (mode !== 'legacy' && mode !== 'central') {
    throw new Error('BO_AUTH_MODE harus "legacy" atau "central".');
  }
  return mode;
}

type CentralConfig = {
  databaseUrl: string;
  environment: 'local' | 'staging' | 'production';
  domain?: string;
  csrfSecret: string;
  trustedOrigins: string[];
};

let cachedConfig: CentralConfig | undefined;

/** Konfigurasi mode central. Gagal keras bila tidak lengkap — tidak ada nilai tebakan. */
export function getCentralConfig(): CentralConfig {
  if (cachedConfig) return cachedConfig;
  const databaseUrl = process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL;
  const environment = process.env.AUTH_COOKIE_ENV;
  const csrfSecret = process.env.AUTH_CSRF_SECRET;
  const trustedOrigins = (process.env.AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const domain = process.env.AUTH_COOKIE_DOMAIN || undefined;

  const problems: string[] = [];
  if (!databaseUrl) problems.push('AUTH_DATABASE_URL (atau DATABASE_URL)');
  if (environment !== 'local' && environment !== 'staging' && environment !== 'production') {
    problems.push('AUTH_COOKIE_ENV (local|staging|production)');
  }
  if (!csrfSecret || csrfSecret.length < 32) problems.push('AUTH_CSRF_SECRET (minimal 32 karakter)');
  if (!trustedOrigins.length) problems.push('AUTH_TRUSTED_ORIGINS');
  if (environment && environment !== 'local' && !domain) problems.push('AUTH_COOKIE_DOMAIN');
  if (problems.length) {
    throw new Error(`Mode auth central belum dikonfigurasi lengkap: ${problems.join(', ')}.`);
  }

  // sessionCookieOptions memvalidasi format domain; panggil sekali agar gagal saat boot.
  sessionCookieOptions({ environment: environment as CentralConfig['environment'], domain });
  cachedConfig = {
    databaseUrl: databaseUrl as string,
    environment: environment as CentralConfig['environment'],
    domain,
    csrfSecret: csrfSecret as string,
    trustedOrigins,
  };
  return cachedConfig;
}

let sqlClient: postgres.Sql | undefined;

/** Koneksi ke schema auth. Dibuat malas: mode legacy tidak pernah menyentuhnya. */
export function getAuthSql(): postgres.Sql {
  sqlClient ??= postgres(getCentralConfig().databaseUrl, { max: 5 });
  return sqlClient;
}

export function backofficePolicy(role: string): BackofficePolicy {
  return { role, ttlMs: BACKOFFICE_TTL_MS };
}

export function centralCookie() {
  return sessionCookieOptions(getCentralConfig());
}

function csrfCookieName(): string {
  return `${centralCookie().name}_csrf`;
}

/** Token sesi pusat dari cookie permintaan ini, atau undefined. */
export async function readCentralToken(): Promise<string | undefined> {
  return (await cookies()).get(centralCookie().name)?.value;
}

export function setCentralCookie(response: { cookies: { set: (name: string, value: string, options: object) => unknown } }, token: string) {
  const { name, ...options } = centralCookie();
  response.cookies.set(name, token, { ...options, maxAge: BACKOFFICE_TTL_MS / 1000 });
}

export function clearCentralCookie(response: { cookies: { set: (name: string, value: string, options: object) => unknown } }) {
  const { name, ...options } = centralCookie();
  response.cookies.set(name, '', { ...options, maxAge: 0 });
}

/**
 * Terbitkan token CSRF. Sebelum login konteksnya nonce acak di cookie HttpOnly; sesudah login
 * konteksnya token sesi pusat. Mengembalikan token dan, bila perlu, nonce baru untuk di-set.
 */
export async function issueCsrf(): Promise<{ token: string; nonce?: string }> {
  const { csrfSecret } = getCentralConfig();
  const sessionToken = await readCentralToken();
  if (sessionToken) return { token: issueCsrfToken(csrfSecret, sessionToken) };
  const jar = await cookies();
  const existing = jar.get(csrfCookieName())?.value;
  const nonce = existing ?? crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  return { token: issueCsrfToken(csrfSecret, nonce), nonce: existing ? undefined : nonce };
}

export function setCsrfNonceCookie(response: { cookies: { set: (name: string, value: string, options: object) => unknown } }, nonce: string) {
  const { name: _name, ...options } = centralCookie();
  response.cookies.set(csrfCookieName(), nonce, { ...options, maxAge: 60 * 60 });
}

/**
 * Guard Origin + CSRF untuk mutasi yang menyentuh sesi/kredensial. Memanggil sebelum layanan DB.
 * Mengembalikan pesan galat bila ditolak, null bila lolos.
 */
export async function checkMutation(req: Request): Promise<string | null> {
  const { csrfSecret, trustedOrigins } = getCentralConfig();
  const sessionToken = await readCentralToken();
  const nonce = (await cookies()).get(csrfCookieName())?.value;
  const context = sessionToken ?? nonce ?? '';
  try {
    assertTrustedMutation({
      method: req.method,
      origin: req.headers.get('origin'),
      trustedOrigins,
      csrfToken: req.headers.get('x-csrf-token'),
      csrfSecret,
      context,
    });
    return null;
  } catch {
    return 'Permintaan ditolak: asal atau perlindungan permintaan tidak valid.';
  }
}
