import { describe, expect, it } from 'vitest';
import {
  checkEndReason, emergencyStatus, endOfDayWib, lastAllowedDate, letterCount, matchesTarget, validateEmergency,
  type EmergencyInput,
} from './emergency';

const limits = { maxChars: 300, maxDays: 7, today: '2026-11-15' };
const input = (over: Partial<EmergencyInput> = {}): EmergencyInput => ({
  title: 'Toko Singaparna tutup', message: 'Banjir, toko tutup hari ini.', target: { all: true }, showsUntilDate: '2026-11-15', ...over,
});

describe('sasaran pengumuman darurat (spec F3-2 §3.1, keputusan §9 butir 2)', () => {
  const kasirSingaparna = { branchId: 1, positionId: 10 };
  const kasirTasik = { branchId: 2, positionId: 10 };
  const kepalaSingaparna = { branchId: 1, positionId: 20 };

  it('semua orang selalu cocok', () => {
    expect(matchesTarget({ all: true }, kasirTasik)).toBe(true);
  });

  it('cabang saja = semua jabatan di cabang itu', () => {
    const target = { all: false as const, branchIds: [1], positionIds: [] };
    expect([kasirSingaparna, kasirTasik, kepalaSingaparna].map((p) => matchesTarget(target, p))).toEqual([true, false, true]);
  });

  it('jabatan saja = jabatan itu di semua cabang', () => {
    const target = { all: false as const, branchIds: [], positionIds: [10] };
    expect([kasirSingaparna, kasirTasik, kepalaSingaparna].map((p) => matchesTarget(target, p))).toEqual([true, true, false]);
  });

  it('cabang dan jabatan = irisan (Kasir di Singaparna saja)', () => {
    const target = { all: false as const, branchIds: [1], positionIds: [10] };
    expect([kasirSingaparna, kasirTasik, kepalaSingaparna].map((p) => matchesTarget(target, p))).toEqual([true, false, false]);
  });
});

describe('isian kirim (spec F3-2 §3.3, §6)', () => {
  it('lolos dan dirapikan; tayang sampai 23.59.59 WIB', () => {
    const result = validateEmergency(input({ title: '  Judul  ' }), limits);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.title).toBe('Judul');
    expect(result.value.showsUntil.toISOString()).toBe('2026-11-15T16:59:59.999Z');
  });

  it('pesan paling banyak 300 huruf (emoji dihitung satu), judul 80', () => {
    expect(validateEmergency(input({ message: 'a'.repeat(300) }), limits).ok).toBe(true);
    expect(validateEmergency(input({ message: 'a'.repeat(301) }), limits)).toMatchObject({ ok: false });
    expect(letterCount('🙂'.repeat(300))).toBe(300);
    expect(validateEmergency(input({ message: '🙂'.repeat(300) }), limits).ok).toBe(true);
    expect(validateEmergency(input({ title: 'j'.repeat(81) }), limits)).toMatchObject({ ok: false });
  });

  it('judul/pesan kosong ditolak', () => {
    expect(validateEmergency(input({ title: '   ' }), limits)).toMatchObject({ ok: false });
    expect(validateEmergency(input({ message: '' }), limits)).toMatchObject({ ok: false });
  });

  it('masa tayang: hari ini s.d. hari ke-7 (hari ini dihitung); lampau dan lebih jauh ditolak', () => {
    expect(lastAllowedDate('2026-11-15', 7)).toBe('2026-11-21');
    expect(validateEmergency(input({ showsUntilDate: '2026-11-21' }), limits).ok).toBe(true);
    expect(validateEmergency(input({ showsUntilDate: '2026-11-22' }), limits)).toMatchObject({ ok: false });
    expect(validateEmergency(input({ showsUntilDate: '2026-11-14' }), limits)).toMatchObject({ ok: false });
    expect(validateEmergency(input({ showsUntilDate: '2026-02-30' }), limits)).toMatchObject({ ok: false });
  });

  it('sasaran kosong ditolak; id ganda dan tidak sah dibuang', () => {
    expect(validateEmergency(input({ target: { all: false, branchIds: [], positionIds: [] } }), limits)).toMatchObject({ ok: false });
    const result = validateEmergency(input({ target: { all: false, branchIds: [2, 2, 1, -1], positionIds: [] } }), limits);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.target).toEqual({ all: false, branchIds: [1, 2], positionIds: [] });
  });
});

describe('status dan alasan', () => {
  const now = new Date('2026-11-15T10:00:00Z');

  it('Tayang / Berakhir / Diakhiri dihitung, tidak disimpan', () => {
    expect(emergencyStatus({ showsUntil: endOfDayWib('2026-11-15'), endedAt: null }, now)).toBe('SHOWING');
    expect(emergencyStatus({ showsUntil: endOfDayWib('2026-11-14'), endedAt: null }, now)).toBe('EXPIRED');
    expect(emergencyStatus({ showsUntil: endOfDayWib('2026-11-15'), endedAt: now }, now)).toBe('ENDED');
  });

  it('alasan Akhiri sekarang wajib', () => {
    expect(checkEndReason(' ').ok).toBe(false);
    expect(checkEndReason('Salah cabang')).toEqual({ ok: true, value: 'Salah cabang' });
  });
});
