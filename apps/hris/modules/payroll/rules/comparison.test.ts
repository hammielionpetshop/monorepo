import { describe, expect, it } from 'vitest';
import {
  causeProblem, comparisonCsv, comparisonLoadSql, comparisonPurgeSql, computationComponents, latestHris, parseDate, parseOldSlips, parseRupiah,
  type OldSlipRow,
} from './comparison';
import type { SlipComputation } from './payslip';

const P = '2026-10-26';
const row = (r: Partial<Record<string, unknown>>): OldSlipRow => ({ Kode: 'EMP-002', Nama: 'Budi', 'Jenis slip': 'Bulanan', Mulai: null, ...r });

describe('L9b: berkas hasil slip lama', () => {
  it('membaca rupiah dan tanggal dalam beberapa bentuk', () => {
    expect([parseRupiah(1250000), parseRupiah('1.250.000'), parseRupiah('Rp 50.000'), parseRupiah('12,5'), parseRupiah(-1)]).toEqual([1250000, 1250000, 50000, null, null]);
    expect([parseDate('2026-10-30'), parseDate('30/10/2026'), parseDate(46325), parseDate('31-02-2026')]).toEqual(['2026-10-30', '2026-10-30', '2026-10-30', null]);
  });

  it('mengelompokkan per orang + jenis slip; selisih komponen vs Total hanya peringatan', () => {
    const result = parseOldSlips([
      row({ Bagian: 'Pendapatan', Komponen: 'Gaji pokok', Jumlah: 2600000 }),
      row({ Bagian: 'Potongan', Komponen: 'Terlambat', Jumlah: '20.000' }),
      row({ Bagian: 'Total', Jumlah: 2580000 }),
      row({ 'Jenis slip': 'Mingguan tambahan', Mulai: '30-10-2026', Bagian: 'Pendapatan', Komponen: 'Ritase', Jumlah: 150000 }),
      row({ 'Jenis slip': 'Mingguan tambahan', Mulai: '30-10-2026', Bagian: 'Total', Jumlah: 140000 }),
      row({ Kode: 'emp-014', Nama: 'Irma', Bagian: 'Total', Jumlah: 0 }),
    ], { periodStart: P, renames: { 'EMP-014': 'Irma Yanti' } });
    expect(result.errors).toEqual([]);
    expect(result.slips).toHaveLength(3);
    expect(result.slips[0]).toMatchObject({ legacyCode: 'EMP-002', slipKind: 'MONTHLY', slipStart: P, oldTotal: 2580000 });
    expect(result.slips[0].components).toEqual([{ label: 'Gaji pokok', side: 'INCOME', amount: 2600000 }, { label: 'Terlambat', side: 'DEDUCTION', amount: 20000 }]);
    expect(result.slips[1]).toMatchObject({ slipKind: 'WEEKLY_EXTRA', slipStart: '2026-10-30', oldTotal: 140000 });
    expect(result.slips[2]).toMatchObject({ legacyCode: 'EMP-014', name: 'Irma Yanti' });
    expect(result.warnings).toHaveLength(1);
  });

  it('satu baris salah = seluruh berkas ditolak, dengan nomor baris dan sebab', () => {
    const result = parseOldSlips([
      row({ Bagian: 'Total', Jumlah: 100 }),
      row({ Nama: 'Budi Santoso', 'Jenis slip': 'Harian', Bagian: 'Bonus', Jumlah: '1,5' }),
      row({ Kode: 'EMP-003', Nama: 'Cici', 'Jenis slip': 'Mingguan', Mulai: '2026-11-30', Bagian: 'Total', Jumlah: 1 }),
      row({ Kode: 'EMP-004', Nama: 'Dodi', Bagian: 'Pendapatan', Komponen: 'Gaji', Jumlah: 1 }),
    ], { periodStart: P });
    expect(result.slips).toEqual([]);
    expect(result.errors.join('\n')).toMatch(/Baris 3 \(EMP-002\): Jenis slip "Harian".*Bagian "Bonus".*Jumlah "1,5".*sudah dipakai nama "Budi"/);
    expect(result.errors.join('\n')).toMatch(/Baris 4 \(EMP-003\): Mulai 2026-11-30 di luar periode/);
    expect(result.errors.join('\n')).toMatch(/EMP-004 Bulanan 2026-10-26: baris Total harus tepat satu \(ada 0\)/);
  });

  it('SQL muat dan hapus: satu transaksi, nama dicocokkan, petik di-escape', () => {
    const load = comparisonLoadSql([{ legacyCode: 'EMP-9', name: "Ma'ruf", slipKind: 'MONTHLY', slipStart: P, oldTotal: 5, components: [] }], { periodStart: P, label: 'x', files: ['a.xlsx'] });
    expect(load).toMatch(/^\\set ON_ERROR_STOP on\nBEGIN;/);
    expect(load).toContain("lower('Ma''ruf')");
    expect(load).toContain("'[]'::jsonb");
    expect(comparisonPurgeSql(P)).toMatch(/ORDER BY id DESC[\s\S]*status = 'PURGED'/);
  });
});

describe('L9b: Lembar Banding', () => {
  it('komponen HRIS: potongan sebesar yang diambil; angka terbaru = hitung ulang bila ada', () => {
    const computation = {
      lines: [
        { section: 'INCOME', label: 'Gaji', amount: 100, taken: 0 },
        { section: 'DEDUCTION', label: 'Kasbon', amount: 80, taken: 60 },
        { section: 'DEDUCTION', label: 'Sisa', amount: 10, taken: 0 },
        { section: 'NOTE', label: 'Catatan', amount: 0, taken: 0 },
      ], income: 100, taken: 60, net: 40, carried: 30,
    } as unknown as SlipComputation;
    expect(computationComponents(computation)).toEqual([{ label: 'Gaji', side: 'INCOME', amount: 100 }, { label: 'Kasbon', side: 'DEDUCTION', amount: 60 }]);
    expect([latestHris({ firstTotal: 1, secondTotal: 2 }, 0), latestHris({ firstTotal: 1, secondTotal: 2 }, 1), latestHris({ firstTotal: 1, secondTotal: 2 }, 2)]).toEqual([null, 1, 2]);
  });

  it('beda disengaja wajib nomor aturan; CSV titik koma dengan selisih', () => {
    expect(causeProblem('INTENDED', ' ', null)).toMatch(/nomor aturan/);
    expect(causeProblem('FIX', null, null)).toBeNull();
    const csv = comparisonCsv([{
      code: 'HML-0001', legacyCode: 'EMP-2', name: 'Budi; S', slipKind: 'MONTHLY', slipStart: P, oldTotal: 1000, firstTotal: 900, secondTotal: null, hris: 900,
      cause: 'INTENDED', ruleRef: 'GAJ-54', note: null,
    }], { label: 'Okt', madeBy: 'Elan', madeAt: 'kini' });
    expect(csv.split('\r\n')[3]).toBe('HML-0001;EMP-2;"Budi; S";Bulanan;2026-10-26;1000;900;;-100;Beda disengaja;GAJ-54;');
  });
});
