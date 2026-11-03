import { describe, expect, it } from 'vitest';
import { revalueCause, sameValue, valueWage, weekStartOf } from './trip-wages';

const rate = { id: 7, driverWithAssistant: 110_000, assistant: 50_000, driverAlone: 160_000 };
const noAssistantPay = { id: 8, driverWithAssistant: 20_000, assistant: 0, driverAlone: 20_000 };

describe('menilai ritase (spec L7 §3.2)', () => {
  it('orang mingguan: tarif penuh menurut peran, tanpa melihat status hari', () => {
    expect(valueWage({ role: 'DRIVER', withAssistant: true, rate, payBasis: 'WEEKLY', dayStatus: 'PRESENT' }))
      .toMatchObject({ status: 'ACTIVE', amount: 110_000, rateAmount: 110_000, zeroReason: null, dayStatus: null, needsLook: false });
    expect(valueWage({ role: 'DRIVER', withAssistant: false, rate, payBasis: 'WEEKLY', dayStatus: null }).amount).toBe(160_000);
    expect(valueWage({ role: 'ASSISTANT', withAssistant: true, rate, payBasis: 'WEEKLY', dayStatus: null }).amount).toBe(50_000);
  });

  it('kenek Rp0 dari tarif → keterangan rute tanpa upah kenek', () => {
    expect(valueWage({ role: 'ASSISTANT', withAssistant: true, rate: noAssistantPay, payBasis: 'WEEKLY', dayStatus: null }))
      .toMatchObject({ amount: 0, zeroReason: 'NO_ASSISTANT_PAY', needsLook: false });
  });

  it('orang bulanan: libur/tutup penuh, hari kerja Rp0, izin dst. Rp0 + Perlu dilihat (DRV-16, U5)', () => {
    const v = (dayStatus: Parameters<typeof valueWage>[0]['dayStatus']) => valueWage({ role: 'ASSISTANT', withAssistant: true, rate, payBasis: 'MONTHLY', dayStatus });
    expect(v('DAY_OFF')).toMatchObject({ amount: 50_000, zeroReason: null });
    expect(v('CLOSED')).toMatchObject({ amount: 50_000, zeroReason: null });
    expect(v('PRESENT')).toMatchObject({ amount: 0, zeroReason: 'WORKDAY', needsLook: false });
    expect(v(null)).toMatchObject({ amount: 0, zeroReason: 'WORKDAY', needsLook: false });
    for (const s of ['PERMIT', 'SICK', 'LEAVE', 'ALPHA', 'UNDETERMINED'] as const) expect(v(s)).toMatchObject({ amount: 0, zeroReason: 'NOT_DAY_OFF', needsLook: true });
  });

  it('dua sebab Rp0 → sebab hari yang ditulis', () => {
    expect(valueWage({ role: 'ASSISTANT', withAssistant: true, rate: noAssistantPay, payBasis: 'MONTHLY', dayStatus: 'PRESENT' }).zeroReason).toBe('WORKDAY');
  });

  it('tanpa tarif → Belum bertarif Rp0', () => {
    expect(valueWage({ role: 'DRIVER', withAssistant: true, rate: null, payBasis: 'WEEKLY', dayStatus: null }))
      .toMatchObject({ status: 'UNRATED', amount: 0, rateId: null });
  });

  it('sebab penilaian ulang dan kesamaan nilai', () => {
    const before = valueWage({ role: 'DRIVER', withAssistant: true, rate: null, payBasis: 'WEEKLY', dayStatus: null });
    const after = valueWage({ role: 'DRIVER', withAssistant: true, rate, payBasis: 'WEEKLY', dayStatus: null });
    expect(revalueCause(before, after, (s) => s)).toBe('tarif pasangan ini sudah diisi');
    expect(revalueCause(after, { ...after, rateId: 9, rateAmount: 100_000, amount: 100_000 }, (s) => s)).toBe('tarif dibetulkan');
    expect(sameValue(after, { ...after })).toBe(true);
  });

  it('minggu upah Jumat–Kamis', () => {
    expect(weekStartOf('2026-10-30')).toBe('2026-10-30');
    expect(weekStartOf('2026-11-05')).toBe('2026-10-30');
    expect(weekStartOf('2026-11-06')).toBe('2026-11-06');
  });
});
