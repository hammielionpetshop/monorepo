import { describe, expect, it } from 'vitest';
import { balanceBoard, flowReport, ledger, placeBalance, todayWib, isDate, lastDayOfMonth, type MoneyLine, type Place } from './rules';

const place = (id: number, opening: number | null, branchId = 1, isActive = true): Place => ({
  id, name: `Tempat ${id}`, kind: 'BANK', branchId, branchName: `Cabang ${branchId}`, heldBy: 'FINANCE', isActive, opening,
});
const line = (placeId: number, date: string, amount: number, kind: MoneyLine['kind'], ref: string, group: string | null = null): MoneyLine => ({
  placeId, date, amount, kind, group, label: ref, source: 'BO', ref,
});

describe('Saldo Tempat Uang', () => {
  const lines: MoneyLine[] = [
    line(1, '2026-10-31', 999, 'CASHFLOW_IN', 'lama'), // sebelum 1 Nov: tidak dihitung
    line(1, '2026-11-02', 8_000_000, 'CASH_DEPOSIT', 'mm:1'),
    line(1, '2026-11-03', -500_000, 'CASH_DEPOSIT', 'mm:2'), // pembalikan koreksi setoran
    line(1, '2026-11-05', -5_100_000, 'SUPPLIER', 'sp:1'),
    line(1, '2026-11-06', -1_000_000, 'TRANSFER_OUT', 'tr:9'),
    line(2, '2026-11-06', 1_000_000, 'TRANSFER_IN', 'tr:9'),
    line(1, '2026-11-20', -300_000, 'CASHFLOW_OUT', 'cf:4', 'Listrik'),
  ];

  it('saldo = saldo awal + masuk − keluar ± pindahan, sejak 1 Nov s.d. tanggal pilihan', () => {
    const r = placeBalance(place(1, 12_350_000), lines, '2026-11-10');
    expect(r).toMatchObject({ opening: 12_350_000, inTotal: 7_500_000, outTotal: 5_100_000, transferNet: -1_000_000, balance: 13_750_000 });
    expect(placeBalance(place(1, 12_350_000), lines, '2026-11-30').balance).toBe(13_450_000);
  });

  it('saldo awal belum diisi dihitung 0', () => {
    expect(placeBalance(place(2, null), lines, '2026-11-30').balance).toBe(1_000_000);
  });

  it('papan saldo per cabang; nonaktif bersaldo 0 tanpa baris disembunyikan', () => {
    const board = balanceBoard([place(1, 12_350_000), place(2, 0, 2), place(3, 0, 2, false)], lines, '2026-11-30');
    expect(board.groups.map((g) => [g.branchName, g.total, g.rows.length])).toEqual([['Cabang 1', 13_450_000, 1], ['Cabang 2', 1_000_000, 1]]);
    expect(board.total).toBe(14_450_000);
  });

  it('mutasi: saldo berjalan dari saldo awal, dan dari saldo hari sebelumnya untuk periode tengah', () => {
    const full = ledger(place(1, 12_350_000), lines, '2026-11-01', '2026-11-30');
    expect(full.startBalance).toBe(12_350_000);
    expect(full.rows.map((r) => r.running)).toEqual([20_350_000, 19_850_000, 14_750_000, 13_750_000, 13_450_000]);
    const mid = ledger(place(1, 12_350_000), lines, '2026-11-05', '2026-11-06');
    expect(mid.startBalance).toBe(19_850_000);
    expect(mid.endBalance).toBe(13_750_000);
  });

  it('Arus Uang bulan: penutup sama dengan saldo akhir bulan; pindahan di dalam Gabungan saling meniadakan', () => {
    const places = [place(1, 12_350_000), place(2, 0, 2)];
    const all = flowReport(places, lines, '2026-11-01');
    expect(all).toMatchObject({ opening: 12_350_000, inTotal: 7_500_000, outTotal: 5_400_000, transferIn: 0, transferOut: 0 });
    expect(all.closing).toBe(balanceBoard(places, lines, '2026-11-30').total);
    expect(all.outItems.find((i) => i.kind === 'CASHFLOW_OUT')).toMatchObject({ group: 'Listrik', amount: 300_000 });

    const one = flowReport([place(1, 12_350_000)], lines, '2026-11-01');
    expect(one).toMatchObject({ transferIn: 0, transferOut: 1_000_000, closing: 13_450_000 });
  });

  it('Arus Uang bulan berikutnya mulai dari saldo akhir bulan sebelumnya', () => {
    const dec = flowReport([place(1, 12_350_000)], [...lines, line(1, '2026-12-01', 50_000, 'CASHFLOW_IN', 'cf:9')], '2026-12-01');
    expect(dec).toMatchObject({ opening: 13_450_000, inTotal: 50_000, closing: 13_500_000 });
  });
});

describe('Tanggal', () => {
  it('hari ini WIB, validasi tanggal, akhir bulan', () => {
    expect(todayWib(new Date('2026-11-11T18:30:00Z'))).toBe('2026-11-12');
    expect(isDate('2026-11-31')).toBe(false);
    expect(isDate('2026-11-30')).toBe(true);
    expect(lastDayOfMonth('2026-02-01')).toBe('2026-02-28');
  });
});
