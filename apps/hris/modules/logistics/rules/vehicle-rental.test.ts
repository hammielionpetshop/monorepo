import { describe, expect, it } from 'vitest';
import { canCancelPayment, monthPayable, monthRange, payProblem, paymentState, rentalRecap, type PaymentRecord } from './vehicle-rental';

const rate = (id: number, effectiveFrom: string, amount: number, status = 'ACTIVE') => ({ id, vehicleId: 1, effectiveFrom, amount, status });
const trip = (id: number, tripDate: string, status = 'DONE') => ({ id, number: `T-${id}`, tripDate, status });
const manual = (id: number, tripDate: string, role = 'DRIVER', cancelled = false) => ({ id, tripDate, role, kind: 'RITASE', cancelled });

describe('hitung ritase sewa (spec F2-5 §3.2)', () => {
  it('hanya trip Selesai yang dihitung; Batal, Draft, Berjalan tidak', () => {
    const recap = rentalRecap({
      vehicleId: 1, rates: [rate(1, '2026-10-01', 150_000)], manual: [],
      trips: [trip(1, '2026-10-02'), trip(2, '2026-10-03', 'CANCELLED'), trip(3, '2026-10-04', 'DRAFT'), trip(4, '2026-10-05', 'RUNNING')],
    });
    expect(recap.tripCount).toBe(1);
    expect(recap.total).toBe(150_000);
  });

  it('trip dengan driver + kenek tetap 1 ritase (dihitung per trip, bukan per orang)', () => {
    const recap = rentalRecap({ vehicleId: 1, rates: [rate(1, '2026-10-01', 150_000)], manual: [], trips: [trip(1, '2026-10-02'), trip(2, '2026-10-02')] });
    expect(recap.tripCount).toBe(2);
    expect(recap.lines.map((l) => l.tripNumber)).toEqual(['T-1', 'T-2']);
  });

  it('ritase tangan Driver dihitung, Kenek dan yang batal tidak', () => {
    const recap = rentalRecap({
      vehicleId: 1, rates: [rate(1, '2026-10-01', 150_000)], trips: [],
      manual: [manual(1, '2026-10-07'), manual(2, '2026-10-07', 'ASSISTANT'), manual(3, '2026-10-08', 'DRIVER', true), { ...manual(4, '2026-10-09'), kind: 'SHOPPING' }],
    });
    expect(recap.tripCount).toBe(1);
    expect(recap.lines[0]).toMatchObject({ manualId: 1, tripId: null, amount: 150_000 });
  });

  it('tarif naik di tengah bulan: trip lama tetap tarif lama', () => {
    const recap = rentalRecap({
      vehicleId: 1, manual: [], trips: [trip(1, '2026-10-10'), trip(2, '2026-10-20')],
      rates: [rate(1, '2026-10-01', 150_000), rate(2, '2026-10-15', 175_000), rate(3, '2026-10-12', 999_000, 'CANCELLED')],
    });
    expect(recap.lines.map((l) => l.rate)).toEqual([150_000, 175_000]);
    expect(recap.total).toBe(325_000);
  });

  it('tanggal tanpa tarif ditandai belum bertarif dan Bayar ditolak', () => {
    const recap = rentalRecap({ vehicleId: 1, manual: [], trips: [trip(1, '2026-10-02'), trip(2, '2026-10-20')], rates: [rate(1, '2026-10-15', 150_000)] });
    expect(recap.unratedDates).toEqual(['2026-10-02']);
    expect(recap.total).toBe(150_000);
    const state = paymentState(recap.total, []);
    expect(payProblem({
      month: '2026-10', today: '2026-11-11', occurredOn: '2026-11-11', amount: 150_000, differenceReason: null, unratedDates: recap.unratedDates,
      next: state.next, kind: 'PAYMENT',
    })).toMatch(/belum bertarif/);
  });
});

const pay = (id: number, kind: 'PAYMENT' | 'TOP_UP', amount: number, billedAmount: number, cancelled = false): PaymentRecord => ({
  id, kind, amount, billedAmount, cancelled, paidAt: new Date(Date.UTC(2026, 10, id)),
});
const base = { month: '2026-10', today: '2026-11-11', occurredOn: '2026-11-11', differenceReason: null, unratedDates: [] as string[] };

describe('bayar sewa mobil (spec F2-5 §3.3)', () => {
  it('bulan berjalan ditolak, bulan lewat boleh', () => {
    expect(monthPayable('2026-11', '2026-11-30')).toBe(false);
    expect(monthPayable('2026-10', '2026-11-01')).toBe(true);
    const state = paymentState(300_000, []);
    expect(payProblem({ ...base, month: '2026-11', amount: 300_000, next: state.next, kind: 'PAYMENT' })).toMatch(/1 Desember 2026/);
  });

  it('jumlah beda tanpa alasan ditolak, dengan alasan diterima', () => {
    const state = paymentState(300_000, []);
    expect(state.next).toEqual({ kind: 'PAYMENT', due: 300_000 });
    expect(payProblem({ ...base, amount: 250_000, next: state.next, kind: 'PAYMENT' })).toMatch(/alasan/);
    expect(payProblem({ ...base, amount: 250_000, differenceReason: 'Potong lebih bayar September', next: state.next, kind: 'PAYMENT' })).toBeNull();
    expect(payProblem({ ...base, amount: 300_000, next: state.next, kind: 'PAYMENT' })).toBeNull();
  });

  it('rekap bertambah sesudah dibayar → kurang Rp150.000, Bayar susulan', () => {
    const state = paymentState(450_000, [pay(1, 'PAYMENT', 300_000, 300_000)]);
    expect(state).toMatchObject({ paid: 300_000, remaining: 150_000, changeAfterPaid: 150_000, next: { kind: 'TOP_UP', due: 150_000 } });
    expect(payProblem({ ...base, amount: 150_000, next: state.next, kind: 'PAYMENT' })).toMatch(/sudah dibayar/);
    expect(payProblem({ ...base, amount: 150_000, next: state.next, kind: 'TOP_UP' })).toBeNull();
    const after = paymentState(450_000, [pay(1, 'PAYMENT', 300_000, 300_000), pay(2, 'TOP_UP', 150_000, 450_000)]);
    expect(after).toMatchObject({ paid: 450_000, remaining: 0, changeAfterPaid: 0, next: null });
  });

  it('rekap berkurang sesudah dibayar → lebih bayar, tanpa tombol', () => {
    const state = paymentState(150_000, [pay(1, 'PAYMENT', 300_000, 300_000)]);
    expect(state).toMatchObject({ changeAfterPaid: -150_000, remaining: -150_000, next: null });
  });

  it('bayar kurang dengan alasan tidak memunculkan selisih selama rekap tetap', () => {
    const state = paymentState(300_000, [pay(1, 'PAYMENT', 250_000, 300_000)]);
    expect(state).toMatchObject({ changeAfterPaid: 0, remaining: 50_000, next: null });
  });

  it('pembayaran batal tidak dihitung', () => {
    const state = paymentState(300_000, [pay(1, 'PAYMENT', 300_000, 300_000, true)]);
    expect(state).toMatchObject({ paid: 0, hasPayment: false, next: { kind: 'PAYMENT', due: 300_000 } });
  });

  it('batal: pembayar sendiri di hari yang sama, sesudahnya Pemilik/GM', () => {
    const c = { paidByAccountId: 7, paidOn: '2026-11-11', today: '2026-11-11' };
    expect(canCancelPayment({ ...c, actorAccountId: 7, ownerOrGm: false })).toBe(true);
    expect(canCancelPayment({ ...c, actorAccountId: 8, ownerOrGm: false })).toBe(false);
    expect(canCancelPayment({ ...c, today: '2026-11-12', actorAccountId: 7, ownerOrGm: false })).toBe(false);
    expect(canCancelPayment({ ...c, today: '2026-11-12', actorAccountId: 8, ownerOrGm: true })).toBe(true);
  });

  it('rentang bulan', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2026-13')).toBeNull();
  });
});
