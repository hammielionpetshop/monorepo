import { describe, expect, it } from 'vitest';
import {
  accountState, cleanKasirAccess, generatePassword, isValidEmail, loginRange, passwordProblem,
} from './accounts';

describe('aturan akun', () => {
  it('status akun: nonaktif > terkunci > wajib ganti > aktif', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const base = { isActive: true, mustChangePassword: false, lockedUntil: null };
    expect(accountState(base, now)).toBe('ACTIVE');
    expect(accountState({ ...base, mustChangePassword: true }, now)).toBe('MUST_CHANGE');
    expect(accountState({ ...base, mustChangePassword: true, lockedUntil: '2026-11-01T10:03:00Z' }, now)).toBe('LOCKED');
    expect(accountState({ ...base, lockedUntil: '2026-11-01T09:00:00Z' }, now)).toBe('ACTIVE');
    expect(accountState({ ...base, isActive: false, lockedUntil: '2026-11-01T10:03:00Z' }, now)).toBe('DISABLED');
  });

  it('password minimal 8 karakter; password acak memenuhi dan tanpa huruf yang mudah tertukar', () => {
    expect(passwordProblem('1234567')).toMatch(/minimal 8/);
    expect(passwordProblem('12345678')).toBeNull();
    const generated = generatePassword();
    expect(generated).toHaveLength(10);
    expect(generated).not.toMatch(/[0O1lI]/);
    expect(passwordProblem(generated)).toBeNull();
  });

  it('email harus berbentuk alamat asli', () => {
    expect(isValidEmail(' rina@contoh.id ')).toBe(true);
    expect(isValidEmail('rina')).toBe(false);
    expect(isValidEmail('rina@contoh')).toBe(false);
  });

  it('akses kasir: role dari daftar tetap, cabang utama selalu ikut cabang tugas', () => {
    expect(cleanKasirAccess({ roleName: 'KASIR', branchId: 2, assignedBranchIds: [3, 2] }))
      .toEqual({ ok: true, value: { roleName: 'KASIR', branchId: 2, assignedBranchIds: [2, 3] } });
    expect(cleanKasirAccess({ roleName: 'ADMIN', branchId: 2, assignedBranchIds: [] }).ok).toBe(false);
    expect(cleanKasirAccess({ roleName: 'KASIR', branchId: 0, assignedBranchIds: [] }).ok).toBe(false);
    expect(cleanKasirAccess({ roleName: 'KASIR', branchId: 2, assignedBranchIds: ['x'] }).ok).toBe(false);
  });

  it('rentang riwayat masuk: bawaan 7 hari, batas hari WIB, paling jauh 92 hari', () => {
    const range = loginRange(undefined, undefined, '2026-11-01');
    expect(range).toMatchObject({ from: '2026-10-26', to: '2026-11-01' });
    expect(range.fromInstant.toISOString()).toBe('2026-10-25T17:00:00.000Z');
    expect(range.toInstant.toISOString()).toBe('2026-11-01T17:00:00.000Z');
    expect(loginRange('2026-01-01', '2026-11-01', '2026-11-01').from).toBe('2026-08-02');
    // Tanggal depan dan "dari" sesudah "sampai" diabaikan.
    expect(loginRange('2026-11-05', '2026-12-01', '2026-11-01')).toMatchObject({ from: '2026-10-26', to: '2026-11-01' });
  });
});
