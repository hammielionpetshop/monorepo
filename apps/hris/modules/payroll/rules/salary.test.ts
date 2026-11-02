import { describe, expect, it } from 'vitest';
import {
  addPeriods, classifyChange, dailyRate, effectiveChoices, effectiveDateProblem, linesProblem, monthlyTotal, packageOn, periodEndOf,
  periodName, periodStartOf, promotionLines, proposalDeadline, scheduledAfter,
} from './salary';

const pokok = (amount: number) => ({ componentTypeId: 1, amount });
const tunjangan = (amount: number) => ({ componentTypeId: 2, amount });

describe('gaji tetap dan gaji harian (GAJ-05, 65)', () => {
  it('semua komponen dijumlah', () => {
    expect(monthlyTotal([pokok(2_400_000), tunjangan(200_000)])).toBe(2_600_000);
  });
  it('gaji harian = jumlah ÷ pembagi, tidak dibulatkan', () => {
    expect(dailyRate([pokok(2_600_000)], 26)).toBe(100_000);
    expect(dailyRate([pokok(2_500_000)], 26)).toBeCloseTo(96_153.846, 2);
  });
});

describe('periode 26–25 (GAJ-01)', () => {
  it('awal periode', () => {
    expect(periodStartOf('2026-11-02')).toBe('2026-10-26');
    expect(periodStartOf('2026-11-26')).toBe('2026-11-26');
    expect(periodStartOf('2026-01-10')).toBe('2025-12-26');
  });
  it('akhir, nama, dan geser periode', () => {
    expect(periodEndOf('2026-10-26')).toBe('2026-11-25');
    expect(periodName('2026-10-26')).toBe('November 2026');
    expect(addPeriods('2026-11-26', 2)).toBe('2027-01-26');
  });
});

describe('pilihan tanggal berlaku (GAJ-04, 63; spec L4a §3.3)', () => {
  it('periode berjalan + 3 periode depan, semuanya tanggal 26', () => {
    expect(effectiveChoices('2026-11-02')).toEqual(['2026-10-26', '2026-11-26', '2026-12-26', '2027-01-26']);
  });
  it('kenaikan boleh periode berjalan; penurunan hanya periode depan', () => {
    expect(effectiveDateProblem('2026-10-26', '2026-11-02', 'RAISE')).toBeNull();
    expect(effectiveDateProblem('2026-10-26', '2026-11-02', 'FIRST')).toBeNull();
    expect(effectiveDateProblem('2026-10-26', '2026-11-02', 'CUT')).toMatch(/periode depan/);
    expect(effectiveDateProblem('2026-11-26', '2026-11-02', 'CUT')).toBeNull();
  });
  it('bukan tanggal 26, sudah lewat, atau terlalu jauh ditolak', () => {
    expect(effectiveDateProblem('2026-11-01', '2026-11-02', 'RAISE')).toMatch(/tanggal 26/);
    expect(effectiveDateProblem('2026-09-26', '2026-11-02', 'RAISE')).toMatch(/sudah lewat/);
    expect(effectiveDateProblem('2027-02-26', '2026-11-02', 'RAISE')).toMatch(/3 periode/);
  });
  it('isi sama dengan yang berlaku = tidak ada perubahan', () => {
    expect(effectiveDateProblem('2026-11-26', '2026-11-02', 'SAME')).toMatch(/sama/);
  });
});

describe('jenis perubahan', () => {
  it('pertama, naik, turun, pindah isi, sama', () => {
    expect(classifyChange(null, [pokok(1)])).toBe('FIRST');
    expect(classifyChange([pokok(100)], [pokok(150)])).toBe('RAISE');
    expect(classifyChange([pokok(100), tunjangan(50)], [pokok(120)])).toBe('CUT');
    expect(classifyChange([pokok(100), tunjangan(50)], [pokok(50), tunjangan(100)])).toBe('RESHAPE');
    expect(classifyChange([tunjangan(50), pokok(100)], [pokok(100), tunjangan(50)])).toBe('SAME');
  });
});

describe('isi paket', () => {
  const active = new Set([1, 2]);
  it('menolak kosong, jenis tak dikenal, ganda, 0, pecahan', () => {
    expect(linesProblem([], active)).toMatch(/paling sedikit/);
    expect(linesProblem([{ componentTypeId: 9, amount: 1 }], active)).toMatch(/tidak dikenal/);
    expect(linesProblem([pokok(1), pokok(2)], active)).toMatch(/satu baris/);
    expect(linesProblem([pokok(0)], active)).toMatch(/lebih dari 0/);
    expect(linesProblem([pokok(1.5)], active)).toMatch(/bulat/);
    expect(linesProblem([pokok(2_000_000), tunjangan(1)], active)).toBeNull();
  });
});

describe('paket berlaku pada tanggal', () => {
  const packages = [
    { id: 1, effectiveFrom: '2026-08-26', cancelled: false },
    { id: 2, effectiveFrom: '2026-10-26', cancelled: true },
    { id: 3, effectiveFrom: '2026-09-26', cancelled: false },
    { id: 4, effectiveFrom: '2026-11-26', cancelled: false },
  ];
  it('terbesar ≤ tanggal, yang dibatalkan dilewati', () => {
    expect(packageOn(packages, '2026-11-02')?.id).toBe(3);
    expect(packageOn(packages, '2026-11-26')?.id).toBe(4);
    expect(packageOn(packages, '2026-08-01')).toBeNull();
  });
  it('terjadwal = belum berlaku dan tidak dibatalkan', () => {
    expect(scheduledAfter(packages, '2026-11-02').map((p) => p.id)).toEqual([4]);
  });
});

describe('usulan dan promosi', () => {
  it('batas usulan hari ke-4 sesudah periode berakhir (tanggal 29)', () => {
    expect(proposalDeadline('2026-10-26')).toBe('2026-11-29');
    expect(proposalDeadline('2027-01-26')).toBe('2027-03-01');
  });
  it('Gaji Standar Karyawan menggantikan komponen paket, komponen lain dibawa (GAJ-64)', () => {
    expect(promotionLines([pokok(1_800_000), { componentTypeId: 3, amount: 100_000 }], [pokok(2_400_000), tunjangan(200_000)]))
      .toEqual([pokok(2_400_000), tunjangan(200_000), { componentTypeId: 3, amount: 100_000 }]);
  });
});
