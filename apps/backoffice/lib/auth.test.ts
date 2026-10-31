import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'rahasia-uji-yang-panjangnya-lebih-dari-32-karakter';

const isSessionActive = vi.fn();
vi.mock('@/lib/services/user-session', () => ({ isSessionActive }));

const { signAccessToken, verifyAccessToken, verifyAccessTokenSignatureOnly } = await import('./auth');

const basePayload = {
  userId: 7,
  userName: 'Sari',
  staffNumber: 'S07',
  branchId: 2,
  branchName: 'Toko Pusat',
  role: 'KASIR' as const,
  permissions: [],
};

beforeEach(() => {
  isSessionActive.mockReset();
});

describe('verifyAccessToken', () => {
  it('menolak token yang tanda tangannya tidak sah', async () => {
    expect(await verifyAccessToken('bukan-token')).toBeNull();
    expect(isSessionActive).not.toHaveBeenCalled();
  });

  it('menerima token TANPA sessionId tanpa menyentuh database', async () => {
    // Token terbitan sebelum fitur sesi ada. Menolaknya berarti melempar keluar semua orang
    // yang sedang bekerja pada saat deploy — token itu toh mati sendiri dalam 1 hari.
    const token = await signAccessToken(basePayload);

    const payload = await verifyAccessToken(token);

    expect(payload?.userId).toBe(7);
    expect(isSessionActive).not.toHaveBeenCalled();
  });

  it('menerima token yang sesinya masih hidup', async () => {
    isSessionActive.mockResolvedValue(true);
    const token = await signAccessToken({ ...basePayload, sessionId: 42 });

    const payload = await verifyAccessToken(token);

    expect(payload?.sessionId).toBe(42);
    expect(isSessionActive).toHaveBeenCalledWith(42);
  });

  it('menolak token yang sesinya sudah dicabut, walau tanda tangannya masih sah', async () => {
    // Inti fiturnya: sebelum ini tidak ada cara apa pun membatalkan token yang sudah terbit.
    isSessionActive.mockResolvedValue(false);
    const token = await signAccessToken({ ...basePayload, sessionId: 42 });

    expect(await verifyAccessToken(token)).toBeNull();
    // Tanda tangannya memang masih sah — itulah yang membuat middleware (Edge, tanpa DB)
    // tetap meloloskannya, dan kenapa cek sesi harus ada di lapisan ini.
    expect(await verifyAccessTokenSignatureOnly(token)).not.toBeNull();
  });
});

describe('verifyAccessTokenSignatureOnly', () => {
  it('tidak pernah menyentuh database', async () => {
    const token = await signAccessToken({ ...basePayload, sessionId: 42 });

    await verifyAccessTokenSignatureOnly(token);

    expect(isSessionActive).not.toHaveBeenCalled();
  });
});

describe('verifyAccessToken mode central', () => {
  const isCentralAccessValid = vi.fn();

  beforeEach(() => {
    isCentralAccessValid.mockReset();
    vi.resetModules();
    vi.doMock('@/lib/services/central-session', () => ({ isCentralAccessValid }));
    process.env.BO_AUTH_MODE = 'central';
  });

  async function loadAuth() {
    return await import('./auth');
  }

  it('menolak token legacy tanpa centralSessionId lewat pemeriksaan pusat', async () => {
    isCentralAccessValid.mockResolvedValue(false);
    const { signAccessToken, verifyAccessToken } = await loadAuth();
    const token = await signAccessToken({ ...basePayload, sessionId: 5 });

    expect(await verifyAccessToken(token)).toBeNull();
    expect(isSessionActive).not.toHaveBeenCalled();
  });

  it('menerima token yang didukung sesi pusat, tanpa menyentuh sesi legacy', async () => {
    isCentralAccessValid.mockResolvedValue(true);
    const { signAccessToken, verifyAccessToken } = await loadAuth();
    const token = await signAccessToken({ ...basePayload, centralSessionId: 9 });

    expect((await verifyAccessToken(token))?.centralSessionId).toBe(9);
    expect(isSessionActive).not.toHaveBeenCalled();
  });

  it('menolak token bertanda tangan sah bila sesi pusat sudah dicabut', async () => {
    isCentralAccessValid.mockResolvedValue(false);
    const { signAccessToken, verifyAccessToken } = await loadAuth();
    const token = await signAccessToken({ ...basePayload, centralSessionId: 9 });

    expect(await verifyAccessToken(token)).toBeNull();
  });

  it('mode legacy tidak pernah memanggil pemeriksaan pusat', async () => {
    delete process.env.BO_AUTH_MODE;
    const { signAccessToken, verifyAccessToken } = await loadAuth();
    const token = await signAccessToken(basePayload);

    expect((await verifyAccessToken(token))?.userId).toBe(7);
    expect(isCentralAccessValid).not.toHaveBeenCalled();
  });
});
