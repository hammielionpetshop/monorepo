import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {}, users: {}, roles: {}, eq: () => null }));
vi.mock('@/lib/central-auth', () => ({
  getAuthMode: () => (process.env.BO_AUTH_MODE === 'central' ? 'central' : 'legacy'),
  getAuthSql: () => ({}),
}));
vi.mock('@petshop/auth', () => ({ validateSession: vi.fn(), findBackofficeUserOfAccount: vi.fn() }));

import { authorizeInternalRequest } from './internal-gate';

const KEY = 'k'.repeat(40);
const saved = { ...process.env };

function request(headers: Record<string, string> = {}) {
  return new Request('http://backoffice:3000/api/internal/hris/provision', {
    method: 'POST',
    headers: { host: 'backoffice:3000', 'x-internal-key': KEY, ...headers },
  });
}

describe('pagar pintu internal provisioning', () => {
  beforeEach(() => {
    process.env.BO_AUTH_MODE = 'central';
    process.env.HRIS_INTERNAL_KEY = KEY;
    process.env.INTERNAL_ALLOWED_HOSTS = 'backoffice:3000';
  });
  afterEach(() => { process.env = { ...saved }; });

  const expectHidden = async (req: Request) => {
    const result = await authorizeInternalRequest(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(404);
  };

  it('mode legacy: rute tidak terdeteksi', async () => {
    process.env.BO_AUTH_MODE = 'legacy';
    await expectHidden(request());
  });
  it('kunci layanan belum dikonfigurasi atau terlalu pendek', async () => {
    process.env.HRIS_INTERNAL_KEY = 'pendek';
    await expectHidden(request({ 'x-internal-key': 'pendek' }));
  });
  it('host publik ditolak', async () => {
    await expectHidden(request({ host: 'admin.hammielion.com' }));
  });
  it('permintaan yang lewat proxy publik ditolak', async () => {
    await expectHidden(request({ 'x-forwarded-for': '203.0.113.9' }));
    await expectHidden(request({ 'x-forwarded-host': 'admin.hammielion.com' }));
  });
  it('kunci salah atau kosong ditolak', async () => {
    await expectHidden(request({ 'x-internal-key': 'x'.repeat(40) }));
    await expectHidden(new Request('http://backoffice:3000/', { method: 'POST', headers: { host: 'backoffice:3000' } }));
  });
  it('kunci benar tanpa pelaku: 403, bukan lolos', async () => {
    const result = (await authorizeInternalRequest(request())) as Response;
    expect(result.status).toBe(403);
  });
});
