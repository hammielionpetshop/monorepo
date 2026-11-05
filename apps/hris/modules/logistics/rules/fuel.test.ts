import { describe, expect, it } from 'vitest';
import { amountProblem, canChangeFill, fuelPeriod, noRequestReason } from './fuel';

describe('aturan bensin (spec LT1 §17.1)', () => {
  it('nominal harus bilangan bulat positif dan tidak berlebihan', () => {
    expect(amountProblem(300_000)).toBeNull();
    expect(amountProblem(0)).not.toBeNull();
    expect(amountProblem(-5)).not.toBeNull();
    expect(amountProblem(1.5)).not.toBeNull();
    expect(amountProblem(Number.NaN)).not.toBeNull();
    expect(amountProblem(20_000_000)).not.toBeNull();
  });

  it('alasan tanpa permintaan: baku atau ketikan paling sedikit 5 huruf', () => {
    expect(noRequestReason('FORGOT', null)).toEqual({ ok: true, value: 'Driver lupa minta' });
    expect(noRequestReason('OTHER', '  isi di jalan tol ')).toEqual({ ok: true, value: 'isi di jalan tol' });
    expect(noRequestReason('OTHER', 'abc').ok).toBe(false);
    expect(noRequestReason(null, 'apa saja panjang').ok).toBe(false);
  });

  it('periode 26–25 termasuk pergantian tahun', () => {
    expect(fuelPeriod('2026-11-05')).toEqual({ from: '2026-10-26', to: '2026-11-25' });
    expect(fuelPeriod('2026-11-25')).toEqual({ from: '2026-10-26', to: '2026-11-25' });
    expect(fuelPeriod('2026-11-26')).toEqual({ from: '2026-11-26', to: '2026-12-25' });
    expect(fuelPeriod('2026-12-30')).toEqual({ from: '2026-12-26', to: '2027-01-25' });
    expect(fuelPeriod('2027-01-10')).toEqual({ from: '2026-12-26', to: '2027-01-25' });
  });

  it('ubah / batal hanya pencatat atau Pemilik/GM', () => {
    expect(canChangeFill({ recordedByAccountId: 7 }, { accountId: 7, fullAccess: false })).toBe(true);
    expect(canChangeFill({ recordedByAccountId: 7 }, { accountId: 8, fullAccess: false })).toBe(false);
    expect(canChangeFill({ recordedByAccountId: 7 }, { accountId: 8, fullAccess: true })).toBe(true);
  });
});
