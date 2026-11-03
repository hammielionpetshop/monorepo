import { describe, expect, it } from 'vitest';
import { LINE_LABELS, type PayLine } from './attendance-pay';
import { attendanceInputs, buildSlip, closeOpensAt, closeWindowOpen, fundMovements, holdsFrom, slipNumber, type DeductionInput, type IncomeInput } from './payslip';

const income = (sourceKey: string, lineKind: string, amount: number, extra: Partial<IncomeInput> = {}): IncomeInput =>
  ({ sourceKey, lineKind, label: lineKind, amount, originPeriod: null, details: {}, ...extra });
const deduction = (group: DeductionInput['group'], sourceKey: string, lineKind: string, amount: number, extra: Partial<DeductionInput> = {}): DeductionInput =>
  ({ group, sourceKey, lineKind, label: lineKind, date: '2026-11-01', amount, originPeriod: null, details: {}, ...extra });

describe('slip L4e-1 (spec L4e §3)', () => {
  it('pendapatan dan potongan kehadiran dipisah dari hasil Hitungan Kehadiran; baris Rp0 tidak ikut', () => {
    const lines: PayLine[] = [
      { key: 'BASE', sign: 1, amount: 3_000_000, details: [] },
      { key: 'OVERTIME', sign: 1, amount: 0, details: [] },
      { key: 'LATE', sign: -1, amount: 12_000, details: [{ workDate: '2026-11-02', text: 'Telat 12 menit', amount: 12_000, full: 12_000, note: null, waive: null, waived: false }] },
    ];
    const r = attendanceInputs(lines, '2026-10-26', LINE_LABELS);
    expect(r.income.map((i) => i.sourceKey)).toEqual(['att:BASE']);
    expect(r.deductions).toEqual([expect.objectContaining({ group: 'a', sourceKey: 'att:LATE', amount: 12_000 })]);
    expect(r.deductions[0].details.days).toHaveLength(1);
  });

  it('bersih tidak pernah minus; jumlah baris = bersih; sisa dibawa dari kelompok terakhir', () => {
    const r = buildSlip(
      [income('att:BASE', 'BASE', 1_000_000), income('bonus:x', 'GROOMING', 50_000)],
      [deduction('a', 'att:LATE', 'LATE', 300_000), deduction('c', 'other:1', 'OTHER', 900_000), deduction('b', 'loss:1', 'LOSS', 200_000)],
    );
    expect(r.income).toBe(1_050_000);
    expect(r.net).toBe(0);
    expect(r.taken).toBe(1_050_000);
    expect(r.carried).toBe(350_000);
    const totalIncome = r.lines.filter((l) => l.section === 'INCOME').reduce((s, l) => s + l.amount, 0);
    const totalTaken = r.lines.filter((l) => l.section === 'DEDUCTION').reduce((s, l) => s + l.taken, 0);
    expect(totalIncome - totalTaken).toBe(r.net);
    expect(r.lines.find((l) => l.sourceKey === 'other:1')).toMatchObject({ taken: 550_000, remaining: 350_000 });
  });

  it('sisa dari slip sebelumnya diambil lebih dulu di kelompoknya', () => {
    const r = buildSlip([income('att:BASE', 'BASE', 100_000)], [
      deduction('c', 'other:2', 'OTHER', 80_000, { date: '2026-10-01' }),
      deduction('c', 'carry:9', 'OTHER', 50_000, { carried: true, date: '2026-11-01' }),
    ]);
    expect(r.lines.find((l) => l.sourceKey === 'carry:9')).toMatchObject({ taken: 50_000, remaining: 0 });
    expect(r.lines.find((l) => l.sourceKey === 'other:2')).toMatchObject({ taken: 50_000, remaining: 30_000 });
  });

  it('nomor slip memakai bulan akhir periode dan urut 4 angka', () => {
    expect(slipNumber('2026-10-26', 1)).toBe('SB-202611-0001');
    expect(slipNumber('2026-12-26', 12)).toBe('SB-202701-0012');
  });

  it('jendela tutup: tanggal 29 pukul 00.00 WIB; mode uji membuka lebih awal', () => {
    expect(closeOpensAt('2026-10-26', 29).toISOString()).toBe('2026-11-28T17:00:00.000Z');
    expect(closeWindowOpen('2026-10-26', 29, new Date('2026-11-28T16:59:59Z'), false)).toBe(false);
    expect(closeWindowOpen('2026-10-26', 29, new Date('2026-11-28T17:00:00Z'), false)).toBe(true);
    expect(closeWindowOpen('2026-10-26', 29, new Date('2026-11-10T00:00:00Z'), true)).toBe(true);
  });

  it('mutasi dana sebesar yang benar-benar terpotong (termasuk sisa jenis telat) dan yang dibayar', () => {
    const r = buildSlip(
      [income('att:BASE', 'BASE', 500_000), income('att:OVERTIME', 'OVERTIME', 40_000), income('bonus:df', 'TYPED', 30_000, { details: { fund: 'DISCIPLINE_FUND' } })],
      [deduction('a', 'att:LATE', 'LATE', 20_000), deduction('a', 'carry:3', 'FINE', 10_000, { carried: true }), deduction('a', 'att:ALPHA', 'ALPHA', 600_000)],
    );
    // Pendapatan 570.000: sisa denda 10.000 dulu, telat 20.000, alpha hanya 540.000 terpotong.
    expect(fundMovements(r.lines, 'SB-1')).toEqual([
      { fund: 'DISCIPLINE', amount: 30_000, reason: expect.any(String) },
      { fund: 'DISCIPLINE', amount: -30_000, reason: expect.any(String) },
      { fund: 'ABSENCE', amount: 540_000, reason: expect.any(String) },
      { fund: 'ABSENCE', amount: -40_000, reason: expect.any(String) },
    ]);
  });

  it('penahan: hanya urusan Kehadiran yang menunggu dan belum ada gaji', () => {
    expect(holdsFrom({ outsideReviews: [], clarifications: [], overtimeClaims: [] }, true, 5)).toEqual([]);
    const holds = holdsFrom({ outsideReviews: ['2026-11-04', '2026-11-02'], clarifications: [], overtimeClaims: ['2026-11-05'] }, false, 5);
    expect(holds.map((h) => h.kind)).toEqual(['OUTSIDE_REVIEW', 'OVERTIME_CLAIM', 'NO_SALARY']);
    expect(holds[0].since).toBe('2026-11-02');
    expect(holds[2].link).toBe('/gaji/5');
  });
});
