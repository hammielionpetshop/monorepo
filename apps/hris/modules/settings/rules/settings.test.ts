import { describe, expect, it } from 'vitest';
import { SETTINGS, type SettingDefinition } from './registry';
import {
  addDays, effectiveDateProblem, resolveSetting, todayWib, upcomingRows, valueProblem, type SettingRow,
} from './resolve';

let nextId = 1;
const row = (over: Partial<SettingRow>): SettingRow => ({
  id: nextId++, key: 'employees.training_review_months', targetKind: 'ALL', targetId: null, value: 3,
  effectiveFrom: '2026-01-01', status: 'ACTIVE', ...over,
});

describe('resolveSetting: nilai menurut tanggal (WAJ-07, W6)', () => {
  const rows = [
    row({ value: 3 }),
    row({ value: 4, effectiveFrom: '2026-12-01' }),
    row({ value: 9, effectiveFrom: '2026-11-15', status: 'CANCELLED' }),
    row({ value: 8, effectiveFrom: '2026-11-10', status: 'PROPOSED' }),
  ];

  it('tanggal lama memakai nilai lama, tanggal baru memakai nilai baru', () => {
    expect(resolveSetting(rows, '2026-11-30')?.value).toBe(3);
    expect(resolveSetting(rows, '2026-12-01')?.value).toBe(4);
    expect(resolveSetting(rows, '2027-03-01')?.value).toBe(4);
  });

  it('nilai dibatalkan dan usulan tidak pernah dipakai', () => {
    expect(resolveSetting(rows, '2026-11-20')?.value).toBe(3);
    expect(resolveSetting(rows, '2026-11-11')?.value).toBe(3);
  });

  it('sebelum isi awal tidak ada nilai', () => {
    expect(resolveSetting(rows, '2025-12-31')).toBeNull();
  });

  it('sasaran jabatan mengalahkan ALL; tanpa nilai jabatan jatuh ke ALL', () => {
    const r = [
      row({ key: 'position.backoffice_role_suggestion', value: 'NONE' }),
      row({ key: 'position.backoffice_role_suggestion', targetKind: 'POSITION', targetId: 11, value: 'KASIR', effectiveFrom: '2026-11-01' }),
    ];
    expect(resolveSetting(r, '2026-11-01', { positionId: 11 })?.value).toBe('KASIR');
    expect(resolveSetting(r, '2026-10-31', { positionId: 11 })?.value).toBe('NONE');
    expect(resolveSetting(r, '2026-11-01', { positionId: 12 })?.value).toBe('NONE');
    expect(resolveSetting(r, '2026-11-01')?.value).toBe('NONE');
  });

  it('nilai berikutnya hanya yang berlaku sesudah hari ini, urut tanggal', () => {
    expect(upcomingRows(rows, '2026-11-01', 'ALL', null).map((r) => r.value)).toEqual([4]);
    expect(upcomingRows(rows, '2026-12-01', 'ALL', null)).toEqual([]);
  });
});

describe('aturan tanggal berlaku (keputusan owner §8 butir 4)', () => {
  const money = SETTINGS['employees.training_review_months'];
  const plain = SETTINGS['shared.reason_min_length'];
  const today = '2026-11-01';

  it('menyangkut uang/hitungan: hari ini dan kemarin ditolak, besok diterima', () => {
    expect(effectiveDateProblem(money, today, today)).not.toBeNull();
    expect(effectiveDateProblem(money, '2026-10-31', today)).not.toBeNull();
    expect(effectiveDateProblem(money, '2026-11-02', today)).toBeNull();
  });

  it('bukan uang: hari ini diterima, kemarin ditolak', () => {
    expect(effectiveDateProblem(plain, today, today)).toBeNull();
    expect(effectiveDateProblem(plain, '2026-10-31', today)).not.toBeNull();
  });

  it('tanggal tidak sah ditolak', () => {
    expect(effectiveDateProblem(plain, '2026-02-30', today)).not.toBeNull();
    expect(effectiveDateProblem(plain, 'besok', today)).not.toBeNull();
  });

  it('startDay: hanya tanggal itu yang diterima', () => {
    const payroll: SettingDefinition = { ...money, startDay: 26 };
    expect(effectiveDateProblem(payroll, '2026-11-25', today)).not.toBeNull();
    expect(effectiveDateProblem(payroll, '2026-11-26', today)).toBeNull();
  });

  it('besok WIB dihitung dari jam server WIB', () => {
    expect(todayWib(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('pemeriksa nilai', () => {
  it('bilangan bulat dalam batas', () => {
    const d = SETTINGS['shared.reason_min_length'];
    expect(valueProblem(d, 15)).toBeNull();
    expect(valueProblem(d, 2)).not.toBeNull();
    expect(valueProblem(d, 101)).not.toBeNull();
    expect(valueProblem(d, 15.5)).not.toBeNull();
    expect(valueProblem(d, '15')).not.toBeNull();
  });

  it('pilihan harus ada di daftar', () => {
    const d = SETTINGS['position.backoffice_role_suggestion'];
    expect(valueProblem(d, 'KASIR')).toBeNull();
    expect(valueProblem(d, 'OWNER')).not.toBeNull();
    expect(valueProblem(d, 'GM')).not.toBeNull();
  });
});

