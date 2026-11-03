import { describe, expect, it } from 'vitest';
import { alphabetical, computeUnloading, kgText, parseDecimal3, weightChangePercent, weightFlagged, workDateCheck } from './unloading';

// Hitung bongkaran (spec L8 §3.1; DRV-35, 43, 108).
const p = (key: string, name: string, order = 1) => ({ key, name, order });

describe('computeUnloading', () => {
  it('3 barang: 8.920 kg × Rp20 = Rp178.400 dibagi 4 orang rata', () => {
    const r = computeUnloading(
      [{ kind: 'PRODUCT', quantity: '200', weightKg: '25' }, { kind: 'PRODUCT', quantity: '160', weightKg: '20' }, { kind: 'PRODUCT', quantity: '96', weightKg: '7.5' }],
      [p('a', 'Andi'), p('b', 'Budi'), p('c', 'Dedi'), p('d', 'Eko')], 20,
    );
    expect(r.totalKg).toBe('8920.000');
    expect(r.totalPay).toBe(178_400);
    expect(r.shares.map((s) => s.amount)).toEqual([44_600, 44_600, 44_600, 44_600]);
  });

  it('kg baris dibulatkan 3 desimal setengah ke atas; total upah ke rupiah terdekat setengah ke atas', () => {
    const r = computeUnloading([{ kind: 'PRODUCT', quantity: '1.5', weightKg: '0.333' }, { kind: 'OTHER', kg: '0.0255' }], [p('a', 'Andi')], 20);
    expect(r.lineKg).toEqual(['0.500', '0.026']);
    expect(r.totalKg).toBe('0.526');
    expect(r.totalPay).toBe(11); // 10,52 → 11
    const half = computeUnloading([{ kind: 'OTHER', kg: '0.025' }], [p('a', 'Andi')], 20);
    expect(half.totalPay).toBe(1); // 0,5 → 1
  });

  it('sisa rupiah Rp1 per orang menurut abjad (huruf besar/kecil diabaikan); jumlah bagian = total', () => {
    const r = computeUnloading([{ kind: 'OTHER', kg: '5.05' }], [p('z', 'eko'), p('y', 'Budi'), p('x', 'andi')], 20); // Rp101
    expect(r.totalPay).toBe(101);
    const byKey = Object.fromEntries(r.shares.map((s) => [s.key, s]));
    expect(byKey.x).toMatchObject({ amount: 34, plusOne: true });
    expect(byKey.y).toMatchObject({ amount: 34, plusOne: true });
    expect(byKey.z).toMatchObject({ amount: 33, plusOne: false });
    expect(r.shares.reduce((s, x) => s + x.amount, 0)).toBe(101);
  });

  it('nama kembar: yang lebih dulu terdaftar mendapat sisa lebih dulu', () => {
    const r = computeUnloading([{ kind: 'OTHER', kg: '0.05' }], [p('late', 'Andi', 9), p('early', 'andi', 2)], 20); // Rp1
    expect(r.shares.find((s) => s.key === 'early')).toMatchObject({ amount: 1, plusOne: true });
    expect(r.shares.find((s) => s.key === 'late')).toMatchObject({ amount: 0 });
    expect(alphabetical([p('b', 'Budi'), p('a', 'andi')]).map((x) => x.key)).toEqual(['a', 'b']);
  });

  it('menolak isian tidak sah', () => {
    expect(() => computeUnloading([], [p('a', 'Andi')], 20)).toThrow(/barang/);
    expect(() => computeUnloading([{ kind: 'OTHER', kg: '1' }], [], 20)).toThrow(/peserta/);
    expect(() => computeUnloading([{ kind: 'OTHER', kg: '1' }], [p('a', 'A'), p('a', 'A')], 20)).toThrow(/sekali/);
    expect(() => computeUnloading([{ kind: 'OTHER', kg: '0.0004' }], [p('a', 'A')], 20)).toThrow(/lebih dari 0/);
  });
});

describe('isian dan tanggal', () => {
  it('parseDecimal3: > 0, paling banyak 3 desimal, koma boleh', () => {
    expect(parseDecimal3('12,5')).toBe('12.500');
    expect(parseDecimal3(25)).toBe('25.000');
    expect(parseDecimal3('0')).toBeNull();
    expect(parseDecimal3('1.2345')).toBeNull();
    expect(parseDecimal3('-1')).toBeNull();
  });

  it('kgText memakai pemisah Indonesia', () => {
    expect(kgText('8960.000')).toBe('8.960');
    expect(kgText('12.500')).toBe('12,5');
  });

  it('tanggal kerja: masa depan ditolak; mundur > batas = terlambat (dihitung dari hari dasar)', () => {
    expect(workDateCheck('2026-11-05', '2026-11-04', '2026-11-04', 3).problem).toMatch(/sesudah hari ini/);
    expect(workDateCheck('2026-11-01', '2026-11-04', '2026-11-04', 3)).toEqual({ problem: null, late: false });
    expect(workDateCheck('2026-10-31', '2026-11-04', '2026-11-04', 3)).toEqual({ problem: null, late: true });
    expect(workDateCheck('2026-10-31', '2026-11-02', '2026-11-04', 3)).toEqual({ problem: null, late: false });
  });

  it('beda berat: ditandai bila lebih dari ambang', () => {
    expect(weightChangePercent('25.000', '27.500')).toBe('10.00');
    expect(weightFlagged('25.000', '27.500', 10)).toBe(false);
    expect(weightFlagged('25.000', '27.600', 10)).toBe(true);
    expect(weightFlagged(null, '27.600', 10)).toBe(false);
  });

});
