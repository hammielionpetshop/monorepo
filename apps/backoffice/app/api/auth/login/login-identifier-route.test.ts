import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'rahasia-uji-yang-panjangnya-lebih-dari-32-karakter';
process.env.JWT_REFRESH_SECRET = 'rahasia-refresh-yang-panjangnya-lebih-dari-32-karakter';

const verify = vi.fn();
const startSession = vi.fn();

// Nilai yang diinterpolasi ke setiap fragmen sql`` — dipakai membuktikan pencarian
// benar-benar menyertakan kolom username (bukan hanya email) dan nilainya sudah huruf kecil.
let sqlCalls: unknown[][] = [];
let selectResults: unknown[][] = [];

vi.mock('argon2', () => ({ verify }));

vi.mock('@/lib/services/user-session', () => ({ startSession }));

vi.mock('@/lib/db', () => {
  const col = (name: string) => name;
  const builder = () => {
    const b = {
      from: () => b,
      innerJoin: () => b,
      where: () => b,
      limit: () => b,
      orderBy: () => b,
      then: (resolve: (v: unknown[]) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(selectResults.shift() ?? []).then(resolve, reject),
    };
    return b;
  };
  return {
    db: { select: () => builder() },
    users: { id: col('users.id'), email: col('users.email'), username: col('users.username'), isActive: col('users.isActive'), staffNumber: col('users.staffNumber') },
    branches: { id: col('branches.id'), isActive: col('branches.isActive') },
    roles: { id: col('roles.id') },
    permissions: { id: col('permissions.id'), code: col('permissions.code') },
    rolePermissions: { roleId: col('rolePermissions.roleId'), permissionId: col('rolePermissions.permissionId') },
    userPermissions: { userId: col('userPermissions.userId'), permissionId: col('userPermissions.permissionId') },
    userBranchAssignments: { userId: col('uba.userId'), branchId: col('uba.branchId') },
    eq: (a: unknown, b: unknown) => ({ a, b }),
    and: () => ({}),
    or: () => ({}),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
      sqlCalls.push(values);
      return { strings, values };
    },
  };
});

const { POST } = await import('./route');

function request(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' },
    body: JSON.stringify(body),
  });
}

// Akun tanpa email sama sekali — persis bentuk user yang dibuat lewat Settings > Pengguna,
// di mana username wajib dan email opsional.
function queueUsernameOnlyAccount() {
  selectResults = [
    [{ id: 12, name: 'Budi', staffNumber: null, passwordHash: 'hash', pinHash: 'pinhash', roleId: 4, branchId: 2, isActive: true, mustChangeCredentials: false, mustChangePin: false }],
    [{ id: 2, name: 'Toko Depan' }],
    [{ id: 4, name: 'KASIR' }],
    [{ code: 'pos.operate' }],
    [],
    [{ branchId: 3 }],
  ];
}

describe('POST /api/auth/login — identifier tanpa syarat format email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlCalls = [];
    selectResults = [];
    startSession.mockResolvedValue(11);
    verify.mockResolvedValue(true);
  });

  it('menerima username sebagai identifier dan mencarinya di kolom username', async () => {
    queueUsernameOnlyAccount();

    const res = await POST(
      request({ mode: 'bo', identifier: 'budi', credential: 'rahasia123', credentialType: 'password' }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: { id: 12, name: 'Budi', role: 'KASIR', branch: 'Toko Depan' },
    });
    expect(sqlCalls).toContainEqual(['users.username', 'budi']);
    expect(res.headers.get('set-cookie')).toContain('accessToken=');
  });

  it('tidak menolak identifier yang bukan format email', async () => {
    queueUsernameOnlyAccount();

    const res = await POST(
      request({ mode: 'bo', identifier: 'bukan email sama sekali', credential: 'rahasia123', credentialType: 'password' }),
    );

    // Yang penting: 400 "Format email tidak valid" tidak pernah muncul lagi di jalur ini.
    expect(res.status).toBe(200);
  });

  it('menurunkan identifier ke huruf kecil sebelum dicari', async () => {
    queueUsernameOnlyAccount();

    const res = await POST(
      request({ mode: 'bo', identifier: '  BuDi  ', credential: 'rahasia123', credentialType: 'password' }),
    );

    expect(res.status).toBe(200);
    // Dibandingkan lewat lower() di kedua kolom, dengan nilai yang sudah dinormalkan.
    expect(sqlCalls).toContainEqual(['users.email', 'budi']);
    expect(sqlCalls).toContainEqual(['users.username', 'budi']);
  });

  it('email pada mode email_password juga dicari case-insensitive', async () => {
    queueUsernameOnlyAccount();

    const res = await POST(request({ mode: 'email_password', email: 'Budi@Contoh.COM', password: 'rahasia123' }));

    expect(res.status).toBe(200);
    expect(sqlCalls).toContainEqual(['users.email', 'budi@contoh.com']);
  });

  it('tetap 401 generik bila kredensialnya salah', async () => {
    queueUsernameOnlyAccount();
    verify.mockResolvedValue(false);

    const res = await POST(
      request({ mode: 'bo', identifier: 'budi', credential: 'salah', credentialType: 'password' }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Kredensial salah' });
    expect(startSession).not.toHaveBeenCalled();
  });

  it('mode email_password TETAP memvalidasi format email (masih dipakai pos-desktop)', async () => {
    const res = await POST(request({ mode: 'email_password', email: 'budi', password: 'rahasia123' }));

    expect(res.status).toBe(400);
    expect(startSession).not.toHaveBeenCalled();
  });
});
