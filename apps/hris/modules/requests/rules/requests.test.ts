import { describe, expect, it } from 'vitest';
import { APPROVAL_ACTIONS } from '@/lib/nav';
import { canTransition, isOpen, isOwnRequest, waitingDays, waitingTone } from './status';
import { deciderActions } from './types';

const parties = {
  actorAccountId: 1, actorPersonId: 10, submittedByAccountId: 2, submittedByEmployeeId: 20, subjectEmployeeId: 20,
};

describe('status pengajuan (PRI-37)', () => {
  it('perpindahan sah dan akhir', () => {
    expect(canTransition('PENDING', 'APPROVED')).toBe(true);
    expect(canTransition('PENDING', 'REJECTED')).toBe(true);
    expect(canTransition('APPROVED', 'REVOKED')).toBe(true);
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransition('APPROVED', 'REJECTED')).toBe(false);
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false);
  });

  it('hanya Menunggu dan Diperiksa yang masih terbuka', () => {
    expect(isOpen('PENDING')).toBe(true);
    expect(isOpen('REVIEWED')).toBe(true);
    expect(isOpen('APPROVED')).toBe(false);
  });
});

describe('KAR-72: milik sendiri', () => {
  it('orang lain bukan pemilik', () => expect(isOwnRequest(parties)).toBe(false));
  it('pengaju lewat akun, pengaju lewat orang, dan orang yang diajukan = pemilik', () => {
    expect(isOwnRequest({ ...parties, actorAccountId: 2 })).toBe(true);
    expect(isOwnRequest({ ...parties, actorPersonId: 20 })).toBe(true);
    expect(isOwnRequest({ ...parties, submittedByEmployeeId: 30, actorPersonId: 20 })).toBe(true);
  });
});

describe('lama menunggu', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  it('dihitung per 24 jam penuh', () => {
    expect(waitingDays(new Date('2026-11-05T01:00:00Z'), now)).toBe(0);
    expect(waitingDays(new Date('2026-11-03T12:00:00Z'), now)).toBe(2);
  });
  it('kuning sejak 1 hari, merah sejak batas pengaturan', () => {
    expect(waitingTone(0, 2)).toBe('none');
    expect(waitingTone(1, 2)).toBe('warn');
    expect(waitingTone(2, 2)).toBe('danger');
  });
});

describe('daftar jenis', () => {
  it('tindakan menu Persetujuan sama dengan daftar jenis', () => {
    expect([...APPROVAL_ACTIONS].sort()).toEqual([...new Set(deciderActions())].sort());
  });
});
