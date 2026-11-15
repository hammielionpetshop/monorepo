import { describe, expect, it } from 'vitest';
import { moneyMattersFrom, totalsCsv, totalsFrom, totalsRange, totalsSum } from './former';

// Spec L4g §3.7–3.8, §8: hasMoneyMatters, Total Diterima (Diterima + Belum = Jumlah), rentang.
const at = (iso: string) => new Date(iso);
const paid = (periodStart: string, when: string) => ({ periodStart, status: 'CLOSED' as const, paidAt: at(when) });

describe('moneyMattersFrom (akses terbatas mantan karyawan)', () => {
  const base = { lastPeriod: '2026-10-26', openObjections: 0, waitingClaims: 0 } as const;

  it('slip terakhir belum ada, masih Perkiraan, atau Ditutup belum Dibayar = masih ada urusan', () => {
    const now = at('2026-12-20T00:00:00Z');
    expect(moneyMattersFrom({ ...base, slips: [] }, now)).toBe(true);
    expect(moneyMattersFrom({ ...base, slips: [{ periodStart: '2026-10-26', status: 'ESTIMATE', paidAt: null }] }, now)).toBe(true);
    expect(moneyMattersFrom({ ...base, slips: [{ periodStart: '2026-10-26', status: 'CLOSED', paidAt: null }] }, now)).toBe(true);
  });

  it('Dibayar: masih urusan sampai 23.59 WIB hari ke-7, sesudahnya selesai', () => {
    const slips = [paid('2026-10-26', '2026-11-28T03:00:00Z')]; // 28 Nov 10.00 WIB
    expect(moneyMattersFrom({ ...base, slips }, at('2026-12-05T16:59:00Z'))).toBe(true); // 5 Des 23.59 WIB
    expect(moneyMattersFrom({ ...base, slips }, at('2026-12-05T17:00:01Z'))).toBe(false);
  });

  it('keberatan menunggu / menunggu pembetulan atau tagihan luar slip menunggu = masih urusan walau slip sudah lama dibayar', () => {
    const slips = [paid('2026-10-26', '2026-11-28T03:00:00Z')];
    const late = at('2027-01-30T00:00:00Z');
    expect(moneyMattersFrom({ ...base, slips }, late)).toBe(false);
    expect(moneyMattersFrom({ ...base, slips, openObjections: 1 }, late)).toBe(true);
    expect(moneyMattersFrom({ ...base, slips, waitingClaims: 1 }, late)).toBe(true);
  });

  it('slip periode sebelumnya yang belum Dibayar ikut dihitung; slip sesudah periode terakhir diabaikan', () => {
    const now = at('2027-01-30T00:00:00Z');
    const last = paid('2026-11-26', '2026-12-28T03:00:00Z');
    expect(moneyMattersFrom({ ...base, lastPeriod: '2026-11-26', slips: [{ periodStart: '2026-10-26', status: 'CLOSED', paidAt: null }, last] }, now)).toBe(true);
    expect(moneyMattersFrom({ ...base, slips: [paid('2026-10-26', '2026-11-28T03:00:00Z'), { periodStart: '2026-11-26', status: 'ESTIMATE', paidAt: null }] }, now)).toBe(false);
  });

  it('berhenti sebelum slip pertama HRIS: tanpa slip = tidak ada urusan', () => {
    expect(moneyMattersFrom({ ...base, lastPeriod: null, slips: [] }, at('2026-11-10T00:00:00Z'))).toBe(false);
  });
});

describe('Total Diterima per Orang', () => {
  it('Diterima + Belum dibayar = Jumlah = slip bulanan + bayar di luar slip', () => {
    const rows = totalsFrom(
      [
        { employeeId: 1, periodStart: '2026-10-26', net: 3_000_000, paid: true },
        { employeeId: 1, periodStart: '2026-11-26', net: 2_500_000, paid: false },
        { employeeId: 2, periodStart: '2026-10-26', net: 1_000_000, paid: true },
      ],
      [{ employeeId: 1, periodStart: '2026-11-26', amount: 150_000, paid: true }, { employeeId: 3, periodStart: '2026-11-26', amount: 50_000, paid: false }],
    );
    const one = rows.find((r) => r.employeeId === 1)!;
    expect(one).toEqual({ employeeId: 1, slipMonthly: 5_500_000, offSlip: 150_000, received: 3_150_000, pending: 2_500_000, total: 5_650_000 });
    for (const r of rows) expect(r.received + r.pending).toBe(r.total);
    const sum = totalsSum(rows);
    expect(sum.total).toBe(6_700_000);
    expect(sum.received + sum.pending).toBe(sum.total);
  });

  it('rentang: bawaan periode terakhir ditutup, ditukar bila terbalik, paling banyak 12 periode', () => {
    expect(totalsRange({}, '2026-10-26', '2027-01-26')).toEqual({ from: '2026-10-26', to: '2026-10-26', periods: ['2026-10-26'] });
    expect(totalsRange({ from: '2026-12-26', to: '2026-10-26' }, '2026-10-26', '2027-01-26').periods).toEqual(['2026-10-26', '2026-11-26', '2026-12-26']);
    const long = totalsRange({ from: '2026-10-26', to: '2028-01-26' }, '2026-10-26', '2028-02-26');
    expect(long.periods).toHaveLength(12);
    expect(long.to).toBe('2028-01-26');
    expect(long.from).toBe('2027-02-26');
    expect(totalsRange({ from: '2026-10-25', to: 'x' }, '2026-11-26', '2027-01-26').periods).toEqual(['2026-11-26']);
  });

  it('CSV: titik koma, mingguan dan bongkaran "—", baris Jumlah', () => {
    const csv = totalsCsv(
      [{ employeeId: 1, slipMonthly: 100, offSlip: 20, received: 100, pending: 20, total: 120, name: 'Ani; B', code: 'HML-0001', branchName: 'Gudang', positionName: 'Kasir', former: true }],
      { range: '26 Okt 2026 – 25 Nov 2026', madeBy: 'GM', madeAt: '3 Nov 2026 18.00' },
    ).split('\r\n');
    expect(csv[0]).toBe('sep=;');
    expect(csv[3]).toBe('HML-0001;"Ani; B";Gudang;Kasir;Mantan;100;—;—;20;100;20;120');
    expect(csv[4]).toBe('Jumlah;;;;;100;—;—;20;100;20;120');
  });
});
