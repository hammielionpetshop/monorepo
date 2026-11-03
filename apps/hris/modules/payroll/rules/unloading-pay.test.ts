import { describe, expect, it } from 'vitest';
import { correctionDelta, offsetShare, overpaymentRemaining, payerProblem } from './unloading-pay';

// Bayar Bongkaran (spec L8 §3.4–3.5; DRV-111, 116, 118).
describe('lebih bayar diperhitungkan', () => {
  it('paling lama lebih dulu, sampai habis atau bagian Rp0', () => {
    const open = [{ id: 2, remaining: 3000, createdAt: '2026-11-03T00:00:00Z' }, { id: 1, remaining: 1500, createdAt: '2026-11-01T00:00:00Z' }];
    expect(offsetShare(4000, open)).toEqual({ offset: 4000, received: 0, uses: [{ id: 1, amount: 1500 }, { id: 2, amount: 2500 }] });
    expect(offsetShare(10_000, open)).toEqual({ offset: 4500, received: 5500, uses: [{ id: 1, amount: 1500 }, { id: 2, amount: 3000 }] });
    expect(offsetShare(0, open).offset).toBe(0);
  });

  it('sisa = nominal − pemakaian berlaku', () => {
    expect(overpaymentRemaining(5000, [{ amount: 2000, active: true }, { amount: 1000, active: false }])).toBe(3000);
    expect(overpaymentRemaining(5000, [{ amount: 6000, active: true }])).toBe(0);
  });
});

describe('selisih bongkaran', () => {
  it('minus → lebih bayar; nol → tidak ada apa-apa', () => {
    expect(correctionDelta({ next: 42_300, credited: 44_800, sameReportOpen: [] })).toEqual({ topUp: 0, overpay: 2500, reduce: [] });
    expect(correctionDelta({ next: 100, credited: 100, sameReportOpen: [] })).toEqual({ topUp: 0, overpay: 0, reduce: [] });
  });

  it('plus → kurangi dulu sisa lebih bayar laporan yang sama, sisanya susulan', () => {
    const open = [{ id: 7, remaining: 2500, createdAt: '2026-11-03T00:00:00Z' }];
    expect(correctionDelta({ next: 46_000, credited: 42_300, sameReportOpen: open })).toEqual({ topUp: 1200, overpay: 0, reduce: [{ id: 7, amount: 2500 }] });
    expect(correctionDelta({ next: 43_000, credited: 42_300, sameReportOpen: open })).toEqual({ topUp: 0, overpay: 0, reduce: [{ id: 7, amount: 700 }] });
  });

  it('batal sesudah dibayar = semua bagian baru Rp0', () => {
    expect(correctionDelta({ next: 0, credited: 44_800, sameReportOpen: [] })).toEqual({ topUp: 0, overpay: 44_800, reduce: [] });
  });
});

describe('pembayar', () => {
  it('bukan peserta dan bukan pembuat; Pemilik/GM boleh dengan tanda', () => {
    expect(payerProblem({ fullAccess: false, isParticipant: true, isCreator: false }).problem).toMatch(/Peserta/);
    expect(payerProblem({ fullAccess: false, isParticipant: false, isCreator: true }).problem).toMatch(/Pembuat/);
    expect(payerProblem({ fullAccess: true, isParticipant: true, isCreator: false })).toEqual({ problem: null, ownerFlag: true });
    expect(payerProblem({ fullAccess: false, isParticipant: false, isCreator: false })).toEqual({ problem: null, ownerFlag: false });
  });
});
