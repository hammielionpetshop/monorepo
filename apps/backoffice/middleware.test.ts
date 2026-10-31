import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { middleware } from './middleware';

const ENV_KEYS = ['BO_AUTH_MODE', 'AUTH_COOKIE_ENV', 'JWT_SECRET'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.BO_AUTH_MODE = 'central';
  process.env.AUTH_COOKIE_ENV = 'staging';
  process.env.JWT_SECRET = 'rahasia-uji-middleware-minimal-32-karakter';
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const request = (path: string, cookie?: string) =>
  new NextRequest(`https://bo.example.test${path}`, { headers: cookie ? { cookie } : {} });

describe('middleware mode central tanpa JWT', () => {
  it('cookie sesi pusat ada: redirect ke bootstrap dengan URL absolut, bukan galat 500', async () => {
    const response = await middleware(request('/dashboard?x=1', 'hml_staging_session=token-uji'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://bo.example.test/api/auth/bootstrap?next=%2Fdashboard%3Fx%3D1',
    );
  });

  it('tanpa cookie sesi pusat: ke login; API tetap 401', async () => {
    const page = await middleware(request('/dashboard'));
    expect(page.headers.get('location')).toBe('https://bo.example.test/login');
    const api = await middleware(request('/api/bo/settings/users', 'hml_staging_session=token-uji'));
    expect(api.status).toBe(401);
  });

  it('mode legacy: cookie pusat diabaikan', async () => {
    process.env.BO_AUTH_MODE = 'legacy';
    const response = await middleware(request('/dashboard', 'hml_staging_session=token-uji'));
    expect(response.headers.get('location')).toBe('https://bo.example.test/login');
  });

  it('JWT sah: lolos tanpa redirect ke bootstrap', async () => {
    const token = await new SignJWT({ userId: 1, role: 'OWNER', permissions: [] })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    const response = await middleware(request('/dashboard', `accessToken=${token}`));
    expect(response.headers.get('location') ?? '').not.toContain('/api/auth/bootstrap');
  });
});
