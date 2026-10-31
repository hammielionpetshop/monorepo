import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type CookieEnvironment = {
  environment: 'local' | 'staging' | 'production';
  domain?: string;
};

export function sessionCookieOptions(config: CookieEnvironment) {
  if (!['local', 'staging', 'production'].includes(config.environment)) throw new Error('Lingkungan cookie tidak valid.');
  if (config.environment !== 'local' && (!config.domain || !/^\.?[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(config.domain))) {
    throw new Error('Domain induk cookie wajib diisi untuk lingkungan nonlokal.');
  }
  return {
    name: `hml_${config.environment}_session`,
    httpOnly: true as const, secure: config.environment !== 'local', sameSite: 'lax' as const,
    path: '/', ...(config.domain ? { domain: config.domain } : {}),
  };
}

function csrfSignature(secret: string, context: string, payload: string): string {
  if (secret.length < 32 || !context || context.length > 512) throw new Error('Konfigurasi perlindungan permintaan tidak valid.');
  return createHmac('sha256', secret).update(JSON.stringify([context, payload])).digest('base64url');
}

// Konteks login adalah nonce pra-login HttpOnly; sesudah login gunakan token sesi aktif.
export function issueCsrfToken(secret: string, context: string): string {
  const payload = randomBytes(32).toString('base64url');
  return `${payload}.${csrfSignature(secret, context, payload)}`;
}

export function assertTrustedMutation(input: {
  method: string; origin: string | null; trustedOrigins: readonly string[];
  csrfToken: string | null; csrfSecret: string; context: string;
}): void {
  const denied = () => { throw new Error('Asal atau perlindungan permintaan tidak valid.'); };
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(input.method) || !input.origin
    || !input.trustedOrigins.includes(input.origin)) return denied();
  try {
    const origin = new URL(input.origin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== input.origin) return denied();
  } catch { return denied(); }
  if (!input.csrfToken || !/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(input.csrfToken)) return denied();
  const [payload, signature] = input.csrfToken.split('.');
  const expected = csrfSignature(input.csrfSecret, input.context, payload);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return denied();
}
