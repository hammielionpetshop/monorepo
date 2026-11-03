import { describe, expect, it } from 'vitest';
import { freeBonusProblem } from './bonus';
import { disciplineShortfall, estimateOf, fundChangeProblem, fundState } from './funds';

const REASON = 'Penyesuaian saldo sesuai catatan kas';

describe('L4d-2: Dana Disiplin & Dana Tidak Hadir', () => {
  it('Saldo = jumlah mutasi, Terpesan dari bonus, Tersedia = Saldo − Terpesan', () => {
    const s = fundState([{ fund: 'DISCIPLINE', amount: 500_000 }, { fund: 'DISCIPLINE', amount: -50_000 }, { fund: 'ABSENCE', amount: 200_000 }], 300_000);
    expect(s.discipline).toEqual({ balance: 450_000, reserved: 300_000, available: 150_000, hasEntries: true });
    expect(s.absence).toEqual({ balance: 200_000, hasEntries: true });
  });

  it('pagar Tersedia menyebut kekurangannya', () => {
    expect(disciplineShortfall(300_000, 300_000)).toBeNull();
    expect(disciplineShortfall(300_000, 500_000)).toBe('Dana Disiplin tersedia Rp300.000; bonus ini Rp500.000; kurang Rp200.000.');
    expect(disciplineShortfall(-10_000, 5_000)).toContain('tersedia Rp0');
  });

  it('saldo awal sekali per dana, sebelum mutasi lain', () => {
    const empty = fundState([], 0);
    expect(fundChangeProblem({ kind: 'OPENING', fund: 'DISCIPLINE', amount: 100_000 }, empty, REASON)).toBeNull();
    const filled = fundState([{ fund: 'DISCIPLINE', amount: 100_000 }], 0);
    expect(fundChangeProblem({ kind: 'OPENING', fund: 'DISCIPLINE', amount: 100_000 }, filled, REASON)).toContain('sudah punya mutasi');
    expect(fundChangeProblem({ kind: 'OPENING', fund: 'ABSENCE', amount: 100_000 }, filled, REASON)).toBeNull();
    expect(fundChangeProblem({ kind: 'OPENING', fund: 'ABSENCE', amount: -1 }, filled, REASON)).toContain('minus');
  });

  it('penyesuaian kurang tidak boleh membuat Saldo Dana Disiplin di bawah Terpesan', () => {
    const s = fundState([{ fund: 'DISCIPLINE', amount: 500_000 }], 300_000);
    expect(fundChangeProblem({ kind: 'ADJUSTMENT', fund: 'DISCIPLINE', amount: -200_000 }, s, REASON)).toBeNull();
    expect(fundChangeProblem({ kind: 'ADJUSTMENT', fund: 'DISCIPLINE', amount: -200_001 }, s, REASON)).toContain('Paling banyak dikurangi Rp200.000');
    expect(fundChangeProblem({ kind: 'ADJUSTMENT', fund: 'DISCIPLINE', amount: 0 }, s, REASON)).toContain('nol');
    expect(fundChangeProblem({ kind: 'ADJUSTMENT', fund: 'ABSENCE', amount: -900_000 }, s, REASON)).toBeNull();
  });

  it('pindah paling banyak saldo berjalan Dana Tidak Hadir yang positif', () => {
    const s = fundState([{ fund: 'ABSENCE', amount: 150_000 }], 0);
    expect(fundChangeProblem({ kind: 'TRANSFER', amount: 150_000 }, s, REASON)).toBeNull();
    expect(fundChangeProblem({ kind: 'TRANSFER', amount: 150_001 }, s, REASON)).toContain('paling banyak dipindah Rp150.000');
    expect(fundChangeProblem({ kind: 'TRANSFER', amount: 1 }, fundState([{ fund: 'ABSENCE', amount: -5 }], 0), REASON)).toContain('Rp0');
  });

  it('alasan paling sedikit 15 huruf', () => {
    expect(fundChangeProblem({ kind: 'TRANSFER', amount: 1 }, fundState([{ fund: 'ABSENCE', amount: 10 }], 0), 'pendek')).toContain('15 huruf');
  });

  it('perkiraan: telat + denda → Disiplin; alpha/izin/sakit masuk, lembur/kompensasi keluar Tidak Hadir', () => {
    expect(estimateOf([
      { key: 'BASE', amount: 2_600_000 }, { key: 'LATE', amount: 5_000 }, { key: 'FINE', amount: 10_000 }, { key: 'ALPHA', amount: 100_000 },
      { key: 'PERMIT_SICK', amount: 50_000 }, { key: 'SUDDEN', amount: 1 }, { key: 'SICK_LETTER', amount: 2 }, { key: 'OVERTIME', amount: 20_000 }, { key: 'COMPENSATION', amount: 3 },
    ])).toEqual({ disciplineIn: 15_000, absenceIn: 150_003, absenceOut: 20_003 });
  });
});

describe('L4d-2: pemeriksaan Bonus Bebas', () => {
  const ok = { amount: 50_000, reason: 'Membantu stok opname sampai malam', occurredOn: '2026-11-01', today: '2026-11-03', self: false, recipientRole: 'STAFF' as const };
  it('menolak diri sendiri, Pemilik, GM, alasan pendek, tanggal masa depan, nominal tidak bulat', () => {
    expect(freeBonusProblem(ok)).toBeNull();
    expect(freeBonusProblem({ ...ok, self: true })).toContain('diri sendiri');
    expect(freeBonusProblem({ ...ok, recipientRole: 'OWNER' })).toContain('Pemilik dan GM');
    expect(freeBonusProblem({ ...ok, recipientRole: 'GM' })).toContain('Pemilik dan GM');
    expect(freeBonusProblem({ ...ok, reason: 'bantu stok' })).toContain('15 huruf');
    expect(freeBonusProblem({ ...ok, occurredOn: '2026-11-04' })).toContain('masa depan');
    expect(freeBonusProblem({ ...ok, amount: 0 })).toContain('lebih dari 0');
    expect(freeBonusProblem({ ...ok, amount: 1.5 })).toContain('bulat');
  });
});
