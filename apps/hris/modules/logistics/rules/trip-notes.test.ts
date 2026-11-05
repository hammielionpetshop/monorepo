import { describe, expect, it } from 'vitest';
import { queueOf } from './delivery-notes';
import { kasirChange, kasirChangeKey, kasirChangeText, noteKey, parseNoteKey, pickupOrigins, planVisits, tripNotesProblem, type PlannedNote } from './trip-notes';

const note = (key: string, origin: number, customerId: number | null, branchId: number | null = null): PlannedNote => ({
  key: key as PlannedNote['key'], originBranchId: origin, origin: `Cabang ${origin}`, customerId, destinationBranchId: branchId,
  destination: customerId ? `Toko ${customerId}` : `Cabang ${branchId}`,
});

describe('kunci surat jalan', () => {
  it('nota = S, PO Internal = T; kunci asing ditolak', () => {
    expect(noteKey('SALE', 12)).toBe('S12');
    expect(parseNoteKey('T7')).toEqual({ kind: 'TRANSFER', docId: 7 });
    for (const bad of ['X1', 'S0', 'S', 'S-1', 'S1;drop', 'S12345678901']) expect(parseNoteKey(bad)).toBeNull();
  });
});

describe('kunjungan dan ambil barang', () => {
  it('satu tujuan satu kunjungan; PO Internal ke cabang terpisah dari toko', () => {
    const visits = planVisits([note('S1', 1, 10), note('S2', 2, 10), note('S3', 1, 11), note('T1', 1, null, 3)]);
    expect(visits.map((v) => [v.destination, v.keys])).toEqual([['Toko 10', ['S1', 'S2']], ['Toko 11', ['S3']], ['Cabang 3', ['T1']]]);
  });

  it('ambil barang hanya di cabang asal selain Gudang; Gudang tak diketahui = semua cabang', () => {
    const notes = [note('S1', 1, 10), note('S2', 2, 10), note('S3', 2, 11)];
    expect(pickupOrigins(notes, 1)).toEqual([{ originBranchId: 2, origin: 'Cabang 2' }]);
    expect(pickupOrigins(notes, null).map((o) => o.originBranchId)).toEqual([1, 2]);
  });

  it('trip bersurat jalan wajib rute kirim', () => {
    expect(tripNotesProblem(null, 1)).toMatch(/rute kirim/);
    expect(tripNotesProblem(null, 0)).toBeNull();
    expect(tripNotesProblem(5, 3)).toBeNull();
  });
});

describe('berubah di kasir sesudah masuk trip', () => {
  it('batal, menunggu batal, nominal berubah, tidak berubah', () => {
    expect(kasirChange({ amount: 100, revision: 1 }, { amount: 100, revision: 1, status: 'VOIDED' })).toEqual({ kind: 'cancelled', pending: false });
    expect(kasirChange({ amount: 100, revision: 1 }, { amount: 100, revision: 1, status: 'PENDING_VOID' })).toEqual({ kind: 'cancelled', pending: true });
    expect(kasirChange({ amount: 100, revision: 1 }, { amount: 90, revision: 2, status: 'COMPLETED' })).toEqual({ kind: 'changed', from: 100, to: 90 });
    expect(kasirChange({ amount: 100, revision: 1 }, { amount: 100, revision: 2, status: 'COMPLETED' })).toEqual({ kind: 'changed', from: 100, to: 100 });
    expect(kasirChange({ amount: 100, revision: 1 }, { amount: 100, revision: 1, status: 'COMPLETED' })).toBeNull();
    expect(kasirChange({ amount: null, revision: null }, { amount: null, revision: null, status: 'IN_TRANSIT' })).toBeNull();
    expect(kasirChange({ amount: null, revision: null }, { amount: null, revision: null, status: 'CANCELLED' })).toEqual({ kind: 'cancelled', pending: false });
  });
});

describe('tab antrean dari status kasir + HRIS', () => {
  it('nota', () => {
    expect(queueOf('SALE', 'COMPLETED', null)).toEqual({ status: 'WAITING', pendingVoid: false });
    expect(queueOf('SALE', 'COMPLETED', 'ON_TRIP')).toEqual({ status: 'ON_TRIP', pendingVoid: false });
    expect(queueOf('SALE', 'VOIDED', 'ON_TRIP')).toEqual({ status: 'CANCELLED', pendingVoid: false });
    expect(queueOf('SALE', 'PENDING_VOID', null)).toEqual({ status: 'CANCELLED', pendingVoid: true });
    expect(queueOf('SALE', 'COMPLETED', 'DELIVERED')).toEqual({ status: 'DELIVERED', pendingVoid: false }); // LT1b-2a: tab Terkirim
  });

  it('PO Internal', () => {
    expect(queueOf('TRANSFER', 'IN_TRANSIT', 'WAITING')).toEqual({ status: 'WAITING', pendingVoid: false });
    expect(queueOf('TRANSFER', 'IN_TRANSIT', 'ON_TRIP')).toEqual({ status: 'ON_TRIP', pendingVoid: false });
    expect(queueOf('TRANSFER', 'FULLY_RECEIVED', 'ON_TRIP')).toEqual({ status: 'RECEIVED', pendingVoid: false });
    expect(queueOf('TRANSFER', 'CANCELLED', null)).toEqual({ status: 'CANCELLED', pendingVoid: false });
    expect(queueOf('TRANSFER', 'DRAFT', null)).toBeNull();
  });
});

describe('kasirChangeKey / kasirChangeText (spec LT1 §14.3)', () => {
  const money = (n: number) => `Rp${n}`;
  it('penanda berbeda per nominal + revisi; batal dan menunggu batal terpisah', () => {
    expect(kasirChangeKey(null, 2)).toBeNull();
    expect(kasirChangeKey({ kind: 'changed', from: 100, to: 90 }, 2)).toEqual({ kind: 'CHANGED', signature: 'CHANGED:90:2' });
    expect(kasirChangeKey({ kind: 'changed', from: 100, to: 90 }, 3)?.signature).toBe('CHANGED:90:3');
    expect(kasirChangeKey({ kind: 'cancelled', pending: true }, 1)).toEqual({ kind: 'PENDING_CANCEL', signature: 'PENDING_CANCEL' });
    expect(kasirChangeKey({ kind: 'cancelled', pending: false }, 1)).toEqual({ kind: 'CANCELLED', signature: 'CANCELLED' });
  });
  it('kalimat pemberitahuan', () => {
    expect(kasirChangeText('TRX-1', { kind: 'changed', from: 100, to: 90 }, money)).toBe('TRX-1 berubah di kasir Rp100 → Rp90');
    expect(kasirChangeText('TRX-1', { kind: 'changed', from: 100, to: 100 }, money)).toBe('TRX-1 dikoreksi di kasir (nominal tetap Rp100)');
    expect(kasirChangeText('TRX-1', { kind: 'cancelled', pending: true }, money)).toBe('TRX-1 menunggu batal di kasir');
    expect(kasirChangeText('TRX-1', { kind: 'cancelled', pending: false }, money)).toBe('TRX-1 dibatalkan di kasir');
  });
});
