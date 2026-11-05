import { describe, expect, it } from 'vitest';
import { cashAfterCorrection, selfCorrectProblem } from './self-delivery-office';

describe('koreksi cara bayar antar sendiri (spec LT1 §15.4 butir 2)', () => {
  it('selama berjalan hanya PJ; sesudah Foto 3 hanya pemegang hak kantor yang bukan PJ', () => {
    expect(selfCorrectProblem({ running: true, isPj: true, canManage: false })).toBeNull();
    expect(selfCorrectProblem({ running: true, isPj: false, canManage: true })).toMatch(/PJ-nya sendiri/);
    expect(selfCorrectProblem({ running: false, isPj: true, canManage: false })).toMatch(/Kepala Toko/);
    expect(selfCorrectProblem({ running: false, isPj: true, canManage: true })).toMatch(/rekan atau atasan/);
    expect(selfCorrectProblem({ running: false, isPj: false, canManage: true })).toBeNull();
  });

  it('tunai dihitung ulang sesudah Foto 3; penerimaan laci dibuka lagi hanya bila sudah diterima dan jumlahnya berubah', () => {
    expect(cashAfterCorrection({ running: true, cashBefore: 0, cashAfter: 50000, received: false })).toEqual({ cash: 0, reopen: false });
    expect(cashAfterCorrection({ running: false, cashBefore: 190000, cashAfter: 150000, received: false })).toEqual({ cash: 150000, reopen: false });
    expect(cashAfterCorrection({ running: false, cashBefore: 150000, cashAfter: 200000, received: true })).toEqual({ cash: 200000, reopen: true });
    expect(cashAfterCorrection({ running: false, cashBefore: 150000, cashAfter: 150000, received: true })).toEqual({ cash: 150000, reopen: false });
    expect(cashAfterCorrection({ running: false, cashBefore: 150000, cashAfter: 0, received: true })).toEqual({ cash: 0, reopen: true });
  });
});
