import type { UserRole } from '@petshop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const revokeOthers = vi.fn();
const insertValues = vi.fn();

vi.mock('@/lib/db', () => {
  const trx = {
    update: () => ({
      set: (patch: unknown) => ({
        where: async () => {
          revokeOthers(patch);
        },
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        insertValues(v);
        return { returning: async () => [{ id: 7 }] };
      },
    }),
  };
  return {
    db: { transaction: async (fn: (t: typeof trx) => unknown) => fn(trx) },
    userSessions: { userId: 'user_id', revokedAt: 'revoked_at' },
    eq: () => ({}),
    and: () => ({}),
    isNull: () => ({}),
  };
});

const { startSession, allowsConcurrentSessions } = await import('./user-session');

describe('allowsConcurrentSessions', () => {
  it('hanya OWNER & GM yang boleh multi-perangkat', () => {
    expect(allowsConcurrentSessions('OWNER')).toBe(true);
    expect(allowsConcurrentSessions('GM')).toBe(true);
    for (const role of ['MANAGER', 'KASIR', 'GUDANG', 'FINANCE'] satisfies UserRole[]) {
      expect(allowsConcurrentSessions(role)).toBe(false);
    }
  });
});

describe('startSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['OWNER', 'GM'] satisfies UserRole[])(
    '%s: sesi lain TIDAK dicabut, jadi perangkat lama tetap hidup',
    async (role) => {
      const sessionId = await startSession(1, 'Chrome di Windows', role);

      expect(sessionId).toBe(7);
      expect(revokeOthers).not.toHaveBeenCalled();
      expect(insertValues).toHaveBeenCalledWith({ userId: 1, deviceLabel: 'Chrome di Windows' });
    },
  );

  it.each(['MANAGER', 'KASIR', 'GUDANG', 'FINANCE'] satisfies UserRole[])(
    '%s: sesi lain dicabut dengan alasan TAKEN_OVER',
    async (role) => {
      const sessionId = await startSession(2, null, role);

      expect(sessionId).toBe(7);
      expect(revokeOthers).toHaveBeenCalledTimes(1);
      expect(revokeOthers).toHaveBeenCalledWith(
        expect.objectContaining({ revokedReason: 'TAKEN_OVER', revokedAt: expect.any(Date) }),
      );
      expect(insertValues).toHaveBeenCalledWith({ userId: 2, deviceLabel: null });
    },
  );
});
