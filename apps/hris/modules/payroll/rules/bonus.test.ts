import { describe, expect, it } from 'vitest';
import { amountOf, baseOf, birthStatus, correctionsFor, fingerprint, reconcile, type Desired, type LiveEntry } from './bonus';

const desired = (over: Partial<NonNullable<Desired>> = {}): NonNullable<Desired> => ({
  employeeId: 1, status: 'PENDING', base: 85000, percent: 10, amount: 8500, occurredOn: '2026-10-28', posGroomerId: 7, ...over,
});
const live = (over: Partial<LiveEntry> = {}): LiveEntry => ({
  id: 1, kind: 'GROOMING', employeeId: 1, status: 'PENDING', amount: 8500, occurredOn: '2026-10-28', posGroomerId: 7, ...over,
});
const open = { periodLocked: false, decidedFingerprints: [] as string[] };

describe('nominal bonus (sama dengan laporan Grooming POS)', () => {
  it('jasa Rp85.000 → bonus 10% Rp8.500; ongkir Rp15.000 → 50% Rp7.500', () => {
    expect(amountOf(baseOf({ lineTotal: 85000, payableAmount: 85000, linesTotal: 85000 }), 10)).toBe(8500);
    expect(amountOf(baseOf({ lineTotal: 15000, payableAmount: 15000, linesTotal: 15000 }), 50)).toBe(7500);
  });
  it('diskon total nota dibagi sebanding sebelum dihitung bonusnya', () => {
    expect(baseOf({ lineTotal: 60000, payableAmount: 180000, linesTotal: 200000 })).toBe(54000);
  });
});

describe('status lahir dan hak penerima', () => {
  it('GM tidak pernah menerima; Pemilik hanya Grooming', () => {
    expect(birthStatus('GROOMING', { employeeId: 1, role: 'GM', eligibleFlag: true })).toBeNull();
    expect(birthStatus('DELIVERY', { employeeId: 1, role: 'OWNER', eligibleFlag: true })).toBeNull();
    expect(birthStatus('GROOMING', { employeeId: 1, role: 'OWNER', eligibleFlag: true })).toBe('PENDING');
  });
  it('di luar jabatan penerima → Ditahan; Ongkir lahir Disahkan', () => {
    expect(birthStatus('GROOMING', { employeeId: 1, role: 'STAFF', eligibleFlag: false })).toBe('HELD');
    expect(birthStatus('DELIVERY', { employeeId: 1, role: 'STAFF', eligibleFlag: true })).toBe('APPROVED');
  });
});

describe('penyamaan dengan data kasir', () => {
  it('baru → tulis; tidak berubah → tidak ada tulisan (idempoten)', () => {
    expect(reconcile(null, desired(), open)).toEqual({ kind: 'create' });
    expect(reconcile(live(), desired(), open)).toEqual({ kind: 'none' });
    expect(reconcile(null, null, open)).toEqual({ kind: 'none' });
  });
  it('sebelum disahkan: ganti groomer → batal + tulis ulang bertanda ⚠; ubah harga → bertanda berubah dari kasir', () => {
    expect(reconcile(live(), desired({ employeeId: 2, posGroomerId: 8 }), open)).toEqual({ kind: 'replace', flag: 'GROOMER_CHANGED' });
    expect(reconcile(live(), desired({ amount: 7000 }), open)).toEqual({ kind: 'replace', flag: 'CHANGED_FROM_POS' });
    expect(reconcile(live(), null, open)).toEqual({ kind: 'cancel' });
  });
  it('Ditahan menjadi Menunggu sesudah jabatan penerima diubah', () => {
    expect(reconcile(live({ status: 'HELD' }), desired(), open)).toEqual({ kind: 'status', status: 'PENDING' });
  });
  it('sesudah disahkan: masuk daftar periksa, kecuali keadaan itu sudah diputuskan', () => {
    const approved = live({ status: 'APPROVED' });
    expect(reconcile(approved, null, open)).toEqual({ kind: 'flag_change' });
    expect(reconcile(approved, null, { periodLocked: false, decidedFingerprints: [fingerprint(null)] })).toEqual({ kind: 'none' });
  });
  it('ongkir final hanya bila periodenya terkunci', () => {
    const delivery = live({ kind: 'DELIVERY', status: 'APPROVED' });
    expect(reconcile(delivery, null, open)).toEqual({ kind: 'cancel' });
    expect(reconcile(delivery, null, { periodLocked: true, decidedFingerprints: [] })).toEqual({ kind: 'flag_change' });
  });
  it('baris yang ditolak tidak dihidupkan lagi', () => {
    expect(reconcile(live({ status: 'REJECTED' }), desired({ amount: 9000 }), open)).toEqual({ kind: 'none' });
  });
});

describe('koreksi sesudah Terima perubahan', () => {
  it('batal di kasir → koreksi minus penuh', () => {
    expect(correctionsFor({ employeeId: 1, amount: 8500 }, null)).toEqual([{ employeeId: 1, amount: -8500 }]);
  });
  it('harga turun → koreksi minus selisih; ganti groomer → minus lama + plus baru', () => {
    expect(correctionsFor({ employeeId: 1, amount: 8500 }, desired({ amount: 7000 }))).toEqual([{ employeeId: 1, amount: -1500 }]);
    expect(correctionsFor({ employeeId: 1, amount: 8500 }, desired({ employeeId: 2 }))).toEqual([{ employeeId: 1, amount: -8500 }, { employeeId: 2, amount: 8500 }]);
  });
});
