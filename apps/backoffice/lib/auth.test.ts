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
