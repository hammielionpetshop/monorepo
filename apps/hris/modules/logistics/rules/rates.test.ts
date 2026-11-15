import { describe, expect, it } from 'vitest';
import { amountFor, changeKind, earliestFrom, numbersProblem, rateOnDate, rateState, unratedMessage } from './rates';

const n = (driverWithAssistant: number, assistant: number, driverAlone: number) => ({ driverWithAssistant, assistant, driverAlone });
const row = (id: number, effectiveFrom: string, status = 'ACTIVE', numbers = n(90_000, 40_000, 130_000)) => ({ id, vehicleId: 1, routeId: 2, effectiveFrom, status, ...numbers });

describe('tarif ritase (spec L7 §3.1)', () => {
  it('tarif pada tanggal = baris ACTIVE berlaku dari ≤ tanggal yang paling akhir', () => {
    const rows = [row(1, '2026-10-30'), row(2, '2026-11-10'), row(3, '2026-11-05', 'CANCELLED'), { ...row(4, '2026-11-01'), routeId: 9 }];
    expect(rateOnDate(rows, 1, 2, '2026-10-29')).toBeNull();
    expect(rateOnDate(rows, 1, 2, '2026-11-06')?.id).toBe(1);
    expect(rateOnDate(rows, 1, 2, '2026-11-10')?.id).toBe(2);
    expect(rateOnDate(rows, 1, 9, '2026-11-02')?.id).toBe(4);
  });

  it('baris betulan menggantikan baris FIXED pada tanggal yang sama', () => {
    const rows = [row(1, '2026-10-30', 'FIXED', n(90_000, 400_000, 130_000)), row(2, '2026-10-30')];
    expect(rateOnDate(rows, 1, 2, '2026-11-02')?.id).toBe(2);
  });

  it('angka per peran: driver ada kenek, driver tanpa kenek, kenek', () => {
    const rate = n(135_000, 50_000, 185_000);
    expect(amountFor(rate, 'DRIVER', true)).toBe(135_000);
    expect(amountFor(rate, 'DRIVER', false)).toBe(185_000);
    expect(amountFor(rate, 'ASSISTANT', true)).toBe(50_000);
  });

  it('jarak berlaku: pasangan baru hari ini, naik/sama besok, ada yang turun 7 hari', () => {
    const today = '2026-11-03';
    expect(earliestFrom(changeKind(null, n(1, 0, 1)), today)).toBe(today);
    expect(earliestFrom(changeKind(n(90_000, 40_000, 130_000), n(95_000, 40_000, 135_000)), today)).toBe('2026-11-04');
    expect(earliestFrom(changeKind(n(90_000, 40_000, 130_000), n(95_000, 30_000, 135_000)), today)).toBe('2026-11-10');
  });

  it('angka harus rupiah bulat ≥ 0; Rp0 kenek boleh', () => {
    expect(numbersProblem(n(20_000, 0, 20_000))).toBeNull();
    expect(numbersProblem(n(-1, 0, 0))).toMatch(/minus/);
    expect(numbersProblem(n(1.5, 0, 0))).toMatch(/bulat/);
  });

  it('keadaan riwayat: Berlaku, Terjadwal, Digantikan, Dibatalkan, Dibetulkan', () => {
    const today = '2026-11-03';
    expect(rateState(row(1, '2026-10-30'), 1, today)).toBe('IN_FORCE');
    expect(rateState(row(2, '2026-10-01'), 1, today)).toBe('REPLACED');
    expect(rateState(row(3, '2026-11-10'), 1, today)).toBe('SCHEDULED');
    expect(rateState(row(4, '2026-11-10', 'CANCELLED'), 1, today)).toBe('CANCELLED');
    expect(rateState(row(5, '2026-10-30', 'FIXED'), 1, today)).toBe('FIXED');
  });

  it('pesan belum bertarif menyebut pasangan dan tempat mengisinya', () => {
    expect(unratedMessage(['L300 ke Cirebon', 'L300 ke Aina PS'], '2026-11-03'))
      .toBe('L300 ke Cirebon dan L300 ke Aina PS belum punya tarif pada 3 November 2026. Minta Pemilik atau GM mengisinya di Pengaturan › Tarif Ritase.');
  });
});
