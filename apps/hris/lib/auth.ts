import { cookies } from 'next/headers';
import postgres from 'postgres';
import {
  HRIS_IDLE_MS, assertTrustedMutation, issueCsrfToken, sessionCookieOptions, validateSession,
} from '@petshop/auth';

type AuthConfig = {
  databaseUrl: string;
  environment: 'local' | 'staging' | 'production';
  domain?: string;
  csrfSecret: string;
  trustedOrigins: string[];
};

let cachedConfig: AuthConfig | undefined;

/** Konfigurasi auth pusat. Gagal keras bila tidak lengkap — tidak ada nilai tebakan. */
export function getAuthConfig(): AuthConfig {
  if (cachedConfig) return cachedConfig;
  const databaseUrl = process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL;
  const environment = process.env.AUTH_COOKIE_ENV;
  const csrfSecret = process.env.AUTH_CSRF_SECRET;
  const trustedOrigins = (process.env.AUTH_TRUSTED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const domain = process.env.AUTH_COOKIE_DOMAIN || undefined;
  const problems: string[] = [];
  if (!databaseUrl) problems.push('AUTH_DATABASE_URL (atau DATABASE_URL)');
  if (environment !== 'local' && environment !== 'staging' && environment !== 'production') {
    problems.push('AUTH_COOKIE_ENV (local|staging|production)');
  }
  if (!csrfSecret || csrfSecret.length < 32) problems.push('AUTH_CSRF_SECRET (minimal 32 karakter)');
  if (!trustedOrigins.length) problems.push('AUTH_TRUSTED_ORIGINS');
  if (environment && environment !== 'local' && !domain) problems.push('AUTH_COOKIE_DOMAIN');
  if (problems.length) throw new Error(`Auth HRIS belum dikonfigurasi lengkap: ${problems.join(', ')}.`);
  sessionCookieOptions({ environment: environment as AuthConfig['environment'], domain });
  cachedConfig = {
    databaseUrl: databaseUrl as string, environment: environment as AuthConfig['environment'],
    domain, csrfSecret: csrfSecret as string, trustedOrigins,
  };
  return cachedConfig;
}

let sqlClient: postgres.Sql | undefined;
export function getAuthSql(): postgres.Sql {
  sqlClient ??= postgres(getAuthConfig().databaseUrl, { max: 5 });
  return sqlClient;
}

export const sessionCookie = () => sessionCookieOptions(getAuthConfig());
const csrfCookieName = () => `${sessionCookie().name}_csrf`;

type CookieTarget = { cookies: { set: (name: string, value: string, options: object) => unknown } };

export function setSessionCookie(response: CookieTarget, token: string) {
  const { name, ...options } = sessionCookie();
  response.cookies.set(name, token, { ...options, maxAge: HRIS_IDLE_MS / 1000 });
}

export function clearSessionCookie(response: CookieTarget) {
  const { name, ...options } = sessionCookie();
  response.cookies.set(name, '', { ...options, maxAge: 0 });
}

export function setCsrfNonceCookie(response: CookieTarget, nonce: string) {
  const { name: _name, ...options } = sessionCookie();
  response.cookies.set(csrfCookieName(), nonce, { ...options, maxAge: 60 * 60 });
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookie().name)?.value;
}

/** Token CSRF; konteksnya token sesi bila ada, jika tidak nonce pra-login di cookie HttpOnly. */
export async function issueCsrf(): Promise<{ token: string; nonce?: string }> {
  const { csrfSecret } = getAuthConfig();
  const sessionToken = await readSessionToken();
  if (sessionToken) return { token: issueCsrfToken(csrfSecret, sessionToken) };
  const existing = (await cookies()).get(csrfCookieName())?.value;
  const nonce = existing ?? crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  return { token: issueCsrfToken(csrfSecret, nonce), nonce: existing ? undefined : nonce };
}

/** Guard Origin + CSRF untuk mutasi. Mengembalikan pesan galat bila ditolak, null bila lolos. */
export async function checkMutation(req: Request): Promise<string | null> {
  const { csrfSecret, trustedOrigins } = getAuthConfig();
  const context = (await readSessionToken()) ?? (await cookies()).get(csrfCookieName())?.value ?? '';
  try {
    assertTrustedMutation({
      method: req.method, origin: req.headers.get('origin'), trustedOrigins,
      csrfToken: req.headers.get('x-csrf-token'), csrfSecret, context,
    });
    return null;
  } catch {
    return 'Permintaan ditolak: asal atau perlindungan permintaan tidak valid.';
  }
}

export function deviceLabel(req: Request): string {
  return (req.headers.get('user-agent') ?? 'tidak diketahui').slice(0, 200);
}

/** Sesi HRIS yang sah untuk permintaan ini, atau kode kegagalan layanan pusat. */
export async function currentHrisSession() {
  const token = await readSessionToken();
  if (!token) return { ok: false as const, code: 'INVALID_SESSION', error: 'Sesi tidak valid, silakan login kembali.' };
  return validateSession(getAuthSql(), token, 'hris');
}
