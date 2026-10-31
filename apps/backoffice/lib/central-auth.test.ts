import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('postgres', () => ({ default: vi.fn() }));

const ENV_KEYS = ['BO_AUTH_MODE', 'AUTH_DATABASE_URL', 'DATABASE_URL', 'AUTH_COOKIE_ENV', 'AUTH_COOKIE_DOMAIN', 'AUTH_CSRF_SECRET', 'AUTH_TRUSTED_ORIGINS'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('getAuthMode', () => {
  it('default legacy', async () => {
    const { getAuthMode } = await import('./central-auth');
    expect(getAuthMode()).toBe('legacy');
  });

  it('menolak nilai mode yang tidak dikenal', async () => {
    process.env.BO_AUTH_MODE = 'hybrid';
    const { getAuthMode } = await import('./central-auth');
    expect(() => getAuthMode()).toThrow('BO_AUTH_MODE');
  });
});

describe('getCentralConfig', () => {
  it('gagal keras dan menyebut semua yang kurang', async () => {
    const { getCentralConfig } = await import('./central-auth');
    expect(() => getCentralConfig()).toThrow(/AUTH_COOKIE_ENV.*AUTH_CSRF_SECRET.*AUTH_TRUSTED_ORIGINS/);
  });

  it('menolak secret CSRF pendek dan domain kosong di lingkungan nonlokal', async () => {
    Object.assign(process.env, {
      DATABASE_URL: 'postgres://x', AUTH_COOKIE_ENV: 'staging', AUTH_CSRF_SECRET: 'pendek',
      AUTH_TRUSTED_ORIGINS: 'https://bo.staginghml.my.id',
    });
    const { getCentralConfig } = await import('./central-auth');
    expect(() => getCentralConfig()).toThrow(/AUTH_CSRF_SECRET.*AUTH_COOKIE_DOMAIN/);
  });

  it('menerima konfigurasi lokal lengkap tanpa domain', async () => {
    Object.assign(process.env, {
      DATABASE_URL: 'postgres://x', AUTH_COOKIE_ENV: 'local',
      AUTH_CSRF_SECRET: 'x'.repeat(32), AUTH_TRUSTED_ORIGINS: 'http://localhost:6974, http://127.0.0.1:6974',
    });
    const { getCentralConfig, centralCookie } = await import('./central-auth');
    expect(getCentralConfig().trustedOrigins).toEqual(['http://localhost:6974', 'http://127.0.0.1:6974']);
    expect(centralCookie().name).toBe('hml_local_session');
  });

  it('nama cookie Edge sama dengan nama cookie server', async () => {
    Object.assign(process.env, {
      DATABASE_URL: 'postgres://x', AUTH_COOKIE_ENV: 'staging', AUTH_COOKIE_DOMAIN: '.staginghml.my.id',
      AUTH_CSRF_SECRET: 'x'.repeat(32), AUTH_TRUSTED_ORIGINS: 'https://bo.staginghml.my.id',
    });
    const { centralCookie } = await import('./central-auth');
    const { centralCookieName } = await import('./central-cookie-name');
    expect(centralCookie().name).toBe(centralCookieName());
  });
});
